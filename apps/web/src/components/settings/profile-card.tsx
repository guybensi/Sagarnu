"use client";

import { endpoints, keys, useMe } from "@sagarnu/api-client";
import { formatPhone, normalizePhone, type UserType } from "@sagarnu/domain";
import { formatDateTime } from "@sagarnu/i18n";
import type { MeDto } from "@sagarnu/schemas";
import { useQueryClient } from "@tanstack/react-query";
import { Briefcase, Heart, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { toastError } from "@/lib/errors";

const TYPES = [
  { value: "couple", label: "אנחנו זוג", hint: "אירוע אחד שלנו", icon: Heart },
  { value: "planner", label: "מפיק/ת אירועים", hint: 'כמה אירועים, מסך "האירועים שלי"', icon: Briefcase },
] as const;

type Form = { name: string; userType: UserType; phone: string; whatsapp: boolean };

const fromMe = (me: MeDto): Form => ({
  name: me.name,
  userType: me.userType,
  phone: me.phoneE164 ? formatPhone(me.phoneE164) : "",
  whatsapp: me.whatsappOptInAt != null,
});

export function ProfileCard() {
  const me = useMe();
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (me.data && !form) setForm(fromMe(me.data));
  }, [me.data, form]);

  if (!me.data || !form) return null;
  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm({ ...form, [key]: value });
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const dirty = JSON.stringify(form) !== JSON.stringify(fromMe(me.data));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    const phoneE164 = form.phone.trim() === "" ? null : normalizePhone(form.phone);
    const next: typeof errors = {};
    if (name.length < 2) next.name = "לפחות 2 תווים";
    if (form.phone.trim() !== "" && !phoneE164) next.phone = "מספר טלפון לא תקין";
    if (form.whatsapp && !form.phone.trim()) next.phone = "כדי לקבל תזכורות בוואטסאפ צריך מספר טלפון";
    if (Object.keys(next).length > 0) return setErrors(next);
    setSaving(true);
    try {
      const updated = await endpoints.me.update({
        name,
        userType: form.userType,
        phoneE164,
        whatsappOptIn: form.whatsapp,
      });
      qc.setQueryData(keys.me, updated);
      setForm(fromMe(updated));
      toast.success("הפרטים נשמרו");
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardTitle icon={<UserRound className="size-5" />}>פרטים אישיים</CardTitle>
      <form onSubmit={submit} className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="שם" htmlFor="name" error={errors.name}>
            <Input
              id="name"
              autoComplete="name"
              aria-invalid={!!errors.name || undefined}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          <Field label="אימייל" htmlFor="email" hint="אי אפשר לשנות כרגע את כתובת האימייל">
            <Input id="email" dir="ltr" value={me.data.email} disabled />
          </Field>
        </div>

        <div className="grid gap-2">
          <p className="text-sm font-medium">סוג החשבון</p>
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="סוג החשבון">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={form.userType === t.value}
                onClick={() => set("userType", t.value)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border p-3.5 text-start transition-colors",
                  form.userType === t.value
                    ? "border-brand-500 bg-brand-50 ring-3 ring-brand-100"
                    : "border-line hover:bg-soft",
                )}
              >
                <t.icon className="size-5 shrink-0 text-brand-500" />
                <span className="grid">
                  <span className="text-sm font-semibold">{t.label}</span>
                  <span className="text-xs text-muted">{t.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl bg-soft/60 p-4">
          <Field
            label="טלפון נייד"
            htmlFor="phone"
            error={errors.phone}
            hint="לתזכורות תשלום בוואטסאפ. לא נעביר את המספר לאף אחד"
            className="sm:max-w-72"
          >
            <Input
              id="phone"
              type="tel"
              dir="ltr"
              inputMode="tel"
              autoComplete="tel"
              placeholder="050-1234567"
              aria-invalid={!!errors.phone || undefined}
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>
          <Checkbox
            checked={form.whatsapp}
            onChange={(v) => set("whatsapp", v)}
            label="אני מסכים/ה לקבל תזכורות תשלום בוואטסאפ"
          />
          {me.data.whatsappOptInAt && (
            <p className="text-xs text-muted">
              ההסכמה ניתנה ב־<span className="num">{formatDateTime(me.data.whatsappOptInAt)}</span>. אפשר לבטל
              בכל רגע.
            </p>
          )}
          <p className="text-xs text-muted">
            התזכורות בוואטסאפ עוד בבנייה. כשיופעלו, הן יישלחו רק אם סימנת כאן.
          </p>
        </div>

        <div className="flex gap-3">
          <Button type="submit" loading={saving} disabled={!dirty}>
            שמירה
          </Button>
          {dirty && (
            <Button variant="ghost" onClick={() => (setForm(fromMe(me.data!)), setErrors({}))}>
              ביטול שינויים
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
