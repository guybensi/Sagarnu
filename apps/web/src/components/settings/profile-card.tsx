"use client";

import { endpoints, keys, useMe } from "@sagarnu/api-client";
import { formatPhone, normalizePhone, type UserType } from "@sagarnu/domain";
import { formatDateTime, he } from "@sagarnu/i18n";
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
  { value: "couple", label: he.auth.signup.couple, hint: he.settings.profile.coupleHint, icon: Heart },
  { value: "planner", label: he.auth.signup.planner, hint: he.settings.profile.plannerHint, icon: Briefcase },
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
    if (name.length < 2) next.name = he.auth.nameTooShort;
    if (form.phone.trim() !== "" && !phoneE164) next.phone = he.fieldErrors.invalid_phone;
    if (form.whatsapp && !form.phone.trim()) next.phone = he.settings.profile.whatsappNeedsPhone;
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
      toast.success(he.settings.profile.saved);
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardTitle icon={<UserRound className="size-5" />}>{he.settings.profile.title}</CardTitle>
      <form onSubmit={submit} className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={he.auth.name} htmlFor="name" error={errors.name}>
            <Input
              id="name"
              autoComplete="name"
              aria-invalid={!!errors.name || undefined}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          <Field label={he.auth.email} htmlFor="email" hint={he.settings.profile.emailLocked}>
            <Input id="email" dir="ltr" value={me.data.email} disabled />
          </Field>
        </div>

        <div className="grid gap-2">
          <p className="text-sm font-medium">{he.settings.profile.accountType}</p>
          <div
            className="grid gap-3 sm:grid-cols-2"
            role="radiogroup"
            aria-label={he.settings.profile.accountType}
          >
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
            label={he.settings.profile.phone}
            htmlFor="phone"
            error={errors.phone}
            hint={he.settings.profile.phoneHint}
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
            label={he.settings.profile.whatsappConsent}
          />
          {me.data.whatsappOptInAt && (
            <p className="text-xs text-muted">
              {he.settings.profile.consentGivenBefore}
              <span className="num">{formatDateTime(me.data.whatsappOptInAt)}</span>
              {he.settings.profile.consentGivenAfter}
            </p>
          )}
          <p className="text-xs text-muted">{he.settings.profile.whatsappComingSoon}</p>
        </div>

        <div className="flex gap-3">
          <Button type="submit" loading={saving} disabled={!dirty}>
            {he.common.save}
          </Button>
          {dirty && (
            <Button variant="ghost" onClick={() => (setForm(fromMe(me.data!)), setErrors({}))}>
              {he.settings.profile.discard}
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
