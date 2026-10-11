"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signInSchema, type SignInInput } from "@sagarnu/schemas";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { authErrorMessage, GoogleButton, isWrongCredentials, type AuthError } from "@/components/auth/shared";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient } from "@/lib/auth-client";
import { safeNext, withNext } from "@/lib/next-path";

function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [error, setError] = useState<AuthError>(null);
  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "", rememberMe: true },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const { error } = await authClient.signIn.email(values);
    if (error) return setError(error);
    router.replace(next ?? "/");
  });

  const email = form.watch("email");

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div>
        <h1 className="text-2xl font-bold">התחברות</h1>
        <p className="mt-1 text-sm text-muted">טוב לראות אותך שוב</p>
      </div>

      <GoogleButton />

      <Field label="אימייל" htmlFor="email" error={form.formState.errors.email && "אימייל לא תקין"}>
        <Input id="email" type="email" dir="ltr" autoComplete="email" {...form.register("email")} />
      </Field>
      <Field label="סיסמה" htmlFor="password" error={form.formState.errors.password && "צריך להזין סיסמה"}>
        <PasswordInput id="password" autoComplete="current-password" {...form.register("password")} />
      </Field>

      <div className="flex items-center justify-between">
        <Controller
          control={form.control}
          name="rememberMe"
          render={({ field }) => (
            <Checkbox checked={field.value} onChange={field.onChange} label="השאר אותי מחובר" />
          )}
        />
        <Link href="/forgot-password" className="text-sm text-brand-600 hover:underline">
          שכחתי סיסמה
        </Link>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          <p>{authErrorMessage(error)}</p>
          {isWrongCredentials(error) && (
            <p className="mt-1 text-ink">
              עוד לא נרשמת?{" "}
              <Link
                href={`/signup?email=${encodeURIComponent(email)}${next ? `&next=${encodeURIComponent(next)}` : ""}`}
                className="font-medium text-brand-600 underline"
              >
                יצירת חשבון
              </Link>{" "}
              · או בדקו את הסיסמה ונסו שוב
            </p>
          )}
          {error.code === "EMAIL_NOT_VERIFIED" && (
            <Link
              className="mt-1 inline-block font-medium underline"
              href={`/verify-email?email=${encodeURIComponent(email)}`}
            >
              שליחה חוזרת של קישור האימות
            </Link>
          )}
        </div>
      )}

      <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
        התחברות
      </Button>

      <p className="text-center text-sm text-muted">
        אין לך חשבון?{" "}
        <Link href={withNext("/signup", next)} className="font-medium text-brand-600 hover:underline">
          הרשמה
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
