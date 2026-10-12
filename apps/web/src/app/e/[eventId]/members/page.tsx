"use client";

import {
  ApiRequestError,
  endpoints,
  keys,
  useEvent,
  useInvitations,
  useMe,
  useMembers,
} from "@sagarnu/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { ROLES, type Role } from "@sagarnu/domain";
import { formatDateTime, he } from "@sagarnu/i18n";
import { createInvitationSchema, type CreateInvitationResultDto, type MemberDto } from "@sagarnu/schemas";
import { Check, Copy, Mail, MessageCircle, UserMinus, UserPlus, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardTitle, Spinner } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { messageOf, toastError } from "@/lib/errors";
import { useEventId } from "@/lib/use-event-id";
import { useRefreshEvent } from "@/lib/use-refresh";

const INVITE_ROLES = ["editor", "viewer"] as const;
const ROLE_HINT: Record<Role, string> = he.members.roleHint;

function InviteResult({ result, eventName }: { result: CreateInvitationResultDto; eventName: string }) {
  const [copied, setCopied] = useState(false);
  const message = he.members.whatsappMessage(eventName, result.inviteUrl);
  const copy = async () => {
    await navigator.clipboard.writeText(result.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="mt-4 grid gap-3 rounded-2xl border border-brand-200 bg-brand-50/50 p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Check className="size-4 text-success" />
        {he.members.readyBefore}
        <span className="num">{result.invitation.email}</span>
        {he.members.readyAfter}
      </p>
      <p className="text-xs text-muted">
        {result.emailSent ? (
          <>
            <Mail className="me-1 inline size-3.5" />
            {he.members.emailSent}
          </>
        ) : (
          he.members.emailNotSent
        )}{" "}
        {he.members.linkValidity}
      </p>
      <div className="flex gap-2">
        <Input
          readOnly
          dir="ltr"
          value={result.inviteUrl}
          onFocus={(e) => e.target.select()}
          aria-label={he.members.inviteLink}
        />
        <Button variant="secondary" onClick={copy}>
          {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
          {copied ? he.members.copied : he.members.copy}
        </Button>
      </div>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 justify-self-start rounded-xl bg-[#25D366] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        <MessageCircle className="size-4" />
        {he.members.sendWhatsapp}
      </a>
    </div>
  );
}

function MembersView() {
  const eventId = useEventId();
  const highlight = useSearchParams().get("invite") === "1";
  const router = useRouter();
  const qc = useQueryClient();
  const event = useEvent(eventId);
  const me = useMe();
  const members = useMembers(eventId);
  const invitations = useInvitations(eventId);
  const refresh = useRefreshEvent(eventId);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof INVITE_ROLES)[number]>("editor");
  const [emailError, setEmailError] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<CreateInvitationResultDto | null>(null);
  const [removing, setRemoving] = useState<MemberDto | null>(null);

  if (members.isPending || event.isPending) return <Spinner />;
  if (members.error) return <p className="text-danger">{messageOf(members.error)}</p>;
  const owners = members.data.filter((m) => m.role === "owner").length;

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = createInvitationSchema.safeParse({ email, role });
    if (!parsed.success) return setEmailError(he.auth.invalidEmail);
    setEmailError("");
    setSending(true);
    try {
      setResult(await endpoints.invitations.create(eventId, parsed.data));
      setEmail("");
      await refresh();
    } catch (err) {
      if (err instanceof ApiRequestError && err.details?.reason === "already_member") {
        setEmailError(he.members.alreadyMember);
      } else toastError(err);
    } finally {
      setSending(false);
    }
  };

  const changeRole = async (member: MemberDto, next: Role) => {
    try {
      await endpoints.members.updateRole(eventId, member.userId, next);
      await refresh();
      toast.success(`${member.name}: ${he.role[next]}`);
    } catch (err) {
      if (err instanceof ApiRequestError && err.details?.reason === "last_owner") {
        toast.error(he.members.needOwner);
      } else toastError(err);
      await refresh();
    }
  };

  const remove = async () => {
    if (!removing) return;
    try {
      await endpoints.members.remove(eventId, removing.userId);
      if (removing.userId === me.data?.id) {
        // Left the event: it is no longer accessible, go back to the event list.
        await qc.invalidateQueries({ queryKey: keys.events });
        router.replace("/");
        return;
      }
      await refresh();
      setRemoving(null);
    } catch (err) {
      if (err instanceof ApiRequestError && err.details?.reason === "last_owner") {
        toast.error(he.members.needOwner);
      } else toastError(err);
    }
  };

  const revoke = async (id: string) => {
    try {
      await endpoints.invitations.revoke(eventId, id);
      await refresh();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <div>
        <h1 className="text-2xl font-bold">{he.members.title}</h1>
        <p className="text-sm text-muted">{he.members.subtitle}</p>
      </div>

      <Card className={cn(highlight && "ring-3 ring-brand-200")}>
        <CardTitle icon={<UserPlus className="size-5" />}>{he.members.inviteTitle}</CardTitle>
        <p className="-mt-2 mb-4 text-sm text-muted">
          {me.data?.userType === "planner" ? he.members.inviteCouple : he.members.inviteAnyone}
        </p>
        <form onSubmit={invite} className="grid gap-4 sm:grid-cols-[1fr_11rem_auto] sm:items-start">
          <Field label={he.auth.email} htmlFor="inviteEmail" error={emailError}>
            <Input
              id="inviteEmail"
              dir="ltr"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!emailError || undefined}
            />
          </Field>
          <Field label={he.members.role} htmlFor="inviteRole" hint={ROLE_HINT[role]}>
            <Select id="inviteRole" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              {INVITE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {he.role[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" loading={sending} className="sm:mt-6.5">
            {he.members.createInvite}
          </Button>
        </form>
        {result && <InviteResult result={result} eventName={event.data?.name ?? ""} />}
      </Card>

      {invitations.data && invitations.data.length > 0 && (
        <Card>
          <CardTitle>{he.members.pending}</CardTitle>
          <ul className="divide-y divide-line">
            {invitations.data.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="num truncate text-sm font-medium">{inv.email}</p>
                  <p className="text-xs text-muted">
                    {he.role[inv.role]}
                    {he.members.validUntil}
                    <span className="num">{formatDateTime(inv.expiresAt)}</span>
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => revoke(inv.id)}>
                  <X className="size-3.5" />
                  {he.common.cancel}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardTitle>{he.members.membersTitle}</CardTitle>
        <ul className="divide-y divide-line">
          {members.data.map((m) => {
            const isMe = m.userId === me.data?.id;
            const lastOwner = m.role === "owner" && owners <= 1;
            return (
              <li key={m.userId} className="flex flex-wrap items-center gap-3 py-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                  {m.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {m.name}
                    {isMe && <span className="ms-1.5 text-xs font-normal text-muted">{he.members.you}</span>}
                  </p>
                  <p className="num truncate text-xs text-muted">{m.email}</p>
                </div>
                {lastOwner ? (
                  <Badge tone="brand" className="shrink-0">
                    {he.role.owner}
                  </Badge>
                ) : (
                  <Select
                    aria-label={he.members.roleOf(m.name)}
                    className="h-9 w-36 shrink-0"
                    value={m.role}
                    onChange={(e) => changeRole(m, e.target.value as Role)}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {he.role[r]}
                      </option>
                    ))}
                  </Select>
                )}
                {!lastOwner && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={isMe ? he.members.leave : he.common.remove(m.name)}
                    onClick={() => setRemoving(m)}
                  >
                    <UserMinus className="size-4 text-muted" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        {owners <= 1 && <p className="mt-2 text-xs text-muted">{he.members.ownerRule}</p>}
      </Card>

      <ConfirmDialog
        open={removing != null}
        onOpenChange={(o) => !o && setRemoving(null)}
        danger
        title={
          removing?.userId === me.data?.id
            ? he.members.leaveTitle
            : he.members.removeTitle(removing?.name ?? "")
        }
        description={removing?.userId === me.data?.id ? he.members.leaveText : he.members.removeText}
        confirmLabel={removing?.userId === me.data?.id ? he.members.leaveConfirm : he.members.removeConfirm}
        onConfirm={remove}
      />
    </div>
  );
}

export default function MembersPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <MembersView />
    </Suspense>
  );
}
