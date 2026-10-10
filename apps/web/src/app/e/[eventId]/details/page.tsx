"use client";

import { endpoints, keys, useCategories, useEvent } from "@sagarnu/api-client";
import { updateEventSchema, type EventDto } from "@sagarnu/schemas";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Card, CardTitle, Spinner } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { toastError } from "@/lib/errors";
import { useCan, useEventId } from "@/lib/use-event-id";
import { useRefreshEvent } from "@/lib/use-refresh";

function fromEvent(e: EventDto): EventForm {
  const form = { ...emptyEventForm };
  for (const key of Object.keys(form) as (keyof EventForm)[]) {
    (form as Record<string, unknown>)[key] = e[key] ?? (key === "name" ? "" : null);
  }
  return form;
}

function CategoriesCard({ eventId, editable }: { eventId: string; editable: boolean }) {
  const categories = useCategories(eventId);
  const refresh = useRefreshEvent(eventId);
  if (!categories.data) return null;
  return (
    <Card>
      <CardTitle>קטגוריות רלוונטיות</CardTitle>
      <p className="-mt-2 mb-4 text-sm text-muted">
        קטגוריה שלא רלוונטית לכם לא תופיע בדשבורד בתור &quot;עוד אין ספק&quot;
      </p>
      <div className="flex flex-wrap gap-2">
        {categories.data.map((c) => (
          <button
            key={c.id}
            disabled={!editable}
            onClick={async () => {
              try {
                await endpoints.categories.setRelevance(eventId, c.id, !c.isRelevant);
                await refresh();
              } catch (e) {
                toastError(e);
              }
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              c.isRelevant
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-line text-muted hover:bg-soft",
            )}
          >
            {c.isRelevant && <Check className="size-3.5" />}
            {c.nameHe}
          </button>
        ))}
      </div>
    </Card>
  );
}

export default function DetailsPage() {
  const eventId = useEventId();
  const router = useRouter();
  const qc = useQueryClient();
  const event = useEvent(eventId);
  const refresh = useRefreshEvent(eventId);
  const editable = useCan("event.edit");
  const canDelete = useCan("event.delete");
  const [form, setForm] = useState<EventForm | null>(null);
  const [unknown, setUnknown] = useState<Set<keyof EventForm>>(new Set());
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (event.data && !form) setForm(fromEvent(event.data));
  }, [event.data, form]);

  if (!form || !event.data) return <Spinner />;

  const props: FieldProps = {
    form,
    set: (key, value) => setForm((f) => f && { ...f, [key]: value }),
    unknown,
    toggleUnknown: (key, isUnknown) =>
      setUnknown((s) => {
        const next = new Set(s);
        if (isUnknown) next.add(key);
        else next.delete(key);
        return next;
      }),
  };

  const save = async () => {
    const parsed = updateEventSchema.safeParse({
      ...toEventPayload(form, unknown),
      completeQuestionnaire: true,
    });
    if (!parsed.success) return toast.error("יש שדה לא תקין");
    setSaving(true);
    try {
      await endpoints.events.update(eventId, parsed.data);
      await Promise.all([refresh(), qc.invalidateQueries({ queryKey: keys.events })]);
      toast.success("הפרטים נשמרו");
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await endpoints.events.remove(eventId);
      qc.clear();
      router.replace("/");
    } catch (e) {
      toastError(e);
    }
  };

  const sections = [
    { title: "מתי", body: <WhenFields {...props} /> },
    { title: "כמה", body: <SizeFields {...props} /> },
    { title: "איפה", body: <PlaceFields {...props} /> },
    { title: "מי", body: <PeopleFields {...props} /> },
    { title: "סגנון", body: <StyleFields {...props} /> },
  ];

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">פרטי האירוע</h1>
          <p className="text-sm text-muted">שינוי תאריך האירוע מעדכן אוטומטית מועדי תשלום יחסיים</p>
        </div>
        {editable && (
          <Button onClick={save} loading={saving}>
            שמירת שינויים
          </Button>
        )}
      </div>

      <fieldset disabled={!editable} className="grid gap-5">
        {sections.map((s) => (
          <Card key={s.title}>
            <CardTitle>{s.title}</CardTitle>
            {s.body}
          </Card>
        ))}
        <Card>
          <CardTitle>הערות</CardTitle>
          <Field label="הערות כלליות" htmlFor="eventNotes">
            <Textarea
              id="eventNotes"
              value={form.notes ?? ""}
              onChange={(e) => props.set("notes", e.target.value || null)}
            />
          </Field>
        </Card>
      </fieldset>

      <CategoriesCard eventId={eventId} editable={editable} />

      {editable && (
        <div className="flex justify-end">
          <Button onClick={save} loading={saving} size="lg">
            שמירת שינויים
          </Button>
        </div>
      )}

      {canDelete && (
        <Card className="border border-danger/20">
          <CardTitle>מחיקת האירוע</CardTitle>
          <p className="mb-4 text-sm text-muted">האירוע, החוזים והתשלומים יוסתרו מכל החברים באירוע.</p>
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            מחיקת האירוע
          </Button>
        </Card>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        danger
        title="למחוק את האירוע?"
        description={`"${event.data.name}" וכל הנתונים שלו יימחקו.`}
        confirmLabel="כן, למחוק"
        onConfirm={remove}
      />
    </div>
  );
}
