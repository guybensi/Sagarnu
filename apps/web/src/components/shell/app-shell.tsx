"use client";

import { useEvent, useEvents, useMe } from "@sagarnu/api-client";
import { ApiRequestError } from "@sagarnu/api-client";
import { can } from "@sagarnu/domain";
import { formatDate } from "@sagarnu/i18n";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarHeart,
  ChevronDown,
  FileText,
  LayoutDashboard,
  LogOut,
  Plus,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { useEffect, type ReactNode } from "react";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { EmptyState, Spinner } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

const menuItem =
  "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-soft";

function EventSwitcher({ eventId }: { eventId: string }) {
  const events = useEvents();
  const me = useMe();
  const current = events.data?.find((e) => e.id === eventId);
  const canCreate = me.data?.userType === "planner";
  if (!events.data || (events.data.length < 2 && !canCreate)) {
    return <span className="truncate text-sm font-medium text-muted">{current?.name}</span>;
  }
  return (
    <DropdownMenu.Root dir="rtl">
      <DropdownMenu.Trigger asChild>
        <button className="flex max-w-56 items-center gap-1 truncate rounded-lg px-2 py-1 text-sm font-medium hover:bg-soft">
          <span className="truncate">{current?.name}</span>
          <ChevronDown className="size-4 shrink-0 text-muted" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 min-w-64 rounded-xl bg-surface p-1.5 shadow-xl"
        >
          {events.data.map((e) => (
            <DropdownMenu.Item key={e.id} asChild className={menuItem}>
              <Link href={`/e/${e.id}`}>
                <span className="flex-1 truncate">{e.name}</span>
                <span className="text-xs text-muted">{formatDate(e.eventDate, "")}</span>
              </Link>
            </DropdownMenu.Item>
          ))}
          {canCreate && (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.Item asChild className={cn(menuItem, "text-brand-600")}>
                <Link href="/onboarding">
                  <Plus className="size-4" />
                  אירוע חדש
                </Link>
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function UserMenu() {
  const me = useMe();
  const router = useRouter();
  const qc = useQueryClient();
  const initial = me.data?.name.trim().charAt(0) ?? "";
  return (
    <DropdownMenu.Root dir="rtl">
      <DropdownMenu.Trigger asChild>
        <button
          className="flex size-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700"
          aria-label="תפריט משתמש"
        >
          {initial}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-56 rounded-xl bg-surface p-1.5 shadow-xl"
        >
          <div className="px-3 py-2">
            <p className="text-sm font-medium">{me.data?.name}</p>
            <p className="num text-xs text-muted">{me.data?.email}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item
            className={menuItem}
            onSelect={async () => {
              await authClient.signOut();
              qc.clear();
              router.replace("/login");
            }}
          >
            <LogOut className="size-4" />
            התנתקות
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function AppShell({ eventId, children }: { eventId: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = authClient.useSession();
  const event = useEvent(eventId);

  useEffect(() => {
    if (!session.isPending && !session.data) router.replace("/login");
  }, [session.isPending, session.data, router]);

  const base = `/e/${eventId}`;
  const nav = [
    { href: base, label: "דשבורד", icon: LayoutDashboard },
    { href: `${base}/contracts`, label: "חוזים", icon: FileText },
    { href: `${base}/expenses`, label: "הוצאות", icon: Wallet },
    { href: `${base}/details`, label: "פרטי האירוע", short: "פרטים", icon: CalendarHeart },
    ...(can(event.data?.role, "members.manage")
      ? [{ href: `${base}/members`, label: "שיתוף", icon: Users }]
      : []),
  ];
  const isActive = (href: string) => (href === base ? pathname === base : pathname.startsWith(href));

  let content = children;
  if (session.isPending || event.isPending) content = <Spinner />;
  else if (event.error) {
    const notFound = event.error instanceof ApiRequestError && event.error.status === 404;
    content = (
      <EmptyState
        title={notFound ? "האירוע לא נמצא" : "לא הצלחנו לטעון את האירוע"}
        description={notFound ? "ייתכן שהוא נמחק או שאין לך גישה אליו." : "בדקו את החיבור ונסו שוב."}
        action={
          <Button variant="secondary" onClick={() => router.replace("/")}>
            למסך הראשי
          </Button>
        }
      />
    );
  }

  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link href="/" className="shrink-0">
            <Logo />
          </Link>
          <span className="h-6 w-px bg-line" />
          <div className="min-w-0 flex-1">
            <EventSwitcher eventId={eventId} />
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm transition-colors",
                  isActive(item.href)
                    ? "bg-brand-50 font-medium text-brand-700"
                    : "text-muted hover:bg-soft hover:text-ink",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{content}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:hidden">
        <div className="flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px]",
                isActive(item.href) ? "font-medium text-brand-600" : "text-muted",
              )}
            >
              <item.icon className="size-5" />
              {item.short ?? item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
