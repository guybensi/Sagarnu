"use client";

import { he } from "@sagarnu/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Logo } from "@/components/brand";
import { authClient } from "@/lib/auth-client";
import { UserMenu } from "./app-shell";

/** Header + auth guard for signed-in screens outside an event ("my events", settings). */
export function PlainShell({ next, children }: { next: string; children: ReactNode }) {
  const router = useRouter();
  const session = authClient.useSession();

  useEffect(() => {
    if (!session.isPending && !session.data) router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [session.isPending, session.data, router, next]);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link href="/" aria-label={he.common.home}>
            <Logo />
          </Link>
          <div className="flex-1" />
          <UserMenu />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
