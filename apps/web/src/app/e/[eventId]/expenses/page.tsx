"use client";

import { endpoints, useEvent, useExpenses } from "@sagarnu/api-client";
import { payerKey, type PayerTotal } from "@sagarnu/domain";
import { formatDate, formatILS, he, payerLabel } from "@sagarnu/i18n";
import { AlertTriangle, Download, Wallet } from "lucide-react";
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
  const event = useEvent(eventId);
  const [openId, setOpenId] = useState<string | null>(null);
  /** `payerKey` of the payer to show, or null for everyone. */
  const [payerFilter, setPayerFilter] = useState<string | null>(null);

  if (expenses.isPending || event.isPending) return <Spinner />;
  if (expenses.error) return <p className="text-danger">{messageOf(expenses.error)}</p>;
  if (event.error) return <p className="text-danger">{messageOf(event.error)}</p>;
  const { summary, paidBy } = expenses.data;
  const keyOf = (t: PayerTotal) => payerKey(t.payer, t.payerName);
  const labelOf = (t: PayerTotal) => payerLabel(event.data, t.payer, t.payerName);
  const selected = paidBy.find((t) => keyOf(t) === payerFilter) ?? null;
  /** What the selected payer paid towards a contract; null when not filtering. */
  const paidBySelected = (row: (typeof expenses.data.rows)[number]) =>
    selected ? (row.paidBy.find((t) => keyOf(t) === keyOf(selected))?.amountAgorot ?? 0) : null;
  const rows = selected ? expenses.data.rows.filter((r) => (paidBySelected(r) ?? 0) > 0) : expenses.data.rows;

  const tiles = [
    { label: he.expenses.committed, value: summary.committedAgorot },
    { label: he.expenses.paid, value: summary.paidAgorot, tone: "text-success" },
    { label: he.expenses.leftToPay, value: summary.remainingAgorot, tone: "text-brand-600" },
    summary.budgetLeftAgorot != null
      ? {
          label: summary.isOverBudget ? he.expenses.overBudget : he.expenses.budgetLeft,
          value: Math.abs(summary.budgetLeftAgorot),
          tone: summary.isOverBudget ? "text-danger" : undefined,
        }
      : { label: he.expenses.budget, value: null },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{he.expenses.title}</h1>
          <p className="text-sm text-muted">{he.expenses.subtitle}</p>
        </div>
        {(expenses.data.rows.length > 0 || paidBy.length > 0) && (
          // An attachment: the browser downloads it and stays on this page. Follows the payer filter.
          <Button
            variant="secondary"
            onClick={() =>
              window.location.assign(endpoints.expenses.exportUrl(eventId, selected ? keyOf(selected) : null))
            }
          >
            <Download className="size-4" />
            {he.expenses.exportExcel}
          </Button>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <p className="text-xs text-muted">{t.label}</p>
            <p className={cn("num mt-1 text-xl font-bold sm:text-2xl", t.tone)}>
              {formatILS(t.value, he.expenses.notSet)}
            </p>
          </Card>
        ))}
      </div>

      {summary.paidInactiveAgorot > 0 && (
        <p className="mb-4 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
          {he.expenses.paidInactiveBefore}
          <span className="num font-semibold">{formatILS(summary.paidInactiveAgorot)}</span>
          {he.expenses.paidInactiveAfter}
        </p>
      )}

      {paidBy.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs text-muted">{he.expenses.paidByFilter}</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label={he.expenses.paidByFilter}>
            {[null, ...paidBy].map((t) => {
              const key = t ? keyOf(t) : null;
              const active = key === (selected ? keyOf(selected) : null);
              return (
                <button
                  key={key ?? "all"}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPayerFilter(key)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                    active
                      ? "border-brand-500 bg-brand-50 font-medium text-brand-700"
                      : "border-line hover:bg-soft",
                  )}
                >
                  {t ? (
                    <>
                      {labelOf(t)} · <span className="num">{formatILS(t.amountAgorot)}</span>
                    </>
                  ) : (
                    he.expenses.everyone
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selected && rows.length === 0 ? (
        <p className="rounded-xl bg-soft p-4 text-center text-sm text-muted">
          {he.expenses.nothingPaidBy(labelOf(selected))}
        </p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Wallet className="size-6" />}
          title={he.expenses.emptyTitle}
          description={he.expenses.emptyText}
          action={
            <Link href={`/e/${eventId}/contracts`}>
              <Button>{he.expenses.toContracts}</Button>
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
                  {he.expenses.columns.map((h) => (
                    <th key={h} className="px-4 py-3 text-start font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => {
                  const { contract: c, categoryName, nextDue, isOverdue } = row;
                  const paid = paidBySelected(row);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setOpenId(c.id)}
                      className="cursor-pointer hover:bg-soft/60"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">{c.vendorName}</p>
                        <p className="text-xs text-muted">{categoryName}</p>
                      </td>
                      <td className="num px-4 py-3">{formatILS(c.totalAmountAgorot)}</td>
                      <td
                        className="num px-4 py-3 text-success"
                        title={selected ? he.expenses.paidByOnly(labelOf(selected)) : undefined}
                      >
                        {formatILS(paid ?? c.paidAgorot)}
                      </td>
                      <td className="num px-4 py-3">
                        {c.overpaidAgorot > 0 ? (
                          <span className="text-warning">
                            {he.expenses.overpaid(formatILS(c.overpaidAgorot))}
                          </span>
                        ) : (
                          formatILS(c.remainingAgorot)
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isOverdue ? (
                          <Badge tone="danger">
                            <AlertTriangle className="size-3" />
                            {he.expenses.late}
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
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* Mobile: cards */}
          <div className="grid gap-3 md:hidden">
            {rows.map((row) => {
              const { contract: c, categoryName, nextDue, isOverdue } = row;
              const paid = paidBySelected(row);
              return (
                <button key={c.id} onClick={() => setOpenId(c.id)} className="text-start">
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{c.vendorName}</p>
                        <p className="text-xs text-muted">{categoryName}</p>
                      </div>
                      {isOverdue && <Badge tone="danger">{he.expenses.late}</Badge>}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted">{he.expenses.total}</p>
                        <p className="num font-semibold">{formatILS(c.totalAmountAgorot)}</p>
                      </div>
                      <div>
                        <p className="text-muted">
                          {selected ? he.expenses.paidByOnly(labelOf(selected)) : he.expenses.paid}
                        </p>
                        <p className="num font-semibold text-success">{formatILS(paid ?? c.paidAgorot)}</p>
                      </div>
                      <div>
                        <p className="text-muted">{he.expenses.left}</p>
                        <p className="num font-semibold">{formatILS(c.remainingAgorot)}</p>
                      </div>
                    </div>
                    {nextDue && !isOverdue && (
                      <p className="num mt-3 text-xs text-muted">
                        {he.expenses.nextShort}
                        {formatDate(nextDue.dueDate)} · {formatILS(nextDue.remainingAgorot)}
                      </p>
                    )}
                  </Card>
                </button>
              );
            })}
          </div>
        </>
      )}

      <VendorDrawer eventId={eventId} contractId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
