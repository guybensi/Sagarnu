"use client";

import { useExpenses } from "@sagarnu/api-client";
import { formatDate, formatILS } from "@sagarnu/i18n";
import { AlertTriangle, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { VendorDrawer } from "@/components/contracts/vendor-drawer";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, Spinner } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { messageOf } from "@/lib/errors";
import { useEventId } from "@/lib/use-event-id";

export default function ExpensesPage() {
  const eventId = useEventId();
  const expenses = useExpenses(eventId);
  const [openId, setOpenId] = useState<string | null>(null);

  if (expenses.isPending) return <Spinner />;
  if (expenses.error) return <p className="text-danger">{messageOf(expenses.error)}</p>;
  const { summary, rows } = expenses.data;

  const tiles = [
    { label: "סה״כ חוזים", value: summary.committedAgorot },
    { label: "שולם", value: summary.paidAgorot, tone: "text-success" },
    { label: "נותר לשלם", value: summary.remainingAgorot, tone: "text-brand-600" },
    summary.budgetLeftAgorot != null
      ? {
          label: summary.isOverBudget ? "חריגה מהתקציב" : "יתרה בתקציב",
          value: Math.abs(summary.budgetLeftAgorot),
          tone: summary.isOverBudget ? "text-danger" : undefined,
        }
      : { label: "תקציב", value: null },
  ];

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold">הוצאות</h1>
        <p className="text-sm text-muted">חוזים מאושרים, מה שולם ומה נשאר</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <p className="text-xs text-muted">{t.label}</p>
            <p className={cn("num mt-1 text-xl font-bold sm:text-2xl", t.tone)}>
              {formatILS(t.value, "לא הוגדר")}
            </p>
          </Card>
        ))}
      </div>

      {summary.paidInactiveAgorot > 0 && (
        <p className="mb-4 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
          שולם לספקים שאינם פעילים (בוטלו או לא אושרו):{" "}
          <span className="num font-semibold">{formatILS(summary.paidInactiveAgorot)}</span>. הסכום כלול
          ב&quot;שולם&quot;.
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={<Wallet className="size-6" />}
          title="עוד אין חוזים מאושרים"
          description="חוזה מופיע כאן אחרי שמסמנים אותו כ״מאושר״"
          action={
            <Link href={`/e/${eventId}/contracts`}>
              <Button>לחוזים</Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* Desktop: table */}
          <Card className="hidden overflow-hidden p-0 md:block">
            <table className="w-full text-sm">
              <thead className="bg-soft text-muted">
                <tr className="text-start">
                  {["ספק", "סה״כ", "שולם", "נותר", "התשלום הבא"].map((h) => (
                    <th key={h} className="px-4 py-3 text-start font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ contract: c, categoryName, nextDue, isOverdue }) => (
                  <tr key={c.id} onClick={() => setOpenId(c.id)} className="cursor-pointer hover:bg-soft/60">
                    <td className="px-4 py-3">
                      <p className="font-medium">{c.vendorName}</p>
                      <p className="text-xs text-muted">{categoryName}</p>
                    </td>
                    <td className="num px-4 py-3">{formatILS(c.totalAmountAgorot)}</td>
                    <td className="num px-4 py-3 text-success">{formatILS(c.paidAgorot)}</td>
                    <td className="num px-4 py-3">
                      {c.overpaidAgorot > 0 ? (
                        <span className="text-warning">שולם ביתר {formatILS(c.overpaidAgorot)}</span>
                      ) : (
                        formatILS(c.remainingAgorot)
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isOverdue ? (
                        <Badge tone="danger">
                          <AlertTriangle className="size-3" />
                          באיחור
                        </Badge>
                      ) : nextDue ? (
                        <span className="num">
                          {formatDate(nextDue.dueDate)} · {formatILS(nextDue.remainingAgorot)}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile: cards */}
          <div className="grid gap-3 md:hidden">
            {rows.map(({ contract: c, categoryName, nextDue, isOverdue }) => (
              <button key={c.id} onClick={() => setOpenId(c.id)} className="text-start">
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{c.vendorName}</p>
                      <p className="text-xs text-muted">{categoryName}</p>
                    </div>
                    {isOverdue && <Badge tone="danger">באיחור</Badge>}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted">סה״כ</p>
                      <p className="num font-semibold">{formatILS(c.totalAmountAgorot)}</p>
                    </div>
                    <div>
                      <p className="text-muted">שולם</p>
                      <p className="num font-semibold text-success">{formatILS(c.paidAgorot)}</p>
                    </div>
                    <div>
                      <p className="text-muted">נותר</p>
                      <p className="num font-semibold">{formatILS(c.remainingAgorot)}</p>
                    </div>
                  </div>
                  {nextDue && !isOverdue && (
                    <p className="num mt-3 text-xs text-muted">
                      הבא: {formatDate(nextDue.dueDate)} · {formatILS(nextDue.remainingAgorot)}
                    </p>
                  )}
                </Card>
              </button>
            ))}
          </div>
        </>
      )}

      <VendorDrawer eventId={eventId} contractId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
