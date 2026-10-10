"use client";

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
        <h1 className="text-xl font-bold">הקישור לא תקין</h1>
        <p className="text-sm text-muted">ייתכן שפג תוקפו. אפשר לבקש קישור חדש.</p>
        <Link href="/forgot-password" className="font-medium text-brand-600 hover:underline">
          שליחת קישור חדש
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
          ? "הסיסמאות לא זהות"
          : "הסיסמה לא עומדת בדרישות",
      );
    }
    setLoading(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setLoading(false);
    if (error) return setError(authErrorMessage(error));
    toast.success("הסיסמה עודכנה. אפשר להתחבר");
    router.replace("/login");
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">סיסמה חדשה</h1>
      <Field label="סיסמה חדשה" htmlFor="password">
        <PasswordInput
          id="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordChecklist password={password} />
      </Field>
      <Field label="אימות סיסמה" htmlFor="confirm">
        <PasswordInput
          id="confirm"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>
      {error && <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>}
      <Button type="submit" size="lg" loading={loading}>
        שמירת סיסמה
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
