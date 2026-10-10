"use client";

import { useMembers } from "@sagarnu/api-client";
import { he } from "@sagarnu/i18n";
import { UserPlus } from "lucide-react";
import { Badge, Card, CardTitle, Spinner } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { messageOf } from "@/lib/errors";
import { useEventId } from "@/lib/use-event-id";

export default function MembersPage() {
  const eventId = useEventId();
  const members = useMembers(eventId);

  if (members.isPending) return <Spinner />;
  if (members.error) return <p className="text-danger">{messageOf(members.error)}</p>;

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <div>
        <h1 className="text-2xl font-bold">שיתוף</h1>
        <p className="text-sm text-muted">מי עוד מנהל איתך את האירוע</p>
      </div>

      <Card>
        <CardTitle>חברים באירוע</CardTitle>
        <ul className="divide-y divide-line">
          {members.data.map((m) => (
            <li key={m.userId} className="flex items-center gap-3 py-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                {m.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{m.name}</p>
                <p className="num truncate text-xs text-muted">{m.email}</p>
              </div>
              <Badge tone={m.role === "owner" ? "brand" : "neutral"}>{he.role[m.role]}</Badge>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle icon={<UserPlus className="size-5" />} action={<Badge tone="brand">בקרוב</Badge>}>
          הזמנת שותף/ה
        </CardTitle>
        <p className="-mt-2 mb-4 text-sm text-muted">
          הזמנה במייל או בקישור. בן/בת הזוג, הורים או המפיק/ה יוכלו לצפות או לערוך.
        </p>
        <fieldset disabled className="grid gap-4 opacity-60 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
          <Field label="אימייל" htmlFor="inviteEmail">
            <Input id="inviteEmail" dir="ltr" type="email" placeholder="name@example.com" />
          </Field>
          <Field label="הרשאה" htmlFor="inviteRole">
            <Select id="inviteRole" defaultValue="editor">
              <option value="editor">{he.role.editor}</option>
              <option value="viewer">{he.role.viewer}</option>
            </Select>
          </Field>
          <Button>שליחת הזמנה</Button>
        </fieldset>
      </Card>
    </div>
  );
}
