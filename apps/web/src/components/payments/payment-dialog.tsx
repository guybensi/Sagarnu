"use client";

import { endpoints, useContract, useEvent } from "@sagarnu/api-client";
import {
  PAYMENT_FILE_KINDS,
  PAYMENT_METHODS,
  todayIso,
  type Payer,
  type PaymentFileKind,
  type PaymentMethod,
} from "@sagarnu/domain";
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
import { FilePick, type PickedFile } from "./file-pick";
import { NextPaymentPrompt } from "./next-payment-prompt";
import { PayerPicker } from "./payer-picker";

const NO_FILES: Record<PaymentFileKind, PickedFile | null> = { receipt: null, confirmation: null };

interface FormState {
  amountAgorot: number | null;
  method: PaymentMethod;
  paidOn: string;
  payer: Payer | null;
  payerName: string | null;
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
  const event = useEvent(eventId);
  const refresh = useRefreshEvent(eventId);
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [overpay, setOverpay] = useState<number | null>(null);
  const [result, setResult] = useState<PaymentResultDto | null>(null);
  const [files, setFiles] = useState<Record<PaymentFileKind, PickedFile | null>>(NO_FILES);

  const openItems = contract.data?.schedule.filter((s) => s.status === "pending") ?? [];

  // Default amount: the selected (or next open) schedule item, otherwise the contract remainder.
  useEffect(() => {
    if (!open || !contract.data || !event.data || form) return;
    const item = openItems.find((s) => s.id === scheduleItemId) ?? openItems.find((s) => s.dueDate) ?? null;
    setForm({
      amountAgorot: item?.remainingAgorot ?? contract.data.remainingAgorot ?? null,
      method: "bank_transfer",
      paidOn: todayIso(),
      // Where most payments come from, as answered in the questionnaire.
      payer: event.data.defaultPayer,
      payerName: event.data.defaultPayerName,
      scheduleItemId: item?.id ?? null,
      receiptUrl: "",
      confirmationUrl: "",
      notes: "",
    });
  }, [open, contract.data, event.data, form, openItems, scheduleItemId]);

  useEffect(() => {
    if (!open) {
      setForm(null);
      setErrors({});
      setFiles(NO_FILES);
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
      payer: form.payer,
      payerName: form.payer === "other" ? form.payerName?.trim() || null : null,
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
      // The payment is saved either way; a failed upload can be retried from the vendor panel.
      const uploads = PAYMENT_FILE_KINDS.flatMap((kind) => {
        const file = files[kind];
        return file
          ? [
              endpoints.payments.uploadFile(eventId, res.payment.id, {
                kind,
                name: file.name,
                dataUrl: file.dataUrl,
              }),
            ]
          : [];
      });
      const failed = (await Promise.allSettled(uploads)).filter((r) => r.status === "rejected").length;
      await refresh();
      if (failed) toast.warning(he.payments.savedFileFailed);
      else toast.success(he.payments.saved);
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
        title={he.payments.add}
        description={contract.data?.vendorName}
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {he.common.cancel}
            </Button>
            <Button onClick={() => submit()} loading={saving} disabled={!form}>
              {he.payments.submit}
            </Button>
          </>
        }
      >
        {!form ? (
          <div className="py-10 text-center text-sm text-muted">{he.payments.loading}</div>
        ) : (
          <div className="grid gap-4">
            {contract.data && contract.data.totalAmountAgorot != null && (
              <div className="flex justify-between rounded-xl bg-soft px-4 py-3 text-sm">
                <span className="text-muted">{he.payments.remaining}</span>
                <span className="num font-semibold">{formatILS(contract.data.remainingAgorot)}</span>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={he.payments.amount} htmlFor="amount" error={errors.amountAgorot}>
                <MoneyInput
                  id="amount"
                  value={form.amountAgorot}
                  onChange={(v) => set("amountAgorot", v)}
                  invalid={!!errors.amountAgorot}
                />
              </Field>
              <Field label={he.payments.paidOn} htmlFor="paidOn" error={errors.paidOn}>
                <Input
                  id="paidOn"
                  type="date"
                  value={form.paidOn}
                  onChange={(e) => set("paidOn", e.target.value)}
                />
              </Field>
            </div>
            {event.data && (
              <PayerPicker
                id="payer"
                label={he.payments.payer}
                couple={event.data}
                payer={form.payer}
                payerName={form.payerName}
                onChange={(payer, name) => setForm((f) => (f ? { ...f, payer, payerName: name } : f))}
              />
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={he.payments.method} htmlFor="method">
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
              <Field label={he.payments.forInstallment} htmlFor="item">
                <Select
                  id="item"
                  value={form.scheduleItemId ?? ""}
                  onChange={(e) => {
                    const item = openItems.find((s) => s.id === e.target.value);
                    set("scheduleItemId", item?.id ?? null);
                    if (item?.remainingAgorot) set("amountAgorot", item.remainingAgorot);
                  }}
                >
                  <option value="">{he.payments.noInstallment}</option>
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
              label={he.paymentFileKind.receipt}
              htmlFor="receiptUrl"
              error={errors.receiptUrl && he.payments.invalidLink}
              hint={he.payments.receiptHint}
            >
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
                <Input
                  id="receiptUrl"
                  dir="ltr"
                  placeholder="https://"
                  value={form.receiptUrl}
                  onChange={(e) => set("receiptUrl", e.target.value)}
                />
                <FilePick value={files.receipt} onChange={(f) => setFiles((s) => ({ ...s, receipt: f }))} />
              </div>
            </Field>
            <Field
              label={he.paymentFileKind.confirmation}
              htmlFor="confirmationUrl"
              error={errors.confirmationUrl && he.payments.invalidLink}
            >
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
                <Input
                  id="confirmationUrl"
                  dir="ltr"
                  placeholder="https://"
                  value={form.confirmationUrl}
                  onChange={(e) => set("confirmationUrl", e.target.value)}
                />
                <FilePick
                  value={files.confirmation}
                  onChange={(f) => setFiles((s) => ({ ...s, confirmation: f }))}
                />
              </div>
            </Field>
            <Field label={he.payments.notes} htmlFor="notes">
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
        title={he.payments.overpayTitle}
        description={
          <>
            {he.payments.overpayBefore}
            <span className="num font-semibold">{formatILS(overpay)}</span>
            {he.payments.overpayAfter}
          </>
        }
        confirmLabel={he.payments.overpayConfirm}
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
