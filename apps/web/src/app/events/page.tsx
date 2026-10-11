"use client";

import { useEvents, useMe } from "@sagarnu/api-client";
import { daysUntil, todayIso } from "@sagarnu/domain";
import { formatDate, formatNumber, he } from "@sagarnu/i18n";
import type { EventDto } from "@sagarnu/schemas";
import { CalendarHeart, MapPin, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Logo } from "@/components/brand";
import { UserMenu } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, Spinner } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

/** Upcoming first (soonest on top), then events without a date, then past ones. */
function sortEvents(events: EventDto[], today: string): EventDto[] {
  const rank = (e: EventDto) => (e.eventDate == null ? 1 : e.eventDate >= today ? 0 : 2);
  return [...events].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (rank(a) === 2
        ? (b.eventDate ?? "").localeCompare(a.eventDate ?? "")
        : (a.eventDate ?? "").localeCompare(b.eventDate ?? "")) ||
      a.name.localeCompare(b.name, "he"),
  );
}

function EventCard({ event, today }: { event: EventDto; today: string }) {
  const days = event.eventDate ? daysUntil(event.eventDate, today) : null;
  const place = [event.venueName, event.city].filter(Boolean).join(", ");
  return (
    <Link href={`/e/${event.id}`} className="group">
      <Card className="flex h-full flex-col gap-3 transition-shadow group-hover:shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold">{event.name}</p>
          {event.role !== "owner" && <Badge>{he.role[event.role]}</Badge>}
        </div>
        <div className="grid gap-1 text-sm text-muted">
          <p className="flex items-center gap-1.5">
            <CalendarHeart className="size-4" />
            {event.eventDate ? (
              <span className="num">{formatDate(event.eventDate)}</span>
            ) : (
              "עוד לא נקבע תאריך"
            )}
          </p>
          {place && (
            <p className="flex items-center gap-1.5">
              <MapPin className="size-4" />
              {place}
            </p>
          )}
          {event.guestCount != null && (
            <p className="flex items-center gap-1.5">
              <Users className="size-4" />
              <span className="num">{formatNumber(event.guestCount)}</span> מוזמנים
            </p>
          )}
        </div>
        {days != null && (
          <p
            className={cn(
              "mt-auto rounded-xl px-3 py-2 text-sm font-medium",
              days < 0
                ? "bg-soft text-muted"
                : days <= 30
                  ? "bg-warning-soft text-warning"
                  : "bg-brand-50 text-brand-700",
            )}
          >
            {days > 0 ? (
              <>
                <span className="num">{formatNumber(days)}</span> ימים לאירוע
              </>
            ) : days === 0 ? (
              "היום!"
            ) : (
              "האירוע עבר"
            )}
          </p>
        )}
      </Card>
    </Link>
  );
}

/** "האירועים שלי": a planner's home, listing every event they manage or were invited to. */
export default function EventsPage() {
  const router = useRouter();
  const session = authClient.useSession();
  const me = useMe();
  const events = useEvents();
  const today = todayIso();

  useEffect(() => {
    if (!session.isPending && !session.data) router.replace("/login?next=/events");
  }, [session.isPending, session.data, router]);

  const canCreate = me.data?.userType === "planner" || (events.data?.length ?? 0) === 0;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link href="/events">
            <Logo />
          </Link>
          <div className="flex-1" />
          <UserMenu />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">האירועים שלי</h1>
            <p className="text-sm text-muted">כל האירועים שאת/ה מנהל/ת או שהוזמנת אליהם</p>
          </div>
          {canCreate && (
            <Link href="/onboarding">
              <Button>
                <Plus className="size-4" />
                אירוע חדש
              </Button>
            </Link>
          )}
        </div>
        {events.isPending || session.isPending ? (
          <Spinner />
        ) : !events.data || events.data.length === 0 ? (
          <EmptyState
            icon={<CalendarHeart className="size-6" />}
            title="עוד אין אירועים"
            description="יוצרים אירוע, ממלאים את הפרטים ומזמינים את בני הזוג"
            action={
              <Link href="/onboarding">
                <Button>
                  <Plus className="size-4" />
                  אירוע חדש
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortEvents(events.data, today).map((e) => (
              <EventCard key={e.id} event={e} today={today} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
