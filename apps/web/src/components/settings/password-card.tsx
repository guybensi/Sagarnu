"use client";

import { he } from "@sagarnu/i18n";
import { keys, useMe } from "@sagarnu/api-client";
import { failedPasswordRules } from "@sagarnu/schemas";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { authErrorMessage, PasswordChecklist } from "@/components/auth/shared";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Checkbox, Field } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient } from "@/lib/auth-client";

export function PasswordCard() {
  const me = useMe();
  const qc = useQueryClient();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!me.data) return null;

  if (!me.data.hasPassword) {
    return (
      <Card>
        <CardTitle icon={<KeyRound className="size-5" />}>{he.settings.password.noPasswordTitle}</CardTitle>
        <p className="text-sm text-muted">
          {he.settings.password.googleOnly}{" "}
          <Link href="/forgot-password" className="font-medium text-brand-600 hover:underline">
            {he.settings.password.resetLink}
          </Link>
          .
        </p>
      </Card>
    );
  }

  const weak = failedPasswordRules(next).length > 0;
  const mismatch = confirm !== "" && confirm !== next;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    setError("");
    if (!current) return setError(he.settings.password.currentRequired);
    if (weak) return setError(he.settings.password.newWeak);
    if (next !== confirm) return setError(he.fieldErrors.password_mismatch);
    if (next === current) return setError(he.settings.password.sameAsCurrent);
    setSaving(true);
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: signOutOthers,
    });
    setSaving(false);
    if (error) return setError(authErrorMessage(error));
    setCurrent("");
    setNext("");
    setConfirm("");
    setTried(false);
    await qc.invalidateQueries({ queryKey: keys.sessions });
    toast.success(signOutOthers ? he.settings.password.updatedSignedOut : he.settings.password.updated);
  };

  return (
    <Card>
      <CardTitle icon={<KeyRound className="size-5" />}>{he.settings.password.title}</CardTitle>
      <form onSubmit={submit} className="grid gap-4 sm:max-w-md">
        <Field label={he.settings.password.current} htmlFor="currentPassword">
          <PasswordInput
            id="currentPassword"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <Field label={he.settings.password.new} htmlFor="newPassword">
          <PasswordInput
            id="newPassword"
            autoComplete="new-password"
            aria-invalid={(tried && weak) || undefined}
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </Field>
        <PasswordChecklist password={next} highlightFailed={tried} />
        <Field
          label={he.settings.password.confirm}
          htmlFor="confirmPassword"
          error={mismatch ? he.fieldErrors.password_mismatch : undefined}
        >
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            aria-invalid={mismatch || undefined}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <Checkbox
          checked={signOutOthers}
          onChange={setSignOutOthers}
          label={he.settings.password.signOutOthers}
        />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" loading={saving} className="justify-self-start">
          {he.settings.password.submit}
        </Button>
      </form>
    </Card>
  );
}
