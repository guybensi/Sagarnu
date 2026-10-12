"use client";

import { endpoints } from "@sagarnu/api-client";
import { addDaysIso, todayIso } from "@sagarnu/domain";
import { formatDate, formatILS, he } from "@sagarnu/i18n";
import type { PaymentResultDto } from "@sagarnu/schemas";
import { CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { MoneyInput } from "@/components/ui/money-input";
import { toastError } from "@/lib/errors";
import { useRefreshEvent } from "@/lib/use-refresh";

/**
 * After a payment with money still owed: confirm the next scheduled payment, or ask when it will be —
 * so reminders always have a date to work with.
 */
export function NextPaymentPrompt({
  eventId,
  contractId,
  result,
  onClose,
}: {
  eventId: string;
  contractId: string;
  result: PaymentResultDto | null;
  onClose: () => void;
}) {
  const refresh = useRefreshEvent(eventId);
  const next = result?.nextDue ?? null;
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!result) return;
    setEditing(!result.nextDue);
    setDate(result.nextDue?.dueDate ?? addDaysIso(todayIso(), 30));
    setAmount(result.nextDue?.remainingAgorot ?? result.remainingAgorot);
  }, [result]);

  const save = async () => {
    if (!date || !amount) return toast.error(he.payments.next.needDateAndAmount);
    setSaving(true);
    try {
      if (next) {
        // A fixed date replaces a relative one ("week before the event") once the user sets it explicitly.
        await endpoints.schedule.update(eventId, next.scheduleItemId, {
          dueDate: date,
          amountAgorot: amount,
          relativeAnchor: null,
          relativeDays: null,
        });
      } else {
        await endpoints.schedule.add(eventId, contractId, {
          label: he.payments.next.defaultLabel,
          dueDate: date,
          amountAgorot: amount,
          source: "next_payment_prompt",
        });
      }
      await refresh();
      toast.success(he.payments.next.saved);
      onClose();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={result != null}
      onOpenChange={(o) => !o && onClose()}
      title={next && !editing ? he.payments.next.title : he.payments.next.ask}
      description={he.payments.next.remaining(formatILS(result?.remainingAgorot))}
      footer={
        next && !editing ? (
          <>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              {he.payments.next.change}
            </Button>
            <Button onClick={onClose}>{he.common.ok}</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              {next ? he.common.cancel : he.payments.next.notYet}
            </Button>
            <Button onClick={save} loading={saving}>
              {he.common.save}
            </Button>
          </>
        )
      }
    >
      {next && !editing ? (
        <div className="flex items-center gap-4 rounded-2xl bg-brand-50 p-4">
          <CalendarClock className="size-8 text-brand-500" />
          <div>
            <p className="font-semibold">{next.label}</p>
            <p className="num text-lg font-bold text-brand-700">
              {formatDate(next.dueDate)} · {formatILS(next.remainingAgorot)}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={he.payments.date} htmlFor="nextDate">
            <Input id="nextDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={he.payments.amount} htmlFor="nextAmount">
            <MoneyInput id="nextAmount" value={amount} onChange={setAmount} />
          </Field>
        </div>
      )}
    </Dialog>
  );
}
