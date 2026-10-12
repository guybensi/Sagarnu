"use client";

import { he } from "@sagarnu/i18n";
import { resetPasswordSchema } from "@sagarnu/schemas";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { authErrorMessage, PasswordChecklist } from "@/components/auth/shared";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient } from "@/lib/auth-client";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!token || params.get("error")) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-xl font-bold">{he.auth.reset.invalidTitle}</h1>
        <p className="text-sm text-muted">{he.auth.reset.invalidText}</p>
        <Link href="/forgot-password" className="font-medium text-brand-600 hover:underline">
          {he.auth.reset.requestNew}
        </Link>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = resetPasswordSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      return setError(
        parsed.error.issues.some((i) => i.message === "password_mismatch")
          ? he.fieldErrors.password_mismatch
          : he.auth.passwordWeak,
      );
    }
    setLoading(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setLoading(false);
    if (error) return setError(authErrorMessage(error));
    toast.success(he.auth.reset.done);
    router.replace("/login");
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">{he.auth.reset.title}</h1>
      <Field label={he.auth.reset.newPassword} htmlFor="password">
        <PasswordInput
          id="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordChecklist password={password} />
      </Field>
      <Field label={he.auth.reset.confirm} htmlFor="confirm">
        <PasswordInput
          id="confirm"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>
      {error && <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>}
      <Button type="submit" size="lg" loading={loading}>
        {he.auth.reset.submit}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
