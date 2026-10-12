"use client";

import { useMe } from "@sagarnu/api-client";
import { he } from "@sagarnu/i18n";
import { CircleCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { authClient, googleEnabled } from "@/lib/auth-client";

/**
 * Connects Google to an existing account. Signing in with Google cannot do this on its own while
 * the account's email is unverified (someone else could have registered that address first);
 * here the user is already signed in, so linking is safe.
 */
export function GoogleCard() {
  const me = useMe();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const result = params.get("google");
  const error = params.get("error");

  useEffect(() => {
    if (result === "linked") toast.success(he.settings.google.linked);
    else if (error)
      toast.error(
        error === "email_does_not_match" ? he.settings.google.emailMismatch : he.settings.google.failed,
      );
    if (result || error) window.history.replaceState(null, "", "/settings");
  }, [result, error]);

  if (!googleEnabled || !me.data) return null;

  const connect = async () => {
    setBusy(true);
    const origin = window.location.origin;
    const { error } = await authClient.linkSocial({
      provider: "google",
      callbackURL: `${origin}/settings?google=linked`,
      errorCallbackURL: `${origin}/settings`,
    });
    // On success the browser is already on its way to Google.
    if (error) {
      setBusy(false);
      toast.error(he.settings.google.failed);
    }
  };

  return (
    <Card>
      <CardTitle>{he.settings.google.title}</CardTitle>
      {me.data.hasGoogle ? (
        <p className="flex items-center gap-2 text-sm text-success">
          <CircleCheck className="size-4 shrink-0" />
          {he.settings.google.connected}
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">{he.settings.google.notConnected}</p>
          <Button variant="secondary" onClick={connect} loading={busy}>
            {he.settings.google.connect}
          </Button>
        </div>
      )}
    </Card>
  );
}
