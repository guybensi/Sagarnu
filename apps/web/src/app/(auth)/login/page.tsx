"use client";

import { he } from "@sagarnu/i18n";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInSchema, type SignInInput } from "@sagarnu/schemas";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  authErrorMessage,
  GoogleButton,
  googleErrorMessage,
  isWrongCredentials,
  type AuthError,
} from "@/components/auth/shared";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient } from "@/lib/auth-client";
import { safeNext, withNext } from "@/lib/next-path";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const deleted = params.get("deleted") === "1";
  const googleError = googleErrorMessage(params.get("error"));
  const session = authClient.useSession();
  const [error, setError] = useState<AuthError>(null);
  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "", rememberMe: true },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const { error } = await authClient.signIn.email(values);
    if (error) return setError(error);
    // After a logout in this tab the cached session is still "signed out"; the next page would
    // send us straight back here.
    await session.refetch();
    router.replace(next ?? "/");
  });

  const email = form.watch("email");

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div>
        <h1 className="text-2xl font-bold">{he.auth.login.title}</h1>
        <p className="mt-1 text-sm text-muted">{he.auth.login.subtitle}</p>
      </div>
      {deleted && (
        <p role="status" className="rounded-xl bg-success-soft p-3 text-sm text-success">
          {he.auth.login.accountDeleted}
        </p>
      )}

      {googleError && (
        <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {googleError}
        </p>
      )}

      <GoogleButton />

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
        error={form.formState.errors.password && he.auth.passwordRequired}
      >
        <PasswordInput id="password" autoComplete="current-password" {...form.register("password")} />
      </Field>

      <div className="flex items-center justify-between">
        <Controller
          control={form.control}
          name="rememberMe"
          render={({ field }) => (
            <Checkbox checked={field.value} onChange={field.onChange} label={he.auth.login.rememberMe} />
          )}
        />
        <Link href="/forgot-password" className="text-sm text-brand-600 hover:underline">
          {he.auth.forgotPassword}
        </Link>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          <p>{authErrorMessage(error)}</p>
          {isWrongCredentials(error) && (
            <p className="mt-1 text-ink">
              {he.auth.login.notRegistered}{" "}
              <Link
                href={`/signup?email=${encodeURIComponent(email)}${next ? `&next=${encodeURIComponent(next)}` : ""}`}
                className="font-medium text-brand-600 underline"
              >
                {he.auth.login.createAccount}
              </Link>{" "}
              {he.auth.login.orCheckPassword}
            </p>
          )}
          {error.code === "EMAIL_NOT_VERIFIED" && (
            <Link
              className="mt-1 inline-block font-medium underline"
              href={`/verify-email?email=${encodeURIComponent(email)}`}
            >
              {he.auth.login.resendVerification}
            </Link>
          )}
        </div>
      )}

      <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
        {he.auth.login.submit}
      </Button>

      <p className="text-center text-sm text-muted">
        {he.auth.login.noAccount}{" "}
        <Link href={withNext("/signup", next)} className="font-medium text-brand-600 hover:underline">
          {he.auth.login.toSignup}
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
