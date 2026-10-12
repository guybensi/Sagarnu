"use client";

import { ApiRequestError, endpoints, useCategories, useEvent } from "@sagarnu/api-client";
import {
  CONTRACT_STATUSES,
  perGuestTotal,
  resolveDueDate,
  todayIso,
  PRICING_TYPES,
  VAT_MODES,
  type ContractStatus,
  type PricingType,
  type ScheduleStatus,
  type VatMode,
} from "@sagarnu/domain";
import { formatDate, formatILS, formatNumber, he } from "@sagarnu/i18n";
import {
  createContractSchema,
  scheduleItemSchema,
  updateContractSchema,
  type ContractDetailDto,
  type ScheduleItemDto,
  type ScheduleItemInput,
} from "@sagarnu/schemas";
import { AlertCircle, CalendarClock, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { z, type ZodError } from "zod";
import { Chips } from "@/components/event/event-fields";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { MoneyInput } from "@/components/ui/money-input";
import { fieldErrors, isConfirmationRequired, toastError } from "@/lib/errors";
import { useCan } from "@/lib/use-event-id";
import { useRefreshEvent } from "@/lib/use-refresh";
import { scheduleTone } from "./status";

type Timing = "date" | "before_event" | "after_event" | "after_signing";

interface ScheduleRow {
  key: number;
  /** Set for items that already exist on the contract. */
  id?: string;
  /** Paid or cancelled items are shown but cannot be edited. */
  status: ScheduleStatus;
  label: string;
  mode: "amount" | "percent";
  amountAgorot: number | null;
  percent: number | null;
  timing: Timing;
  dueDate: string;
  days: number | null;
}

interface FormState {
  categoryId: string;
  status: ContractStatus;
  vendorName: string;
  vendorContactName: string;
  vendorPhone: string;
  vendorEmail: string;
  vendorBusinessId: string;
  websiteUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  contractUrl: string;
  pricingType: PricingType;
  totalAmountAgorot: number | null;
  vatMode: VatMode;
  perGuestPriceAgorot: number | null;
  minGuests: number | null;
  signedOn: string;
  includedText: string;
  excludedText: string;
  cancellationPolicy: string;
  notes: string;
  schedule: ScheduleRow[];
}

let rowKey = 0;
const newRow = (label: string): ScheduleRow => ({
  key: ++rowKey,
  status: "pending",
  label,
  mode: "amount",
  amountAgorot: null,
  percent: null,
  timing: "date",
  dueDate: "",
  days: null,
});

/** Back from the API's resolved item to what the user originally entered. */
function rowFromItem(item: ScheduleItemDto): ScheduleRow {
  const relative = item.relativeAnchor != null && item.relativeDays != null;
  const days = item.relativeDays ?? 0;
  return {
    key: ++rowKey,
    id: item.id,
    status: item.status,
    label: item.label,
    mode: item.percent != null ? "percent" : "amount",
    amountAgorot: item.percent != null ? null : item.amountAgorot,
    percent: item.percent,
    timing: !relative
      ? "date"
      : item.relativeAnchor === "signing"
        ? "after_signing"
        : days > 0
          ? "after_event"
          : "before_event",
    dueDate: relative ? "" : (item.dueDate ?? ""),
    days: relative ? Math.abs(days) : null,
  };
}

function initialState(contract: ContractDetailDto | null, categoryId: string): FormState {
  return {
    categoryId: contract?.categoryId ?? categoryId,
    status: contract?.status ?? "approved",
    vendorName: contract?.vendorName ?? "",
    vendorContactName: contract?.vendorContactName ?? "",
    vendorPhone: contract?.vendorPhone ?? "",
    vendorEmail: contract?.vendorEmail ?? "",
    vendorBusinessId: contract?.vendorBusinessId ?? "",
    websiteUrl: contract?.websiteUrl ?? "",
    facebookUrl: contract?.facebookUrl ?? "",
    instagramUrl: contract?.instagramUrl ?? "",
    contractUrl: contract?.contractUrl ?? "",
    pricingType: contract?.pricingType ?? "fixed",
    totalAmountAgorot: contract?.totalAmountAgorot ?? null,
    vatMode: contract?.vatMode ?? "unknown",
    perGuestPriceAgorot: contract?.perGuestPriceAgorot ?? null,
    minGuests: contract?.minGuests ?? null,
    signedOn: contract?.signedOn ?? "",
    includedText: contract?.includedItems.join("\n") ?? "",
    excludedText: contract?.excludedItems.join("\n") ?? "",
    cancellationPolicy: contract?.cancellationPolicy ?? "",
    notes: contract?.notes ?? "",
    schedule: contract ? contract.schedule.map(rowFromItem) : [newRow(he.contract.firstInstallment)],
  };
}

const orNull = (s: string) => (s.trim() === "" ? null : s.trim());
/** People type "www.vendor.co.il"; links are always stored with a scheme. */
const urlOrNull = (s: string): string | null => {
  const t = s.trim();
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};
const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

const isEmptyRow = (r: ScheduleRow) =>
  r.amountAgorot == null && r.percent == null && !r.dueDate && r.days == null;

function toScheduleInput(row: ScheduleRow): ScheduleItemInput {
  const relative = row.timing !== "date";
  return {
    label: row.label.trim() || he.contract.installment,
    amountAgorot: row.mode === "amount" ? row.amountAgorot : null,
    percent: row.mode === "percent" ? row.percent : null,
    dueDate: relative ? null : orNull(row.dueDate),
    relativeAnchor: !relative ? null : row.timing === "after_signing" ? "signing" : "event",
    relativeDays: !relative || row.days == null ? null : row.timing === "before_event" ? -row.days : row.days,
  };
}

/** The date a relative row resolves to right now; it follows later changes to the event or signing date. */
function ComputedDueDate({
  row,
  eventDate,
  signedOn,
}: {
  row: ScheduleRow;
  eventDate: string | null;
  signedOn: string;
}) {
  const bySigning = row.timing === "after_signing";
  const anchor = bySigning ? orNull(signedOn) : eventDate;
  if (!anchor) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <CalendarClock className="size-3.5 shrink-0" />
        {bySigning ? he.contract.computedAfterSigning : he.contract.computedAfterEventDate}
      </p>
    );
  }
  if (row.days == null) return null;
  const { relativeAnchor = null, relativeDays = null } = toScheduleInput(row);
  const due = resolveDueDate(
    { dueDate: null, relativeAnchor, relativeDays },
    { eventDate, signingDate: orNull(signedOn) },
  );
  if (!due) return null;
  const past = due < todayIso();
  return (
    <p
      className={cn("flex items-center gap-1.5 text-xs", past ? "text-warning" : "text-muted")}
      data-testid={`schedule-${row.key}-computed`}
    >
      <CalendarClock className="size-3.5 shrink-0" />
      <span>
        {he.contract.fallsOn}
        <span className="num font-medium text-ink">{formatDate(due)}</span>
        {past ? he.contract.alreadyPast : bySigning ? "" : he.contract.followsEventDate}
      </span>
    </p>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4">
      <h3 className="text-sm font-semibold text-brand-600">{title}</h3>
      {children}
    </section>
  );
}

/** Field → [Hebrew name, id of the input to focus]. */
const FIELD_INFO: Record<string, [string, string]> = {
  vendorName: [he.contract.fields.vendorName, "vendorName"],
  categoryId: [he.contract.fields.categoryId, "categoryId"],
  vendorContactName: [he.contract.fields.vendorContactName, "vendorContactName"],
  vendorPhone: [he.contract.fields.vendorPhone, "vendorPhone"],
  vendorEmail: [he.contract.fields.vendorEmailIssue, "vendorEmail"],
  vendorBusinessId: [he.contract.fields.vendorBusinessId, "vendorBusinessId"],
  websiteUrl: [he.contract.fields.websiteUrl, "websiteUrl"],
  instagramUrl: [he.contract.fields.instagramUrl, "instagramUrl"],
  facebookUrl: [he.contract.fields.facebookUrl, "facebookUrl"],
  contractUrl: [he.contract.fields.contractUrlIssue, "contractUrl"],
  totalAmountAgorot: [he.contract.fields.totalAmountAgorot, "total"],
  perGuestPriceAgorot: [he.contract.fields.perGuestPriceAgorot, "perGuest"],
  minGuests: [he.contract.fields.minGuests, "minGuests"],
  vatMode: [he.contract.fields.vatMode, "vat"],
  signedOn: [he.contract.fields.signedOn, "signedOn"],
  includedItems: [he.contract.fields.includedItems, "included"],
  excludedItems: [he.contract.fields.excludedItems, "excluded"],
  cancellationPolicy: [he.contract.fields.cancellationPolicy, "cancellation"],
  notes: [he.contract.fields.notes, "contractNotes"],
};

const SCHEDULE_FIELD: Record<string, [string, string]> = {
  label: [he.contract.scheduleFields.label, "label"],
  amountAgorot: [he.contract.scheduleFields.amountAgorot, "amount"],
  percent: [he.contract.scheduleFields.percent, "percent"],
  dueDate: [he.contract.scheduleFields.dueDate, "date"],
  relativeDays: [he.contract.scheduleFields.relativeDays, "days"],
};

interface FormIssue {
  key: string;
  label: string;
  targetId: string;
}

/**
 * Turns validation paths (`vendorEmail`, `schedule.1.amountAgorot`) into named, clickable issues.
 * `rowKeys[i]` is the form row behind schedule item i (empty rows are not sent, so indices shift).
 */
function describeIssues(paths: string[], rowKeys: number[], allRowKeys: number[]): FormIssue[] {
  const out = new Map<string, FormIssue>();
  for (const path of paths) {
    const [head = path, index, field] = path.split(".");
    if (head === "schedule" && index !== undefined) {
      const rowKey = rowKeys[Number(index)] ?? -1;
      const position = allRowKeys.indexOf(rowKey) + 1 || Number(index) + 1;
      const [fieldName, suffix] = SCHEDULE_FIELD[field ?? ""] ?? [he.contract.otherDetails, "label"];
      const key = `schedule.${rowKey}.${suffix}`;
      out.set(key, {
        key,
        label: he.contract.scheduleIssue(position, fieldName),
        targetId: `schedule-${rowKey}-${suffix}`,
      });
    } else {
      const [label, targetId] = FIELD_INFO[head] ?? [head, "vendorName"];
      out.set(head, { key: head, label, targetId });
    }
  }
  return [...out.values()];
}

function focusField(id: string) {
  const el = document.getElementById(id);
  el?.scrollIntoView({ block: "center", behavior: "smooth" });
  el?.focus({ preventScroll: true });
}

const scheduleListSchema = z.array(scheduleItemSchema);

export type ContractDialogMode = "view" | "edit";

/**
 * The contract form. A new contract opens in edit mode; an existing one opens locked ("view") and
 * is unlocked with "עריכה". Saving writes the fields, the payment schedule and the status together.
 */
export function ContractDialog({
  eventId,
  contract,
  defaultCategoryId,
  open,
  onOpenChange,
  onSaved,
  initialMode,
  onOpenPayments,
}: {
  eventId: string;
  contract: ContractDetailDto | null;
  defaultCategoryId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (contract: ContractDetailDto) => void;
  initialMode?: ContractDialogMode;
  /** Shown in view mode: jump to the vendor panel (payments, receipts). */
  onOpenPayments?: () => void;
}) {
  const categories = useCategories(eventId);
  const event = useEvent(eventId);
  const refresh = useRefreshEvent(eventId);
  const canWrite = useCan("contract.write");
  const [mode, setMode] = useState<ContractDialogMode>(contract ? "view" : "edit");
  const [form, setForm] = useState<FormState>(() => initialState(contract, defaultCategoryId ?? ""));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [issues, setIssues] = useState<FormIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [statusConfirm, setStatusConfirm] = useState<{ status: ContractStatus; count: number } | null>(null);
  const invalid = new Set(issues.map((i) => i.key));
  const editing = mode === "edit";
  const wasOpen = useRef(false);

  const reset = (next: ContractDialogMode) => {
    const fallback = defaultCategoryId ?? categories.data?.find((c) => c.isRelevant)?.id ?? "";
    setForm(initialState(contract, fallback));
    setErrors({});
    setIssues([]);
    setMode(next);
  };

  // On open: start in the requested mode. While viewing: follow fresh data (e.g. after a payment).
  // While editing: never overwrite what the user is typing.
  useEffect(() => {
    if (open && !wasOpen.current) reset(initialMode ?? (contract ? "view" : "edit"));
    else if (open && mode === "view") reset("view");
    wasOpen.current = open;
  }, [open, contract, categories.data]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setRow = (key: number, patch: Partial<ScheduleRow>) =>
    set(
      "schedule",
      form.schedule.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );

  const guests = event.data?.guestCount ?? null;
  const suggested =
    form.pricingType === "per_guest" && form.perGuestPriceAgorot
      ? perGuestTotal(form.perGuestPriceAgorot, guests, form.minGuests)
      : null;

  const fields = () => ({
    categoryId: form.categoryId,
    vendorName: form.vendorName,
    vendorContactName: orNull(form.vendorContactName),
    vendorPhone: orNull(form.vendorPhone),
    vendorEmail: orNull(form.vendorEmail),
    vendorBusinessId: orNull(form.vendorBusinessId),
    websiteUrl: urlOrNull(form.websiteUrl),
    facebookUrl: urlOrNull(form.facebookUrl),
    instagramUrl: urlOrNull(form.instagramUrl),
    contractUrl: urlOrNull(form.contractUrl),
    pricingType: form.pricingType,
    totalAmountAgorot: form.totalAmountAgorot,
    vatMode: form.vatMode,
    perGuestPriceAgorot: form.pricingType === "per_guest" ? form.perGuestPriceAgorot : null,
    minGuests: form.pricingType === "per_guest" ? form.minGuests : null,
    signedOn: orNull(form.signedOn),
    includedItems: lines(form.includedText),
    excludedItems: lines(form.excludedText),
    cancellationPolicy: orNull(form.cancellationPolicy),
    notes: orNull(form.notes),
  });

  /** Leaving "approved" cancels future installments, so the server asks for confirmation first. */
  const applyStatus = async (c: ContractDetailDto, status: ContractStatus, confirm: boolean) => {
    const updated = await endpoints.contracts.setStatus(eventId, c.id, status, confirm);
    const cancelled = updated.schedule.filter((s) => s.status === "cancelled");
    if (status === "approved" && cancelled.length > 0) {
      toast(he.contract.reapproved, {
        description: he.contract.restoreCancelled(cancelled.length),
        action: {
          label: he.contract.restore,
          onClick: async () => {
            await Promise.all(
              cancelled.map((s) => endpoints.schedule.update(eventId, s.id, { status: "pending" })),
            );
            await refresh();
          },
        },
      });
    }
  };

  const finish = async (message: string) => {
    await refresh();
    toast.success(message);
    setIssues([]);
    setErrors({});
    setMode("view");
  };

  const save = async () => {
    // Only editable rows are sent; brand-new rows left completely empty are skipped.
    const sentRows = form.schedule.filter((r) => r.status === "pending" && (r.id || !isEmptyRow(r)));
    const rowKeys = sentRows.map((r) => r.key);
    const allRowKeys = form.schedule.map((r) => r.key);
    const fail = (error: ZodError, prefix = "") => {
      setErrors(fieldErrors(error));
      setIssues(
        describeIssues(
          error.issues.map((i) => prefix + i.path.join(".")),
          rowKeys,
          allRowKeys,
        ),
      );
    };

    setSaving(true);
    try {
      if (!contract) {
        const parsed = createContractSchema.safeParse({
          ...fields(),
          status: form.status,
          schedule: sentRows.map(toScheduleInput),
        });
        if (!parsed.success) return fail(parsed.error);
        const saved = await endpoints.contracts.create(eventId, parsed.data);
        setIssues([]);
        await refresh();
        toast.success(he.contract.created);
        onOpenChange(false);
        onSaved?.(saved);
        return;
      }

      const parsed = updateContractSchema.safeParse({ ...fields(), version: contract.version });
      if (!parsed.success) return fail(parsed.error);
      const schedule = scheduleListSchema.safeParse(sentRows.map(toScheduleInput));
      if (!schedule.success) return fail(schedule.error, "schedule.");

      // 1. Fields (optimistic locking via version).
      await endpoints.contracts.update(eventId, contract.id, parsed.data);

      // 2. Payment schedule: add new rows, update changed ones, remove deleted pending ones.
      const original = new Map(contract.schedule.map((s) => [s.id, rowFromItem(s)]));
      const keptIds = new Set(sentRows.flatMap((r) => (r.id ? [r.id] : [])));
      const ops: Promise<unknown>[] = [];
      sentRows.forEach((row, i) => {
        const input = schedule.data[i]!;
        if (!row.id) ops.push(endpoints.schedule.add(eventId, contract.id, input));
        else {
          const before = original.get(row.id);
          if (before && JSON.stringify(toScheduleInput(before)) !== JSON.stringify(toScheduleInput(row))) {
            ops.push(endpoints.schedule.update(eventId, row.id, input));
          }
        }
      });
      for (const item of contract.schedule) {
        if (item.status === "pending" && !keptIds.has(item.id)) {
          ops.push(endpoints.schedule.remove(eventId, item.id));
        }
      }
      await Promise.all(ops);

      // 3. Status, which may need confirmation.
      if (form.status !== contract.status) {
        try {
          await applyStatus(contract, form.status, false);
        } catch (e) {
          if (!isConfirmationRequired(e)) throw e;
          await refresh();
          setStatusConfirm({ status: form.status, count: Number(e.details?.pendingCount ?? 0) });
          return;
        }
      }
      await finish(he.contract.updated);
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === "version_conflict") {
        await refresh();
        toast.error(he.contract.versionConflict);
        reset("view");
        return;
      }
      if (e instanceof ApiRequestError && e.code === "validation_failed") {
        // The server has the final say (e.g. a category that was deleted meanwhile).
        const paths = [
          ...Object.keys(e.fields ?? {}),
          ...(e.details?.field ? [String(e.details.field)] : []),
        ];
        setIssues(describeIssues(paths, rowKeys, allRowKeys));
        return;
      }
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  const confirmStatus = async () => {
    if (!contract || !statusConfirm) return;
    setSaving(true);
    try {
      await applyStatus(contract, statusConfirm.status, true);
      setStatusConfirm(null);
      await finish(he.contract.updated);
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  const keepStatus = async () => {
    setStatusConfirm(null);
    await finish(he.contract.savedStatusKept);
  };

  const urlError = (key: string) => errors[key] && he.payments.invalidLink;
  const title = !contract
    ? he.contract.newTitle
    : editing
      ? he.contract.editTitle(contract.vendorName)
      : contract.vendorName;

  const footer = editing ? (
    <>
      {issues.length > 0 && (
        <div
          role="alert"
          className="flex w-full items-start gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger sm:me-auto sm:w-auto sm:max-w-md"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">{he.contract.issues(issues.length)}</p>
            <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              {issues.map((issue) => (
                <li key={issue.key}>
                  <button
                    type="button"
                    onClick={() => focusField(issue.targetId)}
                    className="underline underline-offset-2 hover:text-ink"
                  >
                    {issue.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <Button variant="secondary" onClick={() => (contract ? reset("view") : onOpenChange(false))}>
        {he.common.cancel}
      </Button>
      <Button onClick={save} loading={saving}>
        {he.common.save}
      </Button>
    </>
  ) : (
    <>
      {onOpenPayments && (
        <Button variant="ghost" className="sm:me-auto" onClick={onOpenPayments}>
          <CalendarClock className="size-4" />
          {he.contract.paymentsAndDates}
        </Button>
      )}
      <Button variant="secondary" onClick={() => onOpenChange(false)}>
        {he.common.close}
      </Button>
      {canWrite && (
        <Button onClick={() => setMode("edit")}>
          <Pencil className="size-4" />
          {he.common.edit}
        </Button>
      )}
    </>
  );

  return (
    <>
      <Dialog
        wide
        open={open}
        onOpenChange={(o) => {
          // Closing while editing discards the changes, so the next open starts clean.
          if (!o) setMode(contract ? "view" : "edit");
          onOpenChange(o);
        }}
        title={title}
        description={
          !editing && contract ? (
            <span className="inline-flex items-center gap-1.5">
              <Lock className="size-3.5" />
              {he.contract.viewOnly}
            </span>
          ) : undefined
        }
        footer={footer}
      >
        <fieldset disabled={!editing} className="grid gap-8">
          <Section title={he.contract.sections.vendor}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={he.contract.fields.vendorName} htmlFor="vendorName" error={errors.vendorName}>
                <Input
                  id="vendorName"
                  value={form.vendorName}
                  onChange={(e) => set("vendorName", e.target.value)}
                  aria-invalid={!!errors.vendorName}
                />
              </Field>
              <Field label={he.contract.fields.categoryId} htmlFor="categoryId" error={errors.categoryId}>
                <Select
                  id="categoryId"
                  value={form.categoryId}
                  onChange={(e) => set("categoryId", e.target.value)}
                >
                  <option value="" disabled>
                    {he.contract.choose}
                  </option>
                  {categories.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameHe}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label={he.contract.fields.status}>
              <Chips
                options={CONTRACT_STATUSES}
                labels={he.contractStatus}
                value={form.status}
                onChange={(v) => v && set("status", v)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={he.contract.fields.vendorContactName} htmlFor="vendorContactName">
                <Input
                  id="vendorContactName"
                  value={form.vendorContactName}
                  onChange={(e) => set("vendorContactName", e.target.value)}
                />
              </Field>
              <Field label={he.contract.fields.vendorBusinessId} htmlFor="vendorBusinessId">
                <Input
                  id="vendorBusinessId"
                  dir="ltr"
                  inputMode="numeric"
                  value={form.vendorBusinessId}
                  onChange={(e) => set("vendorBusinessId", e.target.value)}
                />
              </Field>
              <Field label={he.contract.fields.vendorPhone} htmlFor="vendorPhone">
                <Input
                  id="vendorPhone"
                  dir="ltr"
                  inputMode="tel"
                  value={form.vendorPhone}
                  onChange={(e) => set("vendorPhone", e.target.value)}
                />
              </Field>
              <Field
                label={he.contract.fields.vendorEmail}
                htmlFor="vendorEmail"
                error={errors.vendorEmail && he.auth.invalidEmail}
              >
                <Input
                  id="vendorEmail"
                  dir="ltr"
                  type="email"
                  value={form.vendorEmail}
                  onChange={(e) => set("vendorEmail", e.target.value)}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={he.contract.fields.websiteUrl}
                htmlFor="websiteUrl"
                error={urlError("websiteUrl")}
              >
                <Input
                  id="websiteUrl"
                  dir="ltr"
                  placeholder="https://"
                  value={form.websiteUrl}
                  onChange={(e) => set("websiteUrl", e.target.value)}
                />
              </Field>
              <Field
                label={he.contract.fields.instagramUrl}
                htmlFor="instagramUrl"
                error={urlError("instagramUrl")}
              >
                <Input
                  id="instagramUrl"
                  dir="ltr"
                  placeholder="https://instagram.com/…"
                  value={form.instagramUrl}
                  onChange={(e) => set("instagramUrl", e.target.value)}
                />
              </Field>
              <Field
                label={he.contract.fields.facebookUrl}
                htmlFor="facebookUrl"
                error={urlError("facebookUrl")}
              >
                <Input
                  id="facebookUrl"
                  dir="ltr"
                  placeholder="https://facebook.com/…"
                  value={form.facebookUrl}
                  onChange={(e) => set("facebookUrl", e.target.value)}
                />
              </Field>
              <Field
                label={he.contract.fields.contractUrl}
                htmlFor="contractUrl"
                error={urlError("contractUrl")}
              >
                <Input
                  id="contractUrl"
                  dir="ltr"
                  placeholder="https://"
                  value={form.contractUrl}
                  onChange={(e) => set("contractUrl", e.target.value)}
                />
              </Field>
            </div>
          </Section>

          <Section title={he.contract.sections.price}>
            <Field label={he.contract.fields.pricingType}>
              <Chips
                options={PRICING_TYPES}
                labels={he.pricingType}
                value={form.pricingType}
                onChange={(v) => v && set("pricingType", v)}
              />
            </Field>
            {form.pricingType === "per_guest" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={he.contract.fields.perGuestPriceAgorot} htmlFor="perGuest">
                  <MoneyInput
                    id="perGuest"
                    value={form.perGuestPriceAgorot}
                    onChange={(v) => set("perGuestPriceAgorot", v)}
                  />
                </Field>
                <Field label={he.contract.fields.minGuests} htmlFor="minGuests">
                  <Input
                    id="minGuests"
                    type="number"
                    dir="ltr"
                    value={form.minGuests ?? ""}
                    onChange={(e) =>
                      set(
                        "minGuests",
                        e.target.value ? Math.max(0, Math.round(Number(e.target.value))) : null,
                      )
                    }
                  />
                </Field>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label={he.contract.fields.totalAmountAgorot}
                htmlFor="total"
                className="sm:col-span-2"
                hint={
                  editing && suggested != null && suggested !== form.totalAmountAgorot ? (
                    <button
                      type="button"
                      className="text-brand-600 hover:underline"
                      onClick={() => set("totalAmountAgorot", suggested)}
                    >
                      {he.contract.suggestBefore(formatILS(suggested))}
                      {formatNumber(Math.max(guests ?? 0, form.minGuests ?? 0))}
                      {he.contract.suggestAfter}
                    </button>
                  ) : undefined
                }
              >
                <MoneyInput
                  id="total"
                  value={form.totalAmountAgorot}
                  onChange={(v) => set("totalAmountAgorot", v)}
                />
              </Field>
              <Field label={he.contract.fields.vatMode} htmlFor="vat">
                <Select
                  id="vat"
                  value={form.vatMode}
                  onChange={(e) => set("vatMode", e.target.value as VatMode)}
                >
                  {VAT_MODES.map((v) => (
                    <option key={v} value={v}>
                      {he.vatMode[v]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label={he.contract.fields.signedOn} htmlFor="signedOn" className="sm:max-w-60">
              <Input
                id="signedOn"
                type="date"
                value={form.signedOn}
                onChange={(e) => set("signedOn", e.target.value)}
              />
            </Field>
          </Section>

          <Section title={he.contract.sections.schedule}>
            <p className="-mt-2 text-xs text-muted">{he.contract.scheduleHint}</p>
            <div className="grid gap-3">
              {form.schedule.map((row, index) => {
                const locked = row.status !== "pending";
                return (
                  <fieldset
                    key={row.key}
                    disabled={locked || !editing}
                    className="grid gap-3 rounded-2xl border border-line p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="num w-5 shrink-0 text-center text-xs text-muted">{index + 1}</span>
                      <Input
                        id={`schedule-${row.key}-label`}
                        aria-invalid={invalid.has(`schedule.${row.key}.label`) || undefined}
                        value={row.label}
                        onChange={(e) => setRow(row.key, { label: e.target.value })}
                        placeholder={he.contract.installmentName}
                      />
                      {row.id && (
                        <Badge tone={scheduleTone[row.status]} className="shrink-0">
                          {he.scheduleStatus[row.status]}
                        </Badge>
                      )}
                      {editing && !locked && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={he.common.remove(row.label || he.contract.installmentFallback)}
                          onClick={() =>
                            set(
                              "schedule",
                              form.schedule.filter((r) => r.key !== row.key),
                            )
                          }
                        >
                          <Trash2 className="size-4 text-muted" />
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex min-w-0 gap-2">
                        <Select
                          className="w-24 shrink-0"
                          aria-label={he.contract.amountOrPercent}
                          value={row.mode}
                          onChange={(e) => setRow(row.key, { mode: e.target.value as ScheduleRow["mode"] })}
                        >
                          <option value="amount">{he.contract.amount}</option>
                          <option value="percent">{he.contract.percent}</option>
                        </Select>
                        {row.mode === "amount" ? (
                          <MoneyInput
                            id={`schedule-${row.key}-amount`}
                            invalid={invalid.has(`schedule.${row.key}.amount`)}
                            value={row.amountAgorot}
                            onChange={(v) => setRow(row.key, { amountAgorot: v })}
                          />
                        ) : (
                          <div className="relative min-w-0 flex-1">
                            <Input
                              id={`schedule-${row.key}-percent`}
                              aria-invalid={invalid.has(`schedule.${row.key}.percent`) || undefined}
                              type="number"
                              dir="ltr"
                              min={0}
                              max={100}
                              value={row.percent ?? ""}
                              onChange={(e) =>
                                setRow(row.key, {
                                  percent: e.target.value === "" ? null : Number(e.target.value),
                                })
                              }
                              className="ps-8"
                            />
                            <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-sm text-muted">
                              %
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex min-w-0 gap-2">
                        <Select
                          className="w-40 shrink-0"
                          aria-label={he.contract.when}
                          value={row.timing}
                          onChange={(e) => setRow(row.key, { timing: e.target.value as Timing })}
                        >
                          <option value="date">{he.contract.timing.date}</option>
                          <option value="before_event">{he.contract.timing.before_event}</option>
                          <option value="after_event">{he.contract.timing.after_event}</option>
                          <option value="after_signing">{he.contract.timing.after_signing}</option>
                        </Select>
                        {row.timing === "date" ? (
                          <Input
                            id={`schedule-${row.key}-date`}
                            aria-invalid={invalid.has(`schedule.${row.key}.date`) || undefined}
                            className="min-w-0"
                            type="date"
                            value={row.dueDate}
                            onChange={(e) => setRow(row.key, { dueDate: e.target.value })}
                          />
                        ) : (
                          <Input
                            id={`schedule-${row.key}-days`}
                            aria-invalid={invalid.has(`schedule.${row.key}.days`) || undefined}
                            type="number"
                            dir="ltr"
                            min={0}
                            placeholder={he.contract.days}
                            className="min-w-0"
                            value={row.days ?? ""}
                            onChange={(e) =>
                              setRow(row.key, {
                                days: e.target.value ? Math.abs(Math.round(Number(e.target.value))) : null,
                              })
                            }
                          />
                        )}
                      </div>
                    </div>
                    {row.timing !== "date" && (
                      <ComputedDueDate
                        row={row}
                        eventDate={event.data?.eventDate ?? null}
                        signedOn={form.signedOn}
                      />
                    )}
                  </fieldset>
                );
              })}
              {form.schedule.length === 0 && !editing && (
                <p className="rounded-xl bg-soft p-4 text-center text-sm text-muted">
                  {he.contract.noSchedule}
                </p>
              )}
              {editing && (
                <Button
                  variant="secondary"
                  className="justify-self-start"
                  onClick={() =>
                    set("schedule", [
                      ...form.schedule,
                      newRow(
                        form.schedule.length === 0
                          ? he.contract.firstInstallment
                          : he.contract.nthInstallment(form.schedule.length + 1),
                      ),
                    ])
                  }
                >
                  <Plus className="size-4" />
                  {he.contract.addInstallment}
                </Button>
              )}
            </div>
          </Section>

          <Section title={he.contract.sections.details}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={he.contract.fields.includedItems}
                htmlFor="included"
                hint={editing ? he.contract.onePerLine : undefined}
              >
                <Textarea
                  id="included"
                  value={form.includedText}
                  onChange={(e) => set("includedText", e.target.value)}
                />
              </Field>
              <Field
                label={he.contract.fields.excludedItems}
                htmlFor="excluded"
                hint={editing ? he.contract.onePerLine : undefined}
              >
                <Textarea
                  id="excluded"
                  value={form.excludedText}
                  onChange={(e) => set("excludedText", e.target.value)}
                />
              </Field>
            </div>
            <Field label={he.contract.fields.cancellationPolicy} htmlFor="cancellation">
              <Textarea
                id="cancellation"
                className="min-h-16"
                value={form.cancellationPolicy}
                onChange={(e) => set("cancellationPolicy", e.target.value)}
              />
            </Field>
            <Field label={he.contract.fields.notes} htmlFor="contractNotes">
              <Textarea
                id="contractNotes"
                className="min-h-16"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </Field>
          </Section>
        </fieldset>
      </Dialog>

      <ConfirmDialog
        open={statusConfirm != null}
        onOpenChange={(o) => !o && keepStatus()}
        title={statusConfirm ? he.contract.statusConfirmTitle(he.contractStatus[statusConfirm.status]) : ""}
        description={
          <>
            {he.contract.statusConfirmBefore}
            {statusConfirm?.count}
            {he.contract.statusConfirmAfter}
          </>
        }
        confirmLabel={he.contract.statusConfirm}
        loading={saving}
        onConfirm={confirmStatus}
      />
    </>
  );
}
