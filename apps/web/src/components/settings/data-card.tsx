"use client";

import { he } from "@sagarnu/i18n";
import { ApiRequestError, endpoints, useEvents, useMe } from "@sagarnu/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Download, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient } from "@/lib/auth-client";
import { messageOf } from "@/lib/errors";

type Blocking = { id: string; name: string }[];

function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const me = useMe();
  const events = useEvents();
  const qc = useQueryClient();
  const [password, setPassword] = useState("");
  const [sure, setSure] = useState(false);
  const [error, setError] = useState("");
  const [blocking, setBlocking] = useState<Blocking>([]);
  const [deleting, setDeleting] = useState(false);
  const hasPassword = me.data?.hasPassword ?? true;
  const owned = events.data?.filter((e) => e.role === "owner") ?? [];

  const close = (next: boolean) => {
    if (!next) {
      setPassword("");
      setSure(false);
      setError("");
      setBlocking([]);
    }
    onOpenChange(next);
  };

  const remove = async () => {
    setError("");
    setBlocking([]);
    if (hasPassword && !password) return setError(he.settings.data.passwordRequired);
    setDeleting(true);
    try {
      await endpoints.me.remove({ password: hasPassword ? password : undefined, confirm: true });
      qc.clear();
      // The server already removed the session; this clears the cookie. A full load (not the
      // router) so the signed-out guard cannot redirect first and keep "?next=/settings".
      await authClient.signOut().catch(() => {});
      window.location.replace("/login?deleted=1");
    } catch (e) {
      setDeleting(false);
      if (e instanceof ApiRequestError && e.code === "sole_owner") {
        setBlocking((e.details?.events as Blocking | undefined) ?? []);
        return;
      }
      setError(messageOf(e));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={he.settings.data.deleteAccount}
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            {he.common.cancel}
          </Button>
          <Button variant="danger" loading={deleting} disabled={!sure} onClick={remove}>
            {he.settings.data.deleteForever}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 text-sm leading-relaxed">
        <p>
          {he.settings.data.willDelete} {owned.length > 0 && he.settings.data.willDeleteOwned}{" "}
          <span className="font-medium">{he.settings.data.irreversible}</span>
        </p>
        <p className="text-muted">{he.settings.data.exportFirst}</p>

        {blocking.length > 0 && (
          <div role="alert" className="rounded-xl bg-warning-soft p-3 text-warning">
            <p className="font-medium">{he.settings.data.needOtherOwners}</p>
            <ul className="mt-1 list-disc ps-5">
              {blocking.map((ev) => (
                <li key={ev.id}>
                  <Link href={`/e/${ev.id}/members`} className="underline">
                    {ev.name}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs">{he.settings.data.needOtherOwnersHint}</p>
          </div>
        )}

        {hasPassword && (
          <Field label={he.settings.data.yourPassword} htmlFor="deletePassword">
            <PasswordInput
              id="deletePassword"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        )}
        <Checkbox checked={sure} onChange={setSure} label={he.settings.data.confirm} />
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}

export function DataCard() {
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <Card>
      <CardTitle icon={<ShieldCheck className="size-5" />}>{he.settings.data.title}</CardTitle>
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{he.settings.data.export}</p>
            <p className="text-xs text-muted">{he.settings.data.exportHint}</p>
          </div>
          {/* The response is an attachment, so the browser downloads it and stays on this page. */}
          <Button variant="secondary" onClick={() => window.location.assign(endpoints.me.exportUrl)}>
            <Download className="size-4" />
            {he.settings.data.export}
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <div>
            <p className="text-sm font-medium text-danger">{he.settings.data.deleteAccount}</p>
            <p className="text-xs text-muted">{he.settings.data.deleteHint}</p>
          </div>
          <Button variant="secondary" className="text-danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" />
            {he.settings.data.deleteAccount}
          </Button>
        </div>
      </div>
      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </Card>
  );
}
