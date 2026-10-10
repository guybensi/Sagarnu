"use client";

import { endpoints, useContract } from "@sagarnu/api-client";
import { CONTRACT_STATUSES, todayIso, type ContractStatus } from "@sagarnu/domain";
import { formatDate, formatILS, he } from "@sagarnu/i18n";
import type { ScheduleItemDto } from "@sagarnu/schemas";
import {
  Camera,
  Check,
  ExternalLink,
  AtSign,
  FileText,
  Globe,
  Mail,
  Pencil,
  Phone,
  Plus,
  Receipt,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PaymentDialog } from "@/components/payments/payment-dialog";
import { Button } from "@/components/ui/button";
import { Badge, Spinner } from "@/components/ui/card";
import { ConfirmDialog, Drawer } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/form";
import { MoneyInput } from "@/components/ui/money-input";
import { isConfirmationRequired, toastError } from "@/lib/errors";
import { useCan } from "@/lib/use-event-id";
import { useRefreshEvent } from "@/lib/use-refresh";
import { ContractDialog } from "./contract-dialog";
import { scheduleTone } from "./status";

type Pending =
  | { kind: "status"; status: ContractStatus; count: number }
  | { kind: "delete"; paymentCount?: number; paidAgorot?: number }
  | { kind: "deletePayment"; id: string }
  | { kind: "deleteItem"; item: ScheduleItemDto };

function ScheduleItemRow({
  eventId,
  item,
  editable,
  onPay,
  onDelete,
}: {
  eventId: string;
  item: ScheduleItemDto;
  editable: boolean;
  onPay: () => void;
  onDelete: () => void;
}) {
  const refresh = useRefreshEvent(eventId);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(item.amountAgorot);
  const [date, setDate] = useState(item.dueDate ?? "");
  const overdue = item.status === "pending" && item.dueDate != null && item.dueDate < todayIso();

  const save = async () => {
    try {
      await endpoints.schedule.update(eventId, item.id, {
        amountAgorot: amount,
        percent: amount != null ? null : item.percent,
        dueDate: date || null,
        relativeAnchor: null,
        relativeDays: null,
      });
      await refresh();
      setEditing(false);
    } catch (e) {
      toastError(e);
    }
  };

  if (editing) {
    return (
      <li className="grid gap-2 rounded-xl border border-brand-200 bg-brand-50/50 p-3">
        <p className="text-sm font-medium">{item.label}</p>
        <div className="grid grid-cols-2 gap-2">
          <MoneyInput value={amount} onChange={setAmount} />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            ביטול
          </Button>
          <Button size="sm" onClick={save}>
            שמירה
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 rounded-xl border border-line p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{item.label}</span>
          <Badge tone={overdue ? "danger" : scheduleTone[item.status]}>
            {overdue ? "באיחור" : he.scheduleStatus[item.status]}
          </Badge>
        </div>
        <p className="num mt-0.5 text-xs text-muted">
          {item.dueDate ? formatDate(item.dueDate) : "ללא תאריך"}
          {item.relativeAnchor &&
            ` (${Math.abs(item.relativeDays ?? 0)} ימים ${item.relativeAnchor === "event" ? "לפני האירוע" : "אחרי החתימה"})`}
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
      {editable && item.status === "pending" && (
        <div className="flex">
          <Button size="icon" variant="ghost" aria-label="סמן כשולם" title="סמן כשולם" onClick={onPay}>
            <Check className="size-4 text-success" />
          </Button>
          <Button size="icon" variant="ghost" aria-label="עריכה" onClick={() => setEditing(true)}>
            <Pencil className="size-4 text-muted" />
          </Button>
          <Button size="icon" variant="ghost" aria-label="מחיקה" onClick={onDelete}>
            <Trash2 className="size-4 text-muted" />
          </Button>
        </div>
      )}
    </li>
  );
}

function AddScheduleItem({
  eventId,
  contractId,
  onDone,
}: {
  eventId: string;
  contractId: string;
  onDone: () => void;
}) {
  const refresh = useRefreshEvent(eventId);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!amount || !date) return toast.error("צריך סכום ותאריך");
    setSaving(true);
    try {
      await endpoints.schedule.add(eventId, contractId, {
        label: label.trim() || "תשלום",
        amountAgorot: amount,
        dueDate: date,
      });
      await refresh();
      onDone();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-2 rounded-xl border border-dashed border-brand-200 p-3">
      <Input
        placeholder="שם התשלום (למשל: תשלום שני)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <MoneyInput value={amount} onChange={setAmount} />
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDone}>
          ביטול
        </Button>
        <Button size="sm" onClick={save} loading={saving}>
          הוספה
        </Button>
      </div>
    </div>
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
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const c = contract.data;

  const changeStatus = async (status: ContractStatus, confirm = false) => {
    if (!c) return;
    setBusy(true);
    try {
      const updated = await endpoints.contracts.setStatus(eventId, c.id, status, confirm);
      setPending(null);
      await refresh();
      const cancelled = updated.schedule.filter((s) => s.status === "cancelled");
      if (status === "approved" && cancelled.length > 0) {
        toast("החוזה אושר מחדש", {
          description: `יש ${cancelled.length} מועדי תשלום שבוטלו. לשחזר אותם?`,
          action: {
            label: "שחזור",
            onClick: async () => {
              await Promise.all(
                cancelled.map((s) => endpoints.schedule.update(eventId, s.id, { status: "pending" })),
              );
              await refresh();
            },
          },
        });
      }
    } catch (e) {
      if (isConfirmationRequired(e))
        setPending({ kind: "status", status, count: Number(e.details?.pendingCount ?? 0) });
      else toastError(e);
    } finally {
      setBusy(false);
    }
  };

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
    if (pending.kind === "status") return changeStatus(pending.status, true);
    if (pending.kind === "delete") return remove(pending.paymentCount != null);
    setBusy(true);
    try {
      if (pending.kind === "deletePayment") await endpoints.payments.remove(eventId, pending.id);
      else await endpoints.schedule.remove(eventId, pending.item.id);
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
        description={c ? he.contractStatus[c.status] : undefined}
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
            {editable && (
              <Select
                aria-label="סטטוס"
                value={c.status}
                disabled={busy}
                onChange={(e) => changeStatus(e.target.value as ContractStatus)}
              >
                {CONTRACT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {he.contractStatus[s]}
                  </option>
                ))}
              </Select>
            )}

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
                {editable && !adding && (
                  <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
                    <Plus className="size-4" />
                    מועד
                  </Button>
                )}
              </div>
              <ul className="grid gap-2">
                {c.schedule.map((item) => (
                  <ScheduleItemRow
                    key={`${item.id}-${item.amountAgorot}-${item.dueDate}`}
                    eventId={eventId}
                    item={item}
                    editable={editable}
                    onPay={() => setPayFor({ itemId: item.id })}
                    onDelete={() => setPending({ kind: "deleteItem", item })}
                  />
                ))}
                {c.schedule.length === 0 && !adding && (
                  <li className="rounded-xl bg-soft p-4 text-center text-sm text-muted">
                    עוד אין מועדי תשלום
                  </li>
                )}
              </ul>
              {adding && (
                <div className="mt-2">
                  <AddScheduleItem eventId={eventId} contractId={c.id} onDone={() => setAdding(false)} />
                </div>
              )}
            </section>

            <section>
              <h3 className="mb-3 font-semibold">היסטוריית תשלומים</h3>
              <ul className="grid gap-2">
                {c.payments.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                    <div className="rounded-lg bg-success-soft p-2 text-success">
                      <Receipt className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="num text-sm font-semibold">{formatILS(p.amountAgorot)}</p>
                      <p className="text-xs text-muted">
                        <span className="num">{formatDate(p.paidOn)}</span> · {he.paymentMethod[p.method]}
                        {p.scheduleItemId &&
                          ` · ${c.schedule.find((s) => s.id === p.scheduleItemId)?.label ?? ""}`}
                      </p>
                    </div>
                    {[p.receiptUrl, p.confirmationUrl].filter(Boolean).map((href, i) => (
                      <a
                        key={i}
                        href={href!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted hover:text-ink"
                        aria-label={i === 0 ? "קבלה" : "אישור"}
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    ))}
                    {editable && (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="מחיקת תשלום"
                        onClick={() => setPending({ kind: "deletePayment", id: p.id })}
                      >
                        <X className="size-4 text-muted" />
                      </Button>
                    )}
                  </li>
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
          <ContractDialog eventId={eventId} contract={c} open={editOpen} onOpenChange={setEditOpen} />
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
        danger={pending?.kind !== "status"}
        loading={busy}
        onConfirm={runPending}
        title={
          pending?.kind === "status"
            ? `לשנות ל"${he.contractStatus[pending.status]}"?`
            : pending?.kind === "delete"
              ? "למחוק את החוזה?"
              : pending?.kind === "deletePayment"
                ? "למחוק את התשלום?"
                : "למחוק את מועד התשלום?"
        }
        confirmLabel={pending?.kind === "status" ? "כן, לשנות" : "מחיקה"}
        description={
          pending?.kind === "status" ? (
            <>
              {pending.count} מועדי תשלום שעוד לא שולמו יבוטלו, וגם התזכורות שלהם. תשלומים שכבר בוצעו נשמרים
              ונספרים בתקציב.
            </>
          ) : pending?.kind === "delete" ? (
            pending.paymentCount ? (
              <>
                לחוזה הזה רשומים {pending.paymentCount} תשלומים בסך{" "}
                <span className="num font-semibold">{formatILS(pending.paidAgorot)}</span>. הם יימחקו יחד
                איתו.
              </>
            ) : (
              "החוזה ומועדי התשלום שלו יימחקו."
            )
          ) : pending?.kind === "deleteItem" ? (
            `"${pending.item.label}" יוסר מפריסת התשלומים.`
          ) : (
            "התשלום יוסר מההיסטוריה ומהסיכומים."
          )
        }
      />
    </>
  );
}
