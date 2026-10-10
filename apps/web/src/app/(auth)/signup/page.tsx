"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signUpSchema, type SignUpInput } from "@sagarnu/schemas";
import { Heart, Briefcase } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { authErrorMessage, GoogleButton, PasswordChecklist } from "@/components/auth/shared";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

const TYPES = [
  { value: "couple", label: "אנחנו זוג", hint: "מתחתנים ומנהלים את התקציב", icon: Heart },
  { value: "planner", label: "מפיק/ת אירועים", hint: "מנהל/ת כמה אירועים", icon: Briefcase },
] as const;

export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "", userType: "couple" },
  });
  const password = form.watch("password");

  const onSubmit = form.handleSubmit(async (values) => {
    setError("");
    const { data, error } = await authClient.signUp.email({
      ...values,
      callbackURL: `${window.location.origin}/`,
    });
    if (error) return setError(authErrorMessage(error));
    // With email verification on, sign-up does not create a session yet.
    if (data && "token" in data && data.token) router.replace("/");
    else router.replace(`/verify-email?email=${encodeURIComponent(values.email)}`);
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div>
        <h1 className="text-2xl font-bold">יוצרים חשבון</h1>
        <p className="mt-1 text-sm text-muted">כמה פרטים ומתחילים לסגור ספקים</p>
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

      <Field label="שם" htmlFor="name" error={form.formState.errors.name && "לפחות 2 תווים"}>
        <Input id="name" autoComplete="name" {...form.register("name")} />
      </Field>
      <Field label="אימייל" htmlFor="email" error={form.formState.errors.email && "אימייל לא תקין"}>
        <Input id="email" type="email" dir="ltr" autoComplete="email" {...form.register("email")} />
      </Field>
      <Field label="סיסמה" htmlFor="password">
        <Input
          id="password"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          {...form.register("password")}
        />
        <PasswordChecklist password={password} />
      </Field>

      {error && <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>}

      <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
        הרשמה
      </Button>

      <p className="text-center text-sm text-muted">
        כבר יש לך חשבון?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          התחברות
        </Link>
      </p>
    </form>
  );
}
