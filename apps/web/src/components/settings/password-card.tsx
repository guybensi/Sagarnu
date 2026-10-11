"use client";

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
        <CardTitle icon={<KeyRound className="size-5" />}>סיסמה</CardTitle>
        <p className="text-sm text-muted">
          החשבון מחובר דרך Google ואין לו סיסמה. אפשר להוסיף סיסמה דרך{" "}
          <Link href="/forgot-password" className="font-medium text-brand-600 hover:underline">
            איפוס סיסמה
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
    if (!current) return setError("צריך להקליד את הסיסמה הנוכחית");
    if (weak) return setError("הסיסמה החדשה לא עומדת בדרישות");
    if (next !== confirm) return setError("הסיסמאות לא זהות");
    if (next === current) return setError("הסיסמה החדשה זהה לנוכחית");
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
    toast.success(signOutOthers ? "הסיסמה עודכנה, ושאר המכשירים נותקו" : "הסיסמה עודכנה");
  };

  return (
    <Card>
      <CardTitle icon={<KeyRound className="size-5" />}>שינוי סיסמה</CardTitle>
      <form onSubmit={submit} className="grid gap-4 sm:max-w-md">
        <Field label="סיסמה נוכחית" htmlFor="currentPassword">
          <PasswordInput
            id="currentPassword"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <Field label="סיסמה חדשה" htmlFor="newPassword">
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
          label="אימות הסיסמה החדשה"
          htmlFor="confirmPassword"
          error={mismatch ? "הסיסמאות לא זהות" : undefined}
        >
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            aria-invalid={mismatch || undefined}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <Checkbox checked={signOutOthers} onChange={setSignOutOthers} label="לנתק את כל שאר המכשירים" />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" loading={saving} className="justify-self-start">
          עדכון סיסמה
        </Button>
      </form>
    </Card>
  );
}
