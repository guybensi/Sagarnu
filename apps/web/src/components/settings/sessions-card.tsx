"use client";

import { endpoints, keys, useSessions } from "@sagarnu/api-client";
import { formatDateTime, he } from "@sagarnu/i18n";
import type { SessionDto } from "@sagarnu/schemas";
import { useQueryClient } from "@tanstack/react-query";
import { Laptop, MonitorSmartphone, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardTitle, Spinner } from "@/components/ui/card";
import { toastError } from "@/lib/errors";

/** "Chrome · Windows" from a user agent; good enough to recognize your own devices. */
export function describeDevice(ua: string | null): { label: string; mobile: boolean } {
  if (!ua) return { label: he.settings.sessions.unknownDevice, mobile: false };
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /SamsungBrowser/.test(ua)
      ? "Samsung Internet"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\/|CriOS/.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : null;
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : null;
  const label = [browser, os].filter(Boolean).join(" · ") || he.settings.sessions.unknownDevice;
  return { label, mobile: /iPhone|Android|Mobile/.test(ua) };
}

function SessionRow({ s, onRevoke, busy }: { s: SessionDto; onRevoke: () => void; busy: boolean }) {
  const { label, mobile } = describeDevice(s.userAgent);
  const Icon = mobile ? Smartphone : Laptop;
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <span className="rounded-xl bg-soft p-2.5 text-muted">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <span dir="ltr">{label}</span>
          {s.current && <Badge tone="success">{he.settings.sessions.thisDevice}</Badge>}
        </p>
        <p className="text-xs text-muted">
          {he.settings.sessions.signedIn}
          <span className="num">{formatDateTime(s.createdAt)}</span>
          {" · "}
          {he.settings.sessions.lastActive}
          <span className="num">{formatDateTime(s.lastActiveAt)}</span>
          {s.ipAddress && (
            <>
              {" · "}
              <span className="num" dir="ltr">
                {s.ipAddress}
              </span>
            </>
          )}
        </p>
      </div>
      {!s.current && (
        <Button variant="secondary" size="sm" loading={busy} onClick={onRevoke}>
          {he.settings.sessions.signOut}
        </Button>
      )}
    </li>
  );
}

export function SessionsCard() {
  const sessions = useSessions();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>, message: string) => {
    setBusy(key);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: keys.sessions });
      toast.success(message);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(null);
    }
  };

  const others = sessions.data?.filter((s) => !s.current).length ?? 0;
  return (
    <Card>
      <CardTitle
        icon={<MonitorSmartphone className="size-5" />}
        action={
          others > 0 && (
            <Button
              variant="ghost"
              size="sm"
              loading={busy === "all"}
              onClick={() => run("all", endpoints.me.revokeOtherSessions, he.settings.sessions.allSignedOut)}
            >
              {he.settings.sessions.signOutAll}
            </Button>
          )
        }
      >
        {he.settings.sessions.title}
      </CardTitle>
      {sessions.isPending ? (
        <Spinner />
      ) : (
        <ul className="divide-y divide-line">
          {sessions.data?.map((s) => (
            <SessionRow
              key={s.id}
              s={s}
              busy={busy === s.id}
              onRevoke={() =>
                run(s.id, () => endpoints.me.revokeSession(s.id), he.settings.sessions.signedOut)
              }
            />
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted">{he.settings.sessions.hint}</p>
    </Card>
  );
}
