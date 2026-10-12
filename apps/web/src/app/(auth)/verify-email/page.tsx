"use client";

import { he } from "@sagarnu/i18n";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { authErrorMessage } from "@/components/auth/shared";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

function VerifyEmail() {
  const email = useSearchParams().get("email") ?? "";
  const [loading, setLoading] = useState(false);

  const resend = async () => {
    setLoading(true);
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: `${window.location.origin}/`,
    });
    setLoading(false);
    if (error) toast.error(authErrorMessage(error));
    else toast.success(he.auth.verify.resent);
  };

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="rounded-full bg-brand-50 p-4 text-brand-500">
        <MailCheck className="size-7" />
      </div>
      <h1 className="text-xl font-bold">{he.auth.verify.title}</h1>
      <p className="text-sm leading-relaxed text-muted">
        {he.auth.verify.sentBefore}
        {email && <span className="num font-medium text-ink">{email}</span>}
        {he.auth.verify.sentAfter}
      </p>
      {email && (
        <Button variant="secondary" onClick={resend} loading={loading}>
          {he.auth.verify.resend}
        </Button>
      )}
      <Link href="/login" className="text-sm text-muted hover:underline">
        {he.auth.backToLogin}
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}
