/**
 * Ground truth for contract extraction = the contract payload the app itself accepts
 * (`createContractSchema` from @sagarnu/schemas), minus the fields a contract document cannot
 * contain. Nothing is redefined here: the schema is reused, and structural rules are derived from it.
 */
import { resolveScheduleAmount } from "@sagarnu/domain";
import { createContractSchema } from "@sagarnu/schemas";
import type { z } from "zod";

/**
 * Fields of `createContractSchema` that are chosen by the user in the app, not read from the PDF:
 * - `categoryId`: a database UUID of the event's category (picked from a tab).
 * - `status`: the couple's decision (quote / negotiating / approved …).
 * - `contractUrl`: a link the user pastes to where *they* keep the file.
 * - `notes`: the user's own notes.
 */
export const USER_ENTERED_FIELDS = ["categoryId", "status", "contractUrl", "notes"] as const;

/** Nested fields that exist in the schema but are app-internal (set by the UI, never by a document). */
export const INTERNAL_NESTED_FIELDS = ["schedule[].source"] as const;

export const contractGroundTruthSchema = createContractSchema.omit({
  categoryId: true,
  status: true,
  contractUrl: true,
  notes: true,
});

export type ContractGroundTruth = z.output<typeof contractGroundTruthSchema>;

export interface Issue {
  level: "error" | "warning";
  path: string;
  message: string;
}

// ── Schema introspection (Zod 4) ──────────────────────────────────────────

interface Def {
  type: string;
  innerType?: z.ZodType;
  in?: z.ZodType;
  element?: z.ZodType;
  shape?: Record<string, z.ZodType>;
}

const def = (schema: z.ZodType): Def => (schema as unknown as { def: Def }).def;

/** Strips optional / nullable / default / pipe wrappers down to the underlying object, array, … */
function unwrap(schema: z.ZodType): z.ZodType {
  let current = schema;
  for (;;) {
    const d = def(current);
    if (d.innerType) current = d.innerType;
    else if (d.type === "pipe" && d.in) current = d.in;
    else return current;
  }
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Ground truth must be explicit: every field present (null / [] when absent from the contract), and
 * no unknown keys — a typo like `totalAmount` would otherwise be silently dropped by Zod.
 */
function checkStructure(schema: z.ZodType, value: unknown, path: string, issues: Issue[]): void {
  const base = unwrap(schema);
  const d = def(base);

  if (d.type === "object" && isPlainObject(value)) {
    const shape = (base as unknown as { shape: Record<string, z.ZodType> }).shape;
    const excluded = new Set(
      INTERNAL_NESTED_FIELDS.filter((f) => f.startsWith(`${path.replace(/\[\d+\]/g, "[]")}.`)).map((f) =>
        f.split(".").at(-1)!,
      ),
    );
    const expected = Object.keys(shape).filter((k) => !excluded.has(k));
    for (const key of expected) {
      if (!(key in value)) {
        issues.push({
          level: "error",
          path: join(path, key),
          message: "missing — write null (or []) when the contract does not state it",
        });
      }
    }
    for (const key of Object.keys(value)) {
      if (!expected.includes(key)) {
        const why = excluded.has(key) ? "app-internal field, not part of the ground truth" : "unknown field";
        issues.push({ level: "error", path: join(path, key), message: why });
      } else {
        checkStructure(shape[key]!, value[key], join(path, key), issues);
      }
    }
  } else if (d.type === "array" && Array.isArray(value) && d.element) {
    value.forEach((item, i) => checkStructure(d.element!, item, `${path}[${i}]`, issues));
  }
}

const join = (path: string, key: string) => (path ? `${path}.${key}` : key);

/** The top-level keys a labeled file must contain, in schema order (used by the template test). */
export function groundTruthKeys(): string[] {
  return Object.keys(contractGroundTruthSchema.shape);
}

/** The keys of one payment schedule item. */
export function scheduleItemKeys(): string[] {
  const element = def(unwrap(contractGroundTruthSchema.shape.schedule)).element!;
  const shape = (unwrap(element) as unknown as { shape: Record<string, unknown> }).shape;
  return Object.keys(shape).filter((k) => k !== "source");
}

// ── Consistency checks (warnings: legal JSON, but probably a labeling mistake) ──

const DIRECTION_MARKS = /[\u200e\u200f\u202a-\u202e\u2066-\u2069\u200b\ufeff]/;

function consistency(gt: ContractGroundTruth, issues: Issue[]): void {
  const warn = (path: string, message: string) => issues.push({ level: "warning", path, message });

  if (gt.pricingType === "per_guest" && gt.perGuestPriceAgorot == null) {
    warn("perGuestPriceAgorot", 'pricingType is "per_guest" but no per-guest price is labeled');
  }
  if (gt.pricingType !== "per_guest" && (gt.perGuestPriceAgorot != null || gt.minGuests != null)) {
    warn("pricingType", 'per-guest price / minimum guests are set but pricingType is not "per_guest"');
  }

  let percentTotal = 0;
  gt.schedule.forEach((item, i) => {
    const p = `schedule[${i}]`;
    if (item.amountAgorot != null && item.percent != null) {
      warn(p, "both amountAgorot and percent are set — the app uses the amount; label only what is stated");
    }
    if (item.dueDate != null && item.relativeAnchor != null) {
      warn(p, "both dueDate and a relative due date are set — the app uses the relative one");
    }
    if (item.relativeAnchor === "signing" && gt.signedOn == null) {
      warn(p, "due relative to signing, but signedOn is null (fine if the contract is unsigned)");
    }
    if (item.dueDate && gt.signedOn && item.dueDate < gt.signedOn) {
      warn(`${p}.dueDate`, `due date ${item.dueDate} is before the signing date ${gt.signedOn}`);
    }
    percentTotal += item.percent ?? 0;
  });
  if (percentTotal > 100) warn("schedule", `percent installments add up to ${percentTotal}%`);

  // Mirrors the planned pipeline check: installments should add up to the total.
  const total = gt.totalAmountAgorot ?? null;
  if (total != null && gt.schedule.length > 0) {
    const amounts = gt.schedule.map((s) =>
      resolveScheduleAmount({ amountAgorot: s.amountAgorot ?? null, percent: s.percent ?? null }, total),
    );
    if (amounts.every((a) => a != null)) {
      const sum = amounts.reduce<number>((acc, a) => acc + a!, 0);
      if (sum !== total) {
        warn(
          "schedule",
          `installments add up to ${sum / 100} ₪ but totalAmountAgorot is ${total / 100} ₪ ` +
            "(fine if the contract itself is inconsistent — keep what it says)",
        );
      }
    }
  }

  const texts: [string, string | null | undefined][] = [
    ["vendorName", gt.vendorName],
    ["vendorContactName", gt.vendorContactName],
    ["cancellationPolicy", gt.cancellationPolicy],
    ...gt.includedItems.map((t, i) => [`includedItems[${i}]`, t] as [string, string]),
    ...gt.excludedItems.map((t, i) => [`excludedItems[${i}]`, t] as [string, string]),
    ...gt.schedule.map((s, i) => [`schedule[${i}].label`, s.label] as [string, string]),
  ];
  for (const [path, text] of texts) {
    if (text && DIRECTION_MARKS.test(text)) warn(path, "contains invisible direction/zero-width characters");
  }
}

// ── Public API ────────────────────────────────────────────────────────────

export interface ValidationResult {
  ok: boolean;
  issues: Issue[];
  /** The parsed value (defaults applied) when the schema accepts it. */
  data?: ContractGroundTruth;
}

export function validateContractGroundTruth(value: unknown): ValidationResult {
  const issues: Issue[] = [];
  if (!isPlainObject(value)) {
    return { ok: false, issues: [{ level: "error", path: "", message: "top level must be a JSON object" }] };
  }

  checkStructure(contractGroundTruthSchema, value, "", issues);

  const parsed = contractGroundTruthSchema.safeParse(value);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({ level: "error", path: formatPath(issue.path), message: issue.message });
    }
  } else {
    consistency(parsed.data, issues);
  }

  return {
    ok: !issues.some((i) => i.level === "error"),
    issues,
    data: parsed.success ? parsed.data : undefined,
  };
}

function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>(
    (acc, key) => (typeof key === "number" ? `${acc}[${key}]` : join(acc, String(key))),
    "",
  );
}
