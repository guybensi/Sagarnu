"use client";

import { useDashboard } from "@sagarnu/api-client";
import { countdown, countdownTarget, type ExpenseSummary } from "@sagarnu/domain";
import { formatDate, formatILS, formatNumber } from "@sagarnu/i18n";
import type { DueItemDto, EventDto } from "@sagarnu/schemas";
import {
  AlertTriangle,
  CalendarClock,
  CalendarPlus,
  Check,
  MapPin,
  PiggyBank,
  Store,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PaymentDialog } from "@/components/payments/payment-dialog";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardTitle, Spinner } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { messageOf } from "@/lib/errors";
import { useCan, useEventId } from "@/lib/use-event-id";

function Countdown({ event }: { event: EventDto }) {
  const target = countdownTarget(event.eventDate, event.eventTime);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const base = "relative overflow-hidden rounded-card p-6 sm:p-8 text-white shadow-card";
  const bg = "bg-[linear-gradient(135deg,var(--color-brand-500),var(--color-brand-700))]";

  if (!target) {
    return (
      <div className={cn(base, bg)}>
        <p className="text-sm text-white/80">{event.name}</p>
        <h2 className="mt-1 text-2xl font-bold">עוד לא נקבע תאריך</h2>
        <p className="mt-1 text-sm text-white/80">כשתקבעו תאריך תופיע כאן ספירה לאחור</p>
        <Link href={`/e/${event.id}/details`}>
          <Button variant="secondary" className="mt-5 border-0">
            <CalendarPlus className="size-4" />
            הזנת תאריך
          </Button>
        </Link>
      </div>
    );
  }

  const left = countdown(target, now);
  const units = [
    { value: left.days, label: "ימים" },
    { value: left.hours, label: "שעות" },
    { value: left.minutes, label: "דקות" },
  ];

  return (
    <div className={cn(base, bg)}>
      <svg className="absolute -end-10 -top-10 size-56 opacity-10" viewBox="0 0 32 32" aria-hidden>
        <circle cx="12" cy="16" r="8" fill="none" stroke="white" strokeWidth="1.5" />
        <circle cx="20" cy="16" r="8" fill="none" stroke="white" strokeWidth="1.5" />
      </svg>
      <p className="text-sm text-white/80">{event.name}</p>
      {left.isPast ? (
        <h2 className="mt-1 text-3xl font-bold">מזל טוב! 🎉</h2>
      ) : (
        <div className="mt-3 flex gap-3 sm:gap-5">
          {units.map((u) => (
            <div
              key={u.label}
              className="min-w-20 rounded-2xl bg-white/15 px-4 py-3 text-center backdrop-blur-sm"
            >
              <p className="num text-3xl font-bold sm:text-4xl">{formatNumber(u.value)}</p>
              <p className="text-xs text-white/80">{u.label}</p>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/90">
        <span className="num">
          {formatDate(event.eventDate)}
          {event.eventTime && ` · ${event.eventTime}`}
        </span>
        {(event.venueName || event.city) && (
          <span className="flex items-center gap-1">
            <MapPin className="size-3.5" />
            {[event.venueName, event.city].filter(Boolean).join(", ")}
          </span>
        )}
      </p>
    </div>
  );
}

function BudgetCard({ summary }: { summary: ExpenseSummary }) {
  const budget = summary.budgetAgorot;
  const committed = summary.paidAgorot + summary.remainingAgorot;
  const scale = Math.max(budget ?? 0, committed, 1);
  const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;

  return (
    <Card>
      <CardTitle
        icon={<PiggyBank className="size-5" />}
        action={summary.isOverBudget && <Badge tone="danger">חריגה מהתקציב</Badge>}
      >
        מצב התקציב
      </CardTitle>
      <div className="flex h-4 overflow-hidden rounded-full bg-soft">
        <div className="bg-success" style={{ width: pct(summary.paidAgorot) }} title="שולם" />
        <div
          className="bg-brand-200"
          style={{ width: pct(summary.remainingAgorot) }}
          title="התחייבות שנותרה"
        />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="flex items-center gap-1.5 text-muted">
            <span className="size-2 rounded-full bg-success" />
            שולם
          </dt>
          <dd className="num mt-0.5 font-semibold">{formatILS(summary.paidAgorot)}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-muted">
            <span className="size-2 rounded-full bg-brand-200" />
            נותר לשלם
          </dt>
          <dd className="num mt-0.5 font-semibold">{formatILS(summary.remainingAgorot)}</dd>
        </div>
        <div>
          <dt className="text-muted">תקציב משוער</dt>
          <dd className="num mt-0.5 font-semibold">{formatILS(budget, "לא הוגדר")}</dd>
        </div>
        {summary.budgetLeftAgorot != null && (
          <div>
            <dt className="text-muted">{summary.isOverBudget ? "חריגה" : "יתרה בתקציב"}</dt>
            <dd className={cn("num mt-0.5 font-semibold", summary.isOverBudget && "text-danger")}>
              {formatILS(Math.abs(summary.budgetLeftAgorot))}
            </dd>
          </div>
        )}
      </dl>
    </Card>
  );
}

function DueRow({
  item,
  tone,
  onPay,
  canPay,
}: {
  item: DueItemDto;
  tone: "danger" | "brand";
  onPay: () => void;
  canPay: boolean;
}) {
  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.vendorName}</p>
        <p className="text-xs text-muted">
          {item.label} ·{" "}
          <span className={cn("num", tone === "danger" && "text-danger")}>{formatDate(item.dueDate)}</span>
        </p>
      </div>
      <span className="num text-sm font-semibold">{formatILS(item.remainingAgorot)}</span>
      {canPay && (
        <Button size="sm" variant={tone === "danger" ? "primary" : "secondary"} onClick={onPay}>
          <Check className="size-3.5" />
          {tone === "danger" ? "סמן כשולם" : "תשלום"}
        </Button>
      )}
    </li>
  );
}

export default function DashboardPage() {
  const eventId = useEventId();
  const dash = useDashboard(eventId);
  const canPay = useCan("payment.write");
  const [paying, setPayingItem] = useState<DueItemDto | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const setPaying = (item: DueItemDto) => {
    setPayingItem(item);
    setPayOpen(true);
  };

  if (dash.isPending) return <Spinner />;
  if (dash.error) return <p className="text-danger">{messageOf(dash.error)}</p>;
  const { event, summary, overdue, upcoming, vendors } = dash.data;
  const next = upcoming[0];

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Countdown event={event} />
      </div>

      <Card className="flex flex-col">
        <CardTitle icon={<CalendarClock className="size-5" />}>התשלום הקרוב</CardTitle>
        {next ? (
          <div className="flex flex-1 flex-col justify-between gap-4">
            <div>
              <p className="font-semibold">{next.vendorName}</p>
              <p className="text-sm text-muted">{next.label}</p>
              <p className="num mt-3 text-3xl font-bold text-brand-600">{formatILS(next.remainingAgorot)}</p>
              <p className="num text-sm text-muted">עד {formatDate(next.dueDate)}</p>
            </div>
            {canPay && (
              <Button variant="secondary" onClick={() => setPaying(next)}>
                הוספת תשלום
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">אין תשלומים מתוכננים. מועדי תשלום מוסיפים בחוזה של כל ספק.</p>
        )}
      </Card>

      {overdue.length > 0 && (
        <Card className="border border-danger/20 bg-danger-soft/40 lg:col-span-3">
          <CardTitle icon={<AlertTriangle className="size-5 text-danger" />}>
            <span className="text-danger">תשלומים שעבר מועדם</span>
          </CardTitle>
          <ul className="divide-y divide-danger/10">
            {overdue.map((item) => (
              <DueRow
                key={item.scheduleItemId}
                item={item}
                tone="danger"
                canPay={canPay}
                onPay={() => setPaying(item)}
              />
            ))}
          </ul>
        </Card>
      )}

      <div className="lg:col-span-2">
        <BudgetCard summary={summary} />
      </div>

      <Card>
        <CardTitle icon={<Store className="size-5" />}>ספקים</CardTitle>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { n: vendors.approved, label: "מאושרים", tone: "text-success" },
            { n: vendors.negotiating, label: "במו״מ", tone: "text-warning" },
            { n: vendors.quotes, label: "הצעות", tone: "text-muted" },
          ].map((v) => (
            <div key={v.label} className="rounded-2xl bg-soft py-3">
              <p className={cn("num text-2xl font-bold", v.tone)}>{v.n}</p>
              <p className="text-xs text-muted">{v.label}</p>
            </div>
          ))}
        </div>
        {vendors.missingCategories.length > 0 && (
          <>
            <p className="mt-4 mb-2 text-xs text-muted">עוד אין ספק מאושר:</p>
            <div className="flex flex-wrap gap-1.5">
              {vendors.missingCategories.map((c) => (
                <Link key={c.id} href={`/e/${eventId}/contracts?category=${c.id}`}>
                  <Badge className="hover:bg-brand-50 hover:text-brand-600">{c.nameHe}</Badge>
                </Link>
              ))}
            </div>
          </>
        )}
      </Card>

      {upcoming.length > 1 && (
        <Card className="lg:col-span-2">
          <CardTitle icon={<CalendarClock className="size-5" />}>תשלומים הבאים</CardTitle>
          <ul className="divide-y divide-line">
            {upcoming.slice(1).map((item) => (
              <DueRow
                key={item.scheduleItemId}
                item={item}
                tone="brand"
                canPay={canPay}
                onPay={() => setPaying(item)}
              />
            ))}
          </ul>
        </Card>
      )}

      <Card className={cn(upcoming.length <= 1 && "lg:col-span-3")}>
        <CardTitle
          icon={<Users className="size-5" />}
          action={
            <Link href={`/e/${eventId}/details`} className="text-sm text-brand-600 hover:underline">
              עריכה
            </Link>
          }
        >
          פרטי האירוע
        </CardTitle>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted">מוזמנים</dt>
            <dd className="num font-medium">{formatNumber(event.guestCount, "לא ידוע")}</dd>
          </div>
          <div>
            <dt className="text-muted">מקום</dt>
            <dd className="font-medium">{event.venueName ?? event.city ?? "לא ידוע"}</dd>
          </div>
        </dl>
      </Card>

      {/* Stays mounted after closing so its "next payment" prompt can show. */}
      {paying && (
        <PaymentDialog
          eventId={eventId}
          contractId={paying.contractId}
          scheduleItemId={paying.scheduleItemId}
          open={payOpen}
          onOpenChange={setPayOpen}
        />
      )}
    </div>
  );
}
