"use client";

import { endpoints, useCategories, useEvent } from "@sagarnu/api-client";
import {
  CONTRACT_STATUSES,
  perGuestTotal,
  PRICING_TYPES,
  VAT_MODES,
  type ContractStatus,
  type PricingType,
  type VatMode,
} from "@sagarnu/domain";
import { formatILS, formatNumber, he } from "@sagarnu/i18n";
import {
  createContractSchema,
  updateContractSchema,
  type ContractDetailDto,
  type ScheduleItemInput,
} from "@sagarnu/schemas";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { ZodError } from "zod";
import { toast } from "sonner";
import { Chips } from "@/components/event/event-fields";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { MoneyInput } from "@/components/ui/money-input";
import { cn } from "@/lib/cn";
import { fieldErrors, toastError } from "@/lib/errors";
import { useRefreshEvent } from "@/lib/use-refresh";
import { ApiRequestError } from "@sagarnu/api-client";

interface ScheduleRow {
  key: number;
  label: string;
  mode: "amount" | "percent";
  amountAgorot: number | null;
  percent: number | null;
  timing: "date" | "before_event" | "after_signing";
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
  label,
  mode: "amount",
  amountAgorot: null,
  percent: null,
  timing: "date",
  dueDate: "",
  days: null,
});

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
    schedule: contract ? [] : [newRow("מקדמה")],
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

function toScheduleInput(row: ScheduleRow): ScheduleItemInput {
  return {
    label: row.label.trim() || "תשלום",
    amountAgorot: row.mode === "amount" ? row.amountAgorot : null,
    percent: row.mode === "percent" ? row.percent : null,
    dueDate: row.timing === "date" ? orNull(row.dueDate) : null,
    relativeAnchor: row.timing === "date" ? null : row.timing === "before_event" ? "event" : "signing",
    relativeDays:
      row.timing === "date" || row.days == null ? null : row.timing === "before_event" ? -row.days : row.days,
  };
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
  vendorName: ["שם הספק", "vendorName"],
  categoryId: ["קטגוריה", "categoryId"],
  vendorContactName: ["איש קשר", "vendorContactName"],
  vendorPhone: ["טלפון", "vendorPhone"],
  vendorEmail: ["אימייל הספק", "vendorEmail"],
  vendorBusinessId: ["ח.פ / ע.מ", "vendorName"],
  websiteUrl: ["אתר", "websiteUrl"],
  instagramUrl: ["אינסטגרם", "instagramUrl"],
  facebookUrl: ["פייסבוק", "facebookUrl"],
  contractUrl: ["קישור לחוזה", "contractUrl"],
  totalAmountAgorot: ["סכום כולל", "total"],
  perGuestPriceAgorot: ["מחיר למנה", "perGuest"],
  minGuests: ["מינימום מנות", "minGuests"],
  vatMode: ["מע״מ", "vat"],
  signedOn: ["תאריך חתימה", "signedOn"],
  includedItems: ["מה כלול", "included"],
  excludedItems: ["מה לא כלול", "excluded"],
  cancellationPolicy: ["מדיניות ביטול", "cancellation"],
  notes: ["הערות", "contractNotes"],
};

const SCHEDULE_FIELD: Record<string, [string, string]> = {
  label: ["שם", "label"],
  amountAgorot: ["סכום", "amount"],
  percent: ["אחוז", "percent"],
  dueDate: ["תאריך", "date"],
  relativeDays: ["מספר ימים", "days"],
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
      const [fieldName, suffix] = SCHEDULE_FIELD[field ?? ""] ?? ["פרטים", "label"];
      const key = `schedule.${rowKey}.${suffix}`;
      out.set(key, {
        key,
        label: `מועד תשלום ${position}: ${fieldName}`,
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

export function ContractDialog({
  eventId,
  contract,
  defaultCategoryId,
  open,
  onOpenChange,
  onSaved,
}: {
  eventId: string;
  contract: ContractDetailDto | null;
  defaultCategoryId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (contract: ContractDetailDto) => void;
}) {
  const categories = useCategories(eventId);
  const event = useEvent(eventId);
  const refresh = useRefreshEvent(eventId);
  const [form, setForm] = useState<FormState>(() => initialState(contract, defaultCategoryId ?? ""));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [issues, setIssues] = useState<FormIssue[]>([]);
  const invalid = new Set(issues.map((i) => i.key));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const fallback = defaultCategoryId ?? categories.data?.find((c) => c.isRelevant)?.id ?? "";
      setForm(initialState(contract, fallback));
      setErrors({});
      setIssues([]);
    }
  }, [open, contract, defaultCategoryId, categories.data]);

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

  const save = async () => {
    // Rows the user left completely empty are skipped, so remember which form row each item came from.
    const sentRows = form.schedule.filter(
      (r) => r.amountAgorot != null || r.percent != null || r.dueDate || r.days != null,
    );
    const rowKeys = sentRows.map((r) => r.key);
    const allRowKeys = form.schedule.map((r) => r.key);
    const fail = (error: ZodError) => {
      setErrors(fieldErrors(error));
      setIssues(
        describeIssues(
          error.issues.map((i) => i.path.join(".")),
          rowKeys,
          allRowKeys,
        ),
      );
    };

    setSaving(true);
    try {
      let saved: ContractDetailDto;
      if (contract) {
        const parsed = updateContractSchema.safeParse({ ...fields(), version: contract.version });
        if (!parsed.success) return fail(parsed.error);
        saved = await endpoints.contracts.update(eventId, contract.id, parsed.data);
      } else {
        const parsed = createContractSchema.safeParse({
          ...fields(),
          status: form.status,
          schedule: sentRows.map(toScheduleInput),
        });
        if (!parsed.success) return fail(parsed.error);
        saved = await endpoints.contracts.create(eventId, parsed.data);
      }
      setErrors({});
      setIssues([]);
      await refresh();
      toast.success(contract ? "החוזה עודכן" : "החוזה נשמר");
      onOpenChange(false);
      onSaved?.(saved);
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === "version_conflict") await refresh();
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

  const urlError = (key: string) => errors[key] && "קישור לא תקין (https://…)";

  return (
    <Dialog
      wide
      open={open}
      onOpenChange={onOpenChange}
      title={contract ? `עריכת חוזה · ${contract.vendorName}` : "חוזה חדש"}
      footer={
        <>
          {issues.length > 0 && (
            <div
              role="alert"
              className="flex w-full items-start gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger sm:me-auto sm:w-auto sm:max-w-md"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">
                  {issues.length === 1 ? "צריך לתקן שדה אחד:" : `צריך לתקן ${issues.length} שדות:`}
                </p>
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
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button onClick={save} loading={saving}>
            שמירה
          </Button>
        </>
      }
    >
      <div className="grid gap-8">
        <Section title="הספק">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="שם הספק" htmlFor="vendorName" error={errors.vendorName}>
              <Input
                id="vendorName"
                value={form.vendorName}
                onChange={(e) => set("vendorName", e.target.value)}
                aria-invalid={!!errors.vendorName}
              />
            </Field>
            <Field label="קטגוריה" htmlFor="categoryId" error={errors.categoryId}>
              <Select
                id="categoryId"
                value={form.categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
              >
                <option value="" disabled>
                  בחירה…
                </option>
                {categories.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameHe}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {!contract && (
            <Field label="סטטוס">
              <Chips
                options={CONTRACT_STATUSES}
                labels={he.contractStatus}
                value={form.status}
                onChange={(v) => v && set("status", v)}
              />
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="איש קשר" htmlFor="vendorContactName">
              <Input
                id="vendorContactName"
                value={form.vendorContactName}
                onChange={(e) => set("vendorContactName", e.target.value)}
              />
            </Field>
            <Field label="טלפון" htmlFor="vendorPhone">
              <Input
                id="vendorPhone"
                dir="ltr"
                inputMode="tel"
                value={form.vendorPhone}
                onChange={(e) => set("vendorPhone", e.target.value)}
              />
            </Field>
            <Field label="אימייל" htmlFor="vendorEmail" error={errors.vendorEmail && "אימייל לא תקין"}>
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
            <Field label="אתר" htmlFor="websiteUrl" error={urlError("websiteUrl")}>
              <Input
                id="websiteUrl"
                dir="ltr"
                placeholder="https://"
                value={form.websiteUrl}
                onChange={(e) => set("websiteUrl", e.target.value)}
              />
            </Field>
            <Field label="אינסטגרם" htmlFor="instagramUrl" error={urlError("instagramUrl")}>
              <Input
                id="instagramUrl"
                dir="ltr"
                placeholder="https://instagram.com/…"
                value={form.instagramUrl}
                onChange={(e) => set("instagramUrl", e.target.value)}
              />
            </Field>
            <Field label="פייסבוק" htmlFor="facebookUrl" error={urlError("facebookUrl")}>
              <Input
                id="facebookUrl"
                dir="ltr"
                placeholder="https://facebook.com/…"
                value={form.facebookUrl}
                onChange={(e) => set("facebookUrl", e.target.value)}
              />
            </Field>
            <Field label="קישור לחוזה (Drive וכו׳)" htmlFor="contractUrl" error={urlError("contractUrl")}>
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

        <Section title="מחיר">
          <Field label="סוג תמחור">
            <Chips
              options={PRICING_TYPES}
              labels={he.pricingType}
              value={form.pricingType}
              onChange={(v) => v && set("pricingType", v)}
            />
          </Field>
          {form.pricingType === "per_guest" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="מחיר למנה" htmlFor="perGuest">
                <MoneyInput
                  id="perGuest"
                  value={form.perGuestPriceAgorot}
                  onChange={(v) => set("perGuestPriceAgorot", v)}
                />
              </Field>
              <Field label="מינימום מנות" htmlFor="minGuests">
                <Input
                  id="minGuests"
                  type="number"
                  dir="ltr"
                  value={form.minGuests ?? ""}
                  onChange={(e) =>
                    set("minGuests", e.target.value ? Math.max(0, Math.round(Number(e.target.value))) : null)
                  }
                />
              </Field>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="סכום כולל"
              htmlFor="total"
              className="sm:col-span-2"
              hint={
                suggested != null && suggested !== form.totalAmountAgorot ? (
                  <button
                    type="button"
                    className="text-brand-600 hover:underline"
                    onClick={() => set("totalAmountAgorot", suggested)}
                  >
                    הצעה: {formatILS(suggested)} (לפי{" "}
                    {formatNumber(Math.max(guests ?? 0, form.minGuests ?? 0))} מנות) · שימוש
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
            <Field label="מע״מ" htmlFor="vat">
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
          <Field label="תאריך חתימה" htmlFor="signedOn" className="sm:max-w-60">
            <Input
              id="signedOn"
              type="date"
              value={form.signedOn}
              onChange={(e) => set("signedOn", e.target.value)}
            />
          </Field>
        </Section>

        {!contract && (
          <Section title="פריסת תשלומים">
            <p className="-mt-2 text-xs text-muted">
              ממועדי התשלום נשלחות התזכורות. אפשר להוסיף ולשנות גם אחר כך.
            </p>
            <div className="grid gap-3">
              {form.schedule.map((row) => (
                <div key={row.key} className="grid gap-3 rounded-2xl border border-line p-4">
                  <div className="flex gap-3">
                    <Input
                      id={`schedule-${row.key}-label`}
                      aria-invalid={invalid.has(`schedule.${row.key}.label`) || undefined}
                      value={row.label}
                      onChange={(e) => setRow(row.key, { label: e.target.value })}
                      placeholder="שם התשלום"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="הסרה"
                      onClick={() =>
                        set(
                          "schedule",
                          form.schedule.filter((r) => r.key !== row.key),
                        )
                      }
                    >
                      <Trash2 className="size-4 text-muted" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex min-w-0 gap-2">
                      <Select
                        className="w-24 shrink-0"
                        value={row.mode}
                        onChange={(e) => setRow(row.key, { mode: e.target.value as ScheduleRow["mode"] })}
                      >
                        <option value="amount">סכום</option>
                        <option value="percent">אחוז</option>
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
                              setRow(row.key, { percent: e.target.value ? Number(e.target.value) : null })
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
                        className="w-36 shrink-0"
                        value={row.timing}
                        onChange={(e) => setRow(row.key, { timing: e.target.value as ScheduleRow["timing"] })}
                      >
                        <option value="date">בתאריך</option>
                        <option value="before_event">ימים לפני האירוע</option>
                        <option value="after_signing">ימים אחרי החתימה</option>
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
                          placeholder="ימים"
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
                </div>
              ))}
              <Button
                variant="secondary"
                className={cn("justify-self-start")}
                onClick={() =>
                  set("schedule", [
                    ...form.schedule,
                    newRow(form.schedule.length === 0 ? "מקדמה" : `תשלום ${form.schedule.length + 1}`),
                  ])
                }
              >
                <Plus className="size-4" />
                הוספת מועד
              </Button>
            </div>
          </Section>
        )}

        <Section title="פרטי החוזה">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="מה כלול" htmlFor="included" hint="פריט בכל שורה">
              <Textarea
                id="included"
                value={form.includedText}
                onChange={(e) => set("includedText", e.target.value)}
              />
            </Field>
            <Field label="מה לא כלול" htmlFor="excluded" hint="פריט בכל שורה">
              <Textarea
                id="excluded"
                value={form.excludedText}
                onChange={(e) => set("excludedText", e.target.value)}
              />
            </Field>
          </div>
          <Field label="מדיניות ביטול" htmlFor="cancellation">
            <Textarea
              id="cancellation"
              className="min-h-16"
              value={form.cancellationPolicy}
              onChange={(e) => set("cancellationPolicy", e.target.value)}
            />
          </Field>
          <Field label="הערות" htmlFor="contractNotes">
            <Textarea
              id="contractNotes"
              className="min-h-16"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </Field>
        </Section>
      </div>
    </Dialog>
  );
}
