"use client";

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
    if (hasPassword && !password) return setError("צריך להקליד סיסמה");
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
      title="מחיקת החשבון"
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            ביטול
          </Button>
          <Button variant="danger" loading={deleting} disabled={!sure} onClick={remove}>
            מחיקה לצמיתות
          </Button>
        </>
      }
    >
      <div className="grid gap-4 text-sm leading-relaxed">
        <p>
          החשבון, ההתחברויות וההרשאות שלך יימחקו.{" "}
          {owned.length > 0 && (
            <>
              אירועים שרק את/ה חבר/ה בהם יימחקו יחד עם כל החוזים, התשלומים והקבצים שלהם. אירועים משותפים
              נשארים אצל שאר החברים.
            </>
          )}{" "}
          <span className="font-medium">אי אפשר לבטל את זה.</span>
        </p>
        <p className="text-muted">כדאי להוריד קודם עותק של המידע (כפתור &quot;הורדת המידע שלי&quot;).</p>

        {blocking.length > 0 && (
          <div role="alert" className="rounded-xl bg-warning-soft p-3 text-warning">
            <p className="font-medium">קודם צריך למנות בעלים נוספים לאירועים המשותפים:</p>
            <ul className="mt-1 list-disc ps-5">
              {blocking.map((ev) => (
                <li key={ev.id}>
                  <Link href={`/e/${ev.id}/members`} className="underline">
                    {ev.name}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs">
              במסך השיתוף משנים את ההרשאה של אחד החברים ל&quot;בעלים&quot;, או מוחקים את האירוע.
            </p>
          </div>
        )}

        {hasPassword && (
          <Field label="הסיסמה שלך" htmlFor="deletePassword">
            <PasswordInput
              id="deletePassword"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        )}
        <Checkbox checked={sure} onChange={setSure} label="הבנתי, למחוק את החשבון שלי" />
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
      <CardTitle icon={<ShieldCheck className="size-5" />}>המידע שלי</CardTitle>
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">הורדת המידע שלי</p>
            <p className="text-xs text-muted">
              קובץ JSON עם הפרטים, האירועים, החוזים והתשלומים. הקבצים המצורפים נשארים להורדה מתוך האירוע.
            </p>
          </div>
          {/* The response is an attachment, so the browser downloads it and stays on this page. */}
          <Button variant="secondary" onClick={() => window.location.assign(endpoints.me.exportUrl)}>
            <Download className="size-4" />
            הורדת המידע שלי
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <div>
            <p className="text-sm font-medium text-danger">מחיקת החשבון</p>
            <p className="text-xs text-muted">מוחק את החשבון ואת האירועים שרק את/ה חבר/ה בהם.</p>
          </div>
          <Button variant="secondary" className="text-danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" />
            מחיקת החשבון
          </Button>
        </div>
      </div>
      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </Card>
  );
}
