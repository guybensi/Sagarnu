"use client";

import { endpoints, useContract } from "@sagarnu/api-client";
import { PAYMENT_METHODS, todayIso, type PaymentMethod } from "@sagarnu/domain";
import { formatDate, formatILS, he } from "@sagarnu/i18n";
import { paymentSchema, type PaymentResultDto } from "@sagarnu/schemas";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { MoneyInput } from "@/components/ui/money-input";
import { fieldErrors, isConfirmationRequired, toastError } from "@/lib/errors";
import { useRefreshEvent } from "@/lib/use-refresh";
import { NextPaymentPrompt } from "./next-payment-prompt";

interface FormState {
  amountAgorot: number | null;
  method: PaymentMethod;
  paidOn: string;
  scheduleItemId: string | null;
  receiptUrl: string;
  confirmationUrl: string;
  notes: string;
}

export function PaymentDialog({
  eventId,
  contractId,
  scheduleItemId,
  open,
  onOpenChange,
}: {
  eventId: string;
  contractId: string;
  scheduleItemId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const contract = useContract(eventId, open ? contractId : null);
  const refresh = useRefreshEvent(eventId);
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [overpay, setOverpay] = useState<number | null>(null);
  const [result, setResult] = useState<PaymentResultDto | null>(null);

  const openItems = contract.data?.schedule.filter((s) => s.status === "pending") ?? [];

  // Default amount: the selected (or next open) schedule item, otherwise the contract remainder.
  useEffect(() => {
    if (!open || !contract.data || form) return;
    const item = openItems.find((s) => s.id === scheduleItemId) ?? openItems.find((s) => s.dueDate) ?? null;
    setForm({
      amountAgorot: item?.remainingAgorot ?? contract.data.remainingAgorot ?? null,
      method: "bank_transfer",
      paidOn: todayIso(),
      scheduleItemId: item?.id ?? null,
      receiptUrl: "",
      confirmationUrl: "",
      notes: "",
    });
  }, [open, contract.data, form, openItems, scheduleItemId]);

  useEffect(() => {
    if (!open) {
      setForm(null);
      setErrors({});
    }
  }, [open]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const submit = async (confirmOverpay = false) => {
    if (!form) return;
    const parsed = paymentSchema.safeParse({
      amountAgorot: form.amountAgorot ?? 0,
      method: form.method,
      paidOn: form.paidOn,
      scheduleItemId: form.scheduleItemId,
      receiptUrl: form.receiptUrl.trim() || null,
      confirmationUrl: form.confirmationUrl.trim() || null,
      notes: form.notes.trim() || null,
      confirmOverpay,
    });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setSaving(true);
    try {
      const res = await endpoints.payments.create(eventId, contractId, parsed.data);
      setOverpay(null);
      await refresh();
      toast.success("התשלום נשמר");
      onOpenChange(false);
      if ((res.remainingAgorot ?? 0) > 0) setResult(res);
    } catch (e) {
      if (isConfirmationRequired(e)) setOverpay(Number(e.details?.overpaidAgorot ?? 0));
      else toastError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title="הוספת תשלום"
        description={contract.data?.vendorName}
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button onClick={() => submit()} loading={saving} disabled={!form}>
              שמירת תשלום
            </Button>
          </>
        }
      >
        {!form ? (
          <div className="py-10 text-center text-sm text-muted">טוען…</div>
        ) : (
          <div className="grid gap-4">
            {contract.data && contract.data.totalAmountAgorot != null && (
              <div className="flex justify-between rounded-xl bg-soft px-4 py-3 text-sm">
                <span className="text-muted">נותר לתשלום</span>
                <span className="num font-semibold">{formatILS(contract.data.remainingAgorot)}</span>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="סכום" htmlFor="amount" error={errors.amountAgorot}>
                <MoneyInput
                  id="amount"
                  value={form.amountAgorot}
                  onChange={(v) => set("amountAgorot", v)}
                  invalid={!!errors.amountAgorot}
                />
              </Field>
              <Field label="תאריך התשלום" htmlFor="paidOn" error={errors.paidOn}>
                <Input
                  id="paidOn"
                  type="date"
                  value={form.paidOn}
                  onChange={(e) => set("paidOn", e.target.value)}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="אופן תשלום" htmlFor="method">
                <Select
                  id="method"
                  value={form.method}
                  onChange={(e) => set("method", e.target.value as PaymentMethod)}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {he.paymentMethod[m]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="על חשבון מועד" htmlFor="item">
                <Select
                  id="item"
                  value={form.scheduleItemId ?? ""}
                  onChange={(e) => {
                    const item = openItems.find((s) => s.id === e.target.value);
                    set("scheduleItemId", item?.id ?? null);
                    if (item?.remainingAgorot) set("amountAgorot", item.remainingAgorot);
                  }}
                >
                  <option value="">ללא שיוך</option>
                  {openItems.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                      {s.dueDate ? ` · ${formatDate(s.dueDate)}` : ""}
                      {s.remainingAgorot != null ? ` · ${formatILS(s.remainingAgorot)}` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field
              label="קישור לקבלה"
              htmlFor="receiptUrl"
              error={errors.receiptUrl && "קישור לא תקין (https://…)"}
            >
              <Input
                id="receiptUrl"
                dir="ltr"
                placeholder="https://"
                value={form.receiptUrl}
                onChange={(e) => set("receiptUrl", e.target.value)}
              />
            </Field>
            <Field
              label="קישור לאישור העברה"
              htmlFor="confirmationUrl"
              error={errors.confirmationUrl && "קישור לא תקין (https://…)"}
            >
              <Input
                id="confirmationUrl"
                dir="ltr"
                placeholder="https://"
                value={form.confirmationUrl}
                onChange={(e) => set("confirmationUrl", e.target.value)}
              />
            </Field>
            <Field label="הערות" htmlFor="notes">
              <Textarea
                id="notes"
                className="min-h-16"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </Field>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={overpay != null}
        onOpenChange={(o) => !o && setOverpay(null)}
        title="התשלום עובר את סכום החוזה"
        description={
          <>
            אחרי התשלום הזה ישולם לספק <span className="num font-semibold">{formatILS(overpay)}</span> יותר
            מהסכום בחוזה. זה בסדר אם מדובר בתוספות או בטיפ.
          </>
        }
        confirmLabel="כן, לשמור"
        loading={saving}
        onConfirm={() => submit(true)}
      />

      <NextPaymentPrompt
        eventId={eventId}
        contractId={contractId}
        result={result}
        onClose={() => setResult(null)}
      />
    </>
  );
}
