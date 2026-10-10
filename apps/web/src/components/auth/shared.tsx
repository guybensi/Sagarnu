"use client";

import { failedPasswordRules, passwordRules, type PasswordRule } from "@sagarnu/schemas";
import { he } from "@sagarnu/i18n";
import { Check, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient, googleEnabled } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

const AUTH_ERRORS: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "האימייל או הסיסמה לא נכונים",
  USER_ALREADY_EXISTS: "כבר יש חשבון עם האימייל הזה",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "כבר יש חשבון עם האימייל הזה",
  EMAIL_NOT_VERIFIED: "צריך לאמת את כתובת האימייל. שלחנו לך קישור",
  PASSWORD_POLICY: "הסיסמה לא עומדת בדרישות",
  INVALID_TOKEN: "הקישור לא תקין או שפג תוקפו",
  TOO_MANY_REQUESTS: "יותר מדי ניסיונות. נסו שוב בעוד דקה",
};

export function authErrorMessage(error: { code?: string; status?: number } | null | undefined): string {
  if (!error) return "";
  if (error.status === 429) return AUTH_ERRORS.TOO_MANY_REQUESTS!;
  return (error.code && AUTH_ERRORS[error.code]) || "משהו השתבש. נסו שוב";
}

export function PasswordChecklist({ password }: { password: string }) {
  const failed = new Set(failedPasswordRules(password));
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
      {(Object.keys(passwordRules) as PasswordRule[]).map((rule) => {
        const ok = password.length > 0 && !failed.has(rule);
        return (
          <li key={rule} className={cn("flex items-center gap-1.5", ok ? "text-success" : "text-muted")}>
            {ok ? <Check className="size-3.5" /> : <Circle className="size-3" />}
            {he.fieldErrors[`password_${rule}`]}
          </li>
        );
      })}
    </ul>
  );
}

export function GoogleButton() {
  if (!googleEnabled) return null;
  return (
    <>
      <Button
        variant="secondary"
        size="lg"
        className="w-full"
        onClick={() =>
          authClient.signIn.social({ provider: "google", callbackURL: `${window.location.origin}/` })
        }
      >
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <path
            fill="#4285F4"
            d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z"
          />
          <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8z" />
          <path
            fill="#EA4335"
            d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z"
          />
        </svg>
        המשך עם Google
      </Button>
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        או
        <span className="h-px flex-1 bg-line" />
      </div>
    </>
  );
}
