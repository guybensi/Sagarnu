"use client";

import { he } from "@sagarnu/i18n";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { authErrorMessage } from "@/components/auth/shared";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return setError(authErrorMessage(error));
    setSent(true);
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="rounded-full bg-brand-50 p-4 text-brand-500">
          <MailCheck className="size-7" />
        </div>
        <h1 className="text-xl font-bold">{he.auth.forgot.sentTitle}</h1>
        <p className="text-sm text-muted">
          {he.auth.forgot.sentBefore}
          <span className="num">{email}</span>
          {he.auth.forgot.sentAfter}
        </p>
        <Link href="/login" className="text-sm font-medium text-brand-600 hover:underline">
          {he.auth.backToLogin}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">{he.auth.forgot.title}</h1>
        <p className="mt-1 text-sm text-muted">{he.auth.forgot.subtitle}</p>
      </div>
      <Field label={he.auth.email} htmlFor="email">
        <Input
          id="email"
          type="email"
          dir="ltr"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      {error && <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>}
      <Button type="submit" size="lg" loading={loading}>
        {he.auth.forgot.submit}
      </Button>
      <Link href="/login" className="text-center text-sm text-muted hover:underline">
        {he.auth.backToLogin}
      </Link>
    </form>
  );
}
