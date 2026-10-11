"use client";

import { endpoints, keys } from "@sagarnu/api-client";
import { SYSTEM_CATEGORIES } from "@sagarnu/domain";
import { createEventSchema } from "@sagarnu/schemas";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand";
import {
  emptyEventForm,
  PeopleFields,
  PlaceFields,
  SizeFields,
  StyleFields,
  toEventPayload,
  WhenFields,
  type EventForm,
  type FieldProps,
} from "@/components/event/event-fields";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { toastError } from "@/lib/errors";

type Step = { title: string; subtitle: string; render: (p: FieldProps) => React.ReactNode };

const STEPS: Step[] = [
  { title: "מתי החתונה?", subtitle: "אפשר לדלג ולמלא אחר כך", render: (p) => <WhenFields {...p} /> },
  {
    title: "כמה אורחים ומה התקציב?",
    subtitle: "הערכה גסה מספיקה בשלב הזה",
    render: (p) => <SizeFields {...p} />,
  },
  { title: "איפה?", subtitle: "עיר ואולם, אם כבר סגרתם", render: (p) => <PlaceFields {...p} /> },
  { title: "מי מתחתנים?", subtitle: "השמות יופיעו בדשבורד", render: (p) => <PeopleFields {...p} /> },
  {
    title: "איזה אירוע זה?",
    subtitle: "עוזר לנו להתאים את הקטגוריות",
    render: (p) => <StyleFields {...p} />,
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const session = authClient.useSession();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<EventForm>(emptyEventForm);
  const [unknown, setUnknown] = useState<Set<keyof EventForm>>(new Set());
  const [relevant, setRelevant] = useState<Set<string>>(
    new Set(SYSTEM_CATEGORIES.map((c) => c.key).filter((k) => k !== "other")),
  );
  const [custom, setCustom] = useState<string[]>([]);
  const [customDraft, setCustomDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const addCustom = () => {
    const name = customDraft.trim();
    const taken = new Set([...SYSTEM_CATEGORIES.map((c) => c.nameHe), ...custom]);
    if (name && !taken.has(name)) setCustom((list) => [...list, name]);
    setCustomDraft("");
  };

  useEffect(() => {
    if (!session.isPending && !session.data) router.replace("/login");
  }, [session.isPending, session.data, router]);

  if (session.isPending || !session.data) return <Spinner className="min-h-dvh" />;

  const props: FieldProps = {
    form,
    set: (key, value) => setForm((f) => ({ ...f, [key]: value })),
    unknown,
    toggleUnknown: (key, isUnknown) =>
      setUnknown((s) => {
        const next = new Set(s);
        if (isUnknown) next.add(key);
        else next.delete(key);
        return next;
      }),
  };

  const isLast = step === STEPS.length;
  const total = STEPS.length + 1;

  const finish = async () => {
    const payload = createEventSchema.safeParse({
      ...toEventPayload(form, unknown),
      relevantCategoryKeys: [...relevant, "other"],
      customCategories: custom,
      completeQuestionnaire: true,
    });
    if (!payload.success) {
      toast.error("יש שדה לא תקין באחד השלבים הקודמים");
      return;
    }
    setSaving(true);
    try {
      const event = await endpoints.events.create(payload.data);
      await qc.invalidateQueries({ queryKey: keys.events });
      await qc.invalidateQueries({ queryKey: keys.me });
      // A planner's next step is sharing the event with the couple.
      if (session.data?.user.userType === "planner") {
        toast.success("האירוע נוצר. עכשיו מזמינים את בני הזוג");
        router.replace(`/e/${event.id}/members?invite=1`);
      } else router.replace(`/e/${event.id}`);
    } catch (e) {
      toastError(e);
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-6 sm:py-10">
      <div className="mb-8 flex items-center justify-between">
        <Logo />
        <span className="text-sm text-muted">
          שלב {step + 1} מתוך {total}
        </span>
      </div>

      <div className="mb-8 flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-brand-500" : "bg-line")} />
        ))}
      </div>

      <div className="flex-1 rounded-3xl bg-surface p-6 shadow-card sm:p-8">
        {!isLast ? (
          <>
            <h1 className="text-2xl font-bold">{STEPS[step]!.title}</h1>
            <p className="mt-1 mb-7 text-sm text-muted">{STEPS[step]!.subtitle}</p>
            {STEPS[step]!.render(props)}
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">אילו ספקים רלוונטיים לכם?</h1>
            <p className="mt-1 mb-7 text-sm text-muted">
              קטגוריות שלא סימנתם לא יופיעו בדשבורד בתור &quot;עוד אין ספק&quot;. אפשר לשנות בכל שלב.
            </p>
            <div className="flex flex-wrap gap-2">
              {SYSTEM_CATEGORIES.filter((c) => c.key !== "other").map((c) => {
                const on = relevant.has(c.key);
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() =>
                      setRelevant((s) => {
                        const next = new Set(s);
                        if (on) next.delete(c.key);
                        else next.add(c.key);
                        return next;
                      })
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors",
                      on
                        ? "border-brand-500 bg-brand-50 font-medium text-brand-700"
                        : "border-line text-muted hover:bg-soft",
                    )}
                  >
                    {on && <Check className="size-3.5" />}
                    {c.nameHe}
                  </button>
                );
              })}
              {custom.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-500 bg-brand-50 py-2 ps-4 pe-2 text-sm font-medium text-brand-700"
                >
                  <Check className="size-3.5" />
                  {name}
                  <button
                    type="button"
                    aria-label={`הסרת ${name}`}
                    onClick={() => setCustom((list) => list.filter((n) => n !== name))}
                    className="rounded-full p-0.5 hover:bg-brand-100"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>

            <form
              className="mt-6 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addCustom();
              }}
            >
              <Input
                aria-label="קטגוריה משלכם"
                placeholder="קטגוריה משלכם, למשל: צלם מגנטים"
                maxLength={40}
                value={customDraft}
                onChange={(e) => setCustomDraft(e.target.value)}
              />
              <Button type="submit" variant="secondary" disabled={!customDraft.trim()}>
                <Plus className="size-4" />
                הוספה
              </Button>
            </form>
          </>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
          <ArrowRight className="size-4" />
          הקודם
        </Button>
        <div className="flex gap-2">
          {!isLast && (
            <Button variant="secondary" onClick={() => setStep((s) => s + 1)}>
              דלג
            </Button>
          )}
          {isLast ? (
            <Button onClick={finish} loading={saving} size="lg">
              סיימנו, לדשבורד
            </Button>
          ) : (
            <Button onClick={() => setStep((s) => s + 1)}>
              הבא
              <ArrowLeft className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
