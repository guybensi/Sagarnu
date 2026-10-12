"use client";

import { ApiRequestError, endpoints, keys } from "@sagarnu/api-client";
import { formatDate, he } from "@sagarnu/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarHeart, LinkIcon, UserPlus } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { toastError } from "@/lib/errors";
import { withNext } from "@/lib/next-path";

function Message({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="rounded-full bg-brand-50 p-4 text-brand-500">
        <LinkIcon className="size-7" />
      </div>
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="text-sm leading-relaxed text-muted">{text}</p>
      {action}
    </div>
  );
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const session = authClient.useSession();
  const [joining, setJoining] = useState(false);
  const info = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => endpoints.invitations.info(token),
    retry: false,
  });

  if (info.isPending || session.isPending) return <Spinner />;

  if (info.error) {
    const notFound = info.error instanceof ApiRequestError && info.error.status === 404;
    return (
      <Message
        title={notFound ? he.invite.invalidLink : he.invite.loadFailed}
        text={notFound ? he.invite.invalidLinkHint : he.common.checkConnection}
        action={
          <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">
            {he.common.home}
          </Link>
        }
      />
    );
  }

  const invite = info.data;
  if (invite.status !== "valid") {
    const { title, text } = he.invite.status[invite.status];
    return (
      <Message
        title={title}
        text={text}
        action={
          <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">
            {he.common.home}
          </Link>
        }
      />
    );
  }

  const here = `/invite/${token}`;
  const join = async () => {
    setJoining(true);
    try {
      const res = await endpoints.invitations.accept(token);
      await Promise.all([
        qc.invalidateQueries({ queryKey: keys.events }),
        qc.invalidateQueries({ queryKey: keys.me }),
      ]);
      toast.success(he.invite.joined(invite.eventName));
      router.replace(`/e/${res.eventId}`);
    } catch (e) {
      toastError(e);
      await info.refetch();
      setJoining(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div className="rounded-full bg-brand-50 p-4 text-brand-500">
        <UserPlus className="size-7" />
      </div>
      <div>
        <p className="text-sm text-muted">{he.invite.invitedYou(invite.inviterName)}</p>
        <h1 className="mt-1 text-2xl font-bold">{invite.eventName}</h1>
        {invite.eventDate && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted">
            <CalendarHeart className="size-4" />
            <span className="num">{formatDate(invite.eventDate)}</span>
          </p>
        )}
        <p className="mt-3 text-sm">
          {he.invite.roleLabel}
          <span className="font-medium">{he.role[invite.role]}</span>
          {invite.role === "editor" ? he.invite.editorHint : he.invite.viewerHint}
        </p>
      </div>

      {session.data ? (
        <div className="flex w-full flex-col gap-3">
          <Button size="lg" onClick={join} loading={joining}>
            {he.invite.join}
          </Button>
          <p className="text-xs text-muted">
            {he.invite.signedInAs}
            <span className="num">{session.data.user.email}</span> ·{" "}
            <button
              type="button"
              className="underline hover:text-ink"
              onClick={async () => {
                await authClient.signOut();
                qc.clear();
                router.replace(withNext("/login", here));
              }}
            >
              {he.invite.notYou}
            </button>
          </p>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-3">
          <Link href={withNext("/signup", here)}>
            <Button size="lg" className="w-full">
              {he.invite.signupAndJoin}
            </Button>
          </Link>
          <Link href={withNext("/login", here)}>
            <Button size="lg" variant="secondary" className="w-full">
              {he.invite.haveAccount}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
