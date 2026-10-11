"use client";

import { endpoints, useContract } from "@sagarnu/api-client";
import { todayIso } from "@sagarnu/domain";
import { formatDate, formatILS, he } from "@sagarnu/i18n";
import type { ScheduleItemDto } from "@sagarnu/schemas";
import { Camera, Check, AtSign, FileText, Globe, Mail, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PaymentDialog } from "@/components/payments/payment-dialog";
import { PaymentRow } from "@/components/payments/payment-row";
import { Button } from "@/components/ui/button";
import { Badge, Spinner } from "@/components/ui/card";
import { ConfirmDialog, Drawer } from "@/components/ui/dialog";
import { isConfirmationRequired, toastError } from "@/lib/errors";
import { useCan } from "@/lib/use-event-id";
import { useRefreshEvent } from "@/lib/use-refresh";
import { ContractDialog } from "./contract-dialog";
import { contractTone, scheduleTone } from "./status";

type Pending =
  { kind: "delete"; paymentCount?: number; paidAgorot?: number } | { kind: "deletePayment"; id: string };

/** "7 ימים לפני האירוע", "ביום החתימה", "יום אחרי האירוע" … */
export function relativeTiming(anchor: "event" | "signing", days: number): string {
  const what = anchor === "event" ? "האירוע" : "החתימה";
  if (days === 0) return `ביום ${what}`;
  const n = Math.abs(days);
  const count = n === 1 ? "יום" : `${n} ימים`;
  return `${count} ${days < 0 ? "לפני" : "אחרי"} ${what}`;
}

function ScheduleItemRow({
  item,
  canPay,
  onPay,
}: {
  item: ScheduleItemDto;
  canPay: boolean;
  onPay: () => void;
}) {
  const overdue = item.status === "pending" && item.dueDate != null && item.dueDate < todayIso();
  return (
    <li className="flex items-center gap-3 rounded-xl border border-line p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{item.label}</span>
          <Badge tone={overdue ? "danger" : scheduleTone[item.status]}>
            {overdue ? "באיחור" : he.scheduleStatus[item.status]}
          </Badge>
        </div>
        {/* Only the date is LTR; the Hebrew around it must keep RTL order. */}
        <p className="mt-0.5 text-xs text-muted">
          {item.dueDate ? <span className="num">{formatDate(item.dueDate)}</span> : "ללא תאריך"}
          {item.relativeAnchor && ` (${relativeTiming(item.relativeAnchor, item.relativeDays ?? 0)})`}
        </p>
      </div>
      <div className="text-end">
        <p className="num text-sm font-semibold">{formatILS(item.amountAgorot)}</p>
        {item.status === "pending" &&
          item.remainingAgorot != null &&
          item.remainingAgorot !== item.amountAgorot && (
            <p className="num text-xs text-muted">נותר {formatILS(item.remainingAgorot)}</p>
          )}
      </div>
      {canPay && item.status === "pending" && (
        <Button size="sm" variant="secondary" onClick={onPay}>
          <Check className="size-3.5 text-success" />
          סמן כשולם
        </Button>
      )}
    </li>
  );
}

export function VendorDrawer({
  eventId,
  contractId,
  onClose,
}: {
  eventId: string;
  contractId: string | null;
  onClose: () => void;
}) {
  const contract = useContract(eventId, contractId);
  const refresh = useRefreshEvent(eventId);
  const editable = useCan("contract.write");
  const [editOpen, setEditOpen] = useState(false);
  const [payFor, setPayFor] = useState<{ itemId: string | null } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const c = contract.data;

  const remove = async (confirm = false) => {
    if (!c) return;
    setBusy(true);
    try {
      await endpoints.contracts.remove(eventId, c.id, confirm);
      setPending(null);
      await refresh();
      toast.success("החוזה נמחק");
      onClose();
    } catch (e) {
      if (isConfirmationRequired(e)) {
        setPending({
          kind: "delete",
          paymentCount: Number(e.details?.paymentCount ?? 0),
          paidAgorot: Number(e.details?.paidAgorot ?? 0),
        });
      } else toastError(e);
    } finally {
      setBusy(false);
    }
  };

  const runPending = async () => {
    if (!pending) return;
    if (pending.kind === "delete") return remove(pending.paymentCount != null);
    setBusy(true);
    try {
      await endpoints.payments.remove(eventId, pending.id);
      await refresh();
      setPending(null);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  const links = c
    ? [
        { href: c.websiteUrl, icon: Globe, label: "אתר" },
        { href: c.instagramUrl, icon: Camera, label: "אינסטגרם" },
        { href: c.facebookUrl, icon: AtSign, label: "פייסבוק" },
        { href: c.contractUrl, icon: FileText, label: "החוזה" },
      ].filter((l): l is typeof l & { href: string } => !!l.href)
    : [];

  return (
    <>
      <Drawer
        open={contractId != null}
        onOpenChange={(o) => !o && onClose()}
        title={c?.vendorName ?? "…"}
        description={
          c ? <Badge tone={contractTone[c.status]}>{he.contractStatus[c.status]}</Badge> : undefined
        }
        footer={
          c &&
          editable && (
            <>
              <Button
                variant="ghost"
                className="me-auto text-danger"
                onClick={() => setPending({ kind: "delete" })}
              >
                <Trash2 className="size-4" />
                מחיקה
              </Button>
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" />
                עריכה
              </Button>
              <Button onClick={() => setPayFor({ itemId: null })}>
                <Plus className="size-4" />
                הוספת תשלום
              </Button>
            </>
          )
        }
      >
        {!c ? (
          <Spinner />
        ) : (
          <div className="grid gap-6">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "סה״כ", value: c.totalAmountAgorot },
                { label: "שולם", value: c.paidAgorot },
                {
                  label: c.overpaidAgorot > 0 ? "שולם ביתר" : "נותר",
                  value: c.overpaidAgorot > 0 ? c.overpaidAgorot : c.remainingAgorot,
                },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl bg-soft px-2 py-3">
                  <p className="text-xs text-muted">{s.label}</p>
                  <p className="num mt-0.5 text-sm font-bold">{formatILS(s.value)}</p>
                </div>
              ))}
            </div>

            {(c.vendorContactName || c.vendorPhone || c.vendorEmail || links.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {c.vendorPhone && (
                  <a
                    href={`tel:${c.vendorPhone}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-soft px-3 py-1.5 text-xs"
                  >
                    <Phone className="size-3.5" />
                    {c.vendorContactName ?? ""} <span className="num">{c.vendorPhone}</span>
                  </a>
                )}
                {c.vendorEmail && (
                  <a
                    href={`mailto:${c.vendorEmail}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-soft px-3 py-1.5 text-xs"
                  >
                    <Mail className="size-3.5" />
                    <span className="num">{c.vendorEmail}</span>
                  </a>
                )}
                {links.map((l) => (
                  <a
                    key={l.label}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-soft px-3 py-1.5 text-xs"
                  >
                    <l.icon className="size-3.5" />
                    {l.label}
                  </a>
                ))}
              </div>
            )}

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">מועדי תשלום</h3>
                {editable && (
                  <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}>
                    <Pencil className="size-4" />
                    עריכת המועדים
                  </Button>
                )}
              </div>
              <ul className="grid gap-2">
                {c.schedule.map((item) => (
                  <ScheduleItemRow
                    key={item.id}
                    item={item}
                    canPay={editable}
                    onPay={() => setPayFor({ itemId: item.id })}
                  />
                ))}
                {c.schedule.length === 0 && (
                  <li className="rounded-xl bg-soft p-4 text-center text-sm text-muted">
                    עוד אין מועדי תשלום
                  </li>
                )}
              </ul>
            </section>

            <section>
              <h3 className="mb-3 font-semibold">היסטוריית תשלומים</h3>
              <ul className="grid gap-2">
                {c.payments.map((p) => (
                  <PaymentRow
                    key={p.id}
                    eventId={eventId}
                    payment={p}
                    scheduleLabel={c.schedule.find((s) => s.id === p.scheduleItemId)?.label}
                    editable={editable}
                    onDelete={() => setPending({ kind: "deletePayment", id: p.id })}
                  />
                ))}
                {c.payments.length === 0 && (
                  <li className="rounded-xl bg-soft p-4 text-center text-sm text-muted">
                    עוד לא נרשמו תשלומים
                  </li>
                )}
              </ul>
            </section>

            {(c.includedItems.length > 0 ||
              c.excludedItems.length > 0 ||
              c.cancellationPolicy ||
              c.notes) && (
              <section className="grid gap-3 text-sm">
                {c.includedItems.length > 0 && (
                  <div>
                    <p className="mb-1 font-semibold">כלול</p>
                    <ul className="list-disc ps-5 text-muted">
                      {c.includedItems.map((i) => (
                        <li key={i}>{i}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {c.excludedItems.length > 0 && (
                  <div>
                    <p className="mb-1 font-semibold">לא כלול</p>
                    <ul className="list-disc ps-5 text-muted">
                      {c.excludedItems.map((i) => (
                        <li key={i}>{i}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {c.cancellationPolicy && (
                  <div>
                    <p className="mb-1 font-semibold">מדיניות ביטול</p>
                    <p className="whitespace-pre-line text-muted">{c.cancellationPolicy}</p>
                  </div>
                )}
                {c.notes && (
                  <div>
                    <p className="mb-1 font-semibold">הערות</p>
                    <p className="whitespace-pre-line text-muted">{c.notes}</p>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </Drawer>

      {c && (
        <>
          <ContractDialog
            eventId={eventId}
            contract={c}
            open={editOpen}
            onOpenChange={setEditOpen}
            initialMode="edit"
          />
          <PaymentDialog
            eventId={eventId}
            contractId={c.id}
            scheduleItemId={payFor?.itemId}
            open={payFor != null}
            onOpenChange={(o) => !o && setPayFor(null)}
          />
        </>
      )}

      <ConfirmDialog
        open={pending != null}
        onOpenChange={(o) => !o && setPending(null)}
        danger
        loading={busy}
        onConfirm={runPending}
        title={pending?.kind === "delete" ? "למחוק את החוזה?" : "למחוק את התשלום?"}
        confirmLabel="מחיקה"
        description={
          pending?.kind === "delete" ? (
            pending.paymentCount ? (
              <>
                לחוזה הזה רשומים {pending.paymentCount} תשלומים בסך{" "}
                <span className="num font-semibold">{formatILS(pending.paidAgorot)}</span>. הם יימחקו יחד
                איתו.
              </>
            ) : (
              "החוזה ומועדי התשלום שלו יימחקו."
            )
          ) : (
            "התשלום יוסר מההיסטוריה ומהסיכומים."
          )
        }
      />
    </>
  );
}
