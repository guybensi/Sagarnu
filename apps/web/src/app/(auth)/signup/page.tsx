"use client";

import { he } from "@sagarnu/i18n";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUpSchema, type SignUpInput } from "@sagarnu/schemas";
import { Heart, Briefcase } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  authErrorMessage,
  GoogleButton,
  isExistingUser,
  PasswordChecklist,
  type AuthError,
} from "@/components/auth/shared";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient } from "@/lib/auth-client";
import { safeNext, withNext } from "@/lib/next-path";
import { cn } from "@/lib/cn";

const TYPES = [
  { value: "couple", label: he.auth.signup.couple, hint: he.auth.signup.coupleHint, icon: Heart },
  { value: "planner", label: he.auth.signup.planner, hint: he.auth.signup.plannerHint, icon: Briefcase },
] as const;

function SignUpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const session = authClient.useSession();
  const [error, setError] = useState<AuthError>(null);
  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: params.get("email") ?? "", password: "", userType: "couple" },
  });
  const password = form.watch("password");
  const passwordInvalid = !!form.formState.errors.password;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const { data, error } = await authClient.signUp.email({
      ...values,
      callbackURL: `${window.location.origin}${next ?? "/"}`,
    });
    if (error) return setError(error);
    // With email verification on, sign-up does not create a session yet.
    if (data && "token" in data && data.token) {
      // Refresh the cached session first (it may still say "signed out" after a logout in this tab).
      await session.refetch();
      router.replace(next ?? "/");
    } else router.replace(`/verify-email?email=${encodeURIComponent(values.email)}`);
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div>
        <h1 className="text-2xl font-bold">{he.auth.signup.title}</h1>
        <p className="mt-1 text-sm text-muted">{he.auth.signup.subtitle}</p>
      </div>

      <Controller
        control={form.control}
        name="userType"
        render={({ field }) => (
          <div className="grid grid-cols-2 gap-3" role="radiogroup">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={field.value === t.value}
                onClick={() => field.onChange(t.value)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-2xl border p-3.5 text-start transition-colors",
                  field.value === t.value
                    ? "border-brand-500 bg-brand-50 ring-3 ring-brand-100"
                    : "border-line hover:bg-soft",
                )}
              >
                <t.icon className="size-5 text-brand-500" />
                <span className="text-sm font-semibold">{t.label}</span>
                <span className="text-xs text-muted">{t.hint}</span>
              </button>
            ))}
          </div>
        )}
      />

      <GoogleButton />

      <Field label={he.auth.name} htmlFor="name" error={form.formState.errors.name && he.auth.nameTooShort}>
        <Input id="name" autoComplete="name" {...form.register("name")} />
      </Field>
      <Field
        label={he.auth.email}
        htmlFor="email"
        error={form.formState.errors.email && he.auth.invalidEmail}
      >
        <Input id="email" type="email" dir="ltr" autoComplete="email" {...form.register("email")} />
      </Field>
      <Field
        label={he.auth.password}
        htmlFor="password"
        error={passwordInvalid ? he.auth.passwordWeak : undefined}
      >
        <PasswordInput
          id="password"
          autoComplete="new-password"
          aria-invalid={passwordInvalid || undefined}
          {...form.register("password")}
        />
        <PasswordChecklist password={password} highlightFailed={passwordInvalid} />
      </Field>

      {error && (
        <div role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          <p>{authErrorMessage(error)}</p>
          {isExistingUser(error) && (
            <p className="mt-1 text-ink">
              <Link href="/login" className="font-medium text-brand-600 underline">
                {he.auth.signup.toLogin}
              </Link>{" "}
              ·{" "}
              <Link href="/forgot-password" className="font-medium text-brand-600 underline">
                {he.auth.forgotPassword}
              </Link>
            </p>
          )}
        </div>
      )}

      <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
        {he.auth.signup.submit}
      </Button>

      <p className="text-center text-sm text-muted">
        {he.auth.signup.haveAccount}{" "}
        <Link href={withNext("/login", next)} className="font-medium text-brand-600 hover:underline">
          {he.auth.signup.login}
        </Link>
      </p>
    </form>
  );
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
