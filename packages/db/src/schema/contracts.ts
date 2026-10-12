import { sql } from "drizzle-orm";
import {
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { agorot, bytea, createdAt, deletedAt, id, timestamps } from "./columns";
import {
  contractSource,
  contractStatus,
  payer,
  paymentFileKind,
  paymentMethod,
  pricingType,
  relativeAnchor,
  scheduleSource,
  scheduleStatus,
  vatMode,
} from "./enums";
import { category, event } from "./events";

export const contract = pgTable(
  "contract",
  {
    id: id(),
    eventId: uuid()
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    categoryId: uuid()
      .notNull()
      .references(() => category.id),
    status: contractStatus().notNull(),
    vendorName: text().notNull(),
    vendorBusinessId: text(),
    vendorContactName: text(),
    vendorPhone: text(),
    vendorEmail: text(),
    websiteUrl: text(),
    facebookUrl: text(),
    instagramUrl: text(),
    contractUrl: text(),
    totalAmountAgorot: agorot(),
    vatMode: vatMode().notNull().default("unknown"),
    pricingType: pricingType().notNull().default("fixed"),
    perGuestPriceAgorot: agorot(),
    minGuests: integer(),
    includedItems: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    excludedItems: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    cancellationPolicy: text(),
    notes: text(),
    /** Anchor for "N days after signing" schedule items. */
    signedOn: date({ mode: "string" }),
    source: contractSource().notNull().default("manual"),
    approvedAt: timestamp({ withTimezone: true }),
    /** Optimistic locking for concurrent edits by partners. */
    version: integer().notNull().default(1),
    createdBy: uuid().references(() => user.id, { onDelete: "set null" }),
    updatedBy: uuid().references(() => user.id, { onDelete: "set null" }),
    deletedAt: deletedAt(),
    ...timestamps,
  },
  (t) => [index().on(t.eventId, t.categoryId)],
);

export const paymentScheduleItem = pgTable(
  "payment_schedule_item",
  {
    id: id(),
    contractId: uuid()
      .notNull()
      .references(() => contract.id, { onDelete: "cascade" }),
    eventId: uuid()
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    label: text().notNull(),
    amountAgorot: agorot(),
    percent: doublePrecision(),
    dueDate: date({ mode: "string" }),
    relativeAnchor: relativeAnchor(),
    relativeDays: integer(),
    status: scheduleStatus().notNull().default("pending"),
    source: scheduleSource().notNull().default("manual"),
    sortOrder: integer().notNull().default(0),
    deletedAt: deletedAt(),
    ...timestamps,
  },
  (t) => [index().on(t.contractId), index().on(t.eventId, t.dueDate)],
);

export const payment = pgTable(
  "payment",
  {
    id: id(),
    contractId: uuid()
      .notNull()
      .references(() => contract.id, { onDelete: "cascade" }),
    eventId: uuid()
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    scheduleItemId: uuid().references(() => paymentScheduleItem.id, { onDelete: "set null" }),
    amountAgorot: agorot().notNull(),
    method: paymentMethod().notNull(),
    paidOn: date({ mode: "string" }).notNull(),
    /** Null: not recorded (payments made before the payer existed). */
    payer: payer(),
    /** Only for `other`. */
    payerName: text(),
    receiptUrl: text(),
    confirmationUrl: text(),
    notes: text(),
    createdBy: uuid().references(() => user.id, { onDelete: "set null" }),
    deletedAt: deletedAt(),
    ...timestamps,
  },
  (t) => [index().on(t.contractId), check("payment_amount_positive", sql`${t.amountAgorot} > 0`)],
);

/**
 * A receipt or transfer confirmation uploaded for a payment. Metadata is queried with the payment;
 * `data` is only read when the file itself is downloaded. Moves to R2 in phase 2.
 */
export const paymentFile = pgTable(
  "payment_file",
  {
    id: id(),
    paymentId: uuid()
      .notNull()
      .references(() => payment.id, { onDelete: "cascade" }),
    eventId: uuid()
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    kind: paymentFileKind().notNull(),
    name: text().notNull(),
    mime: text().notNull(),
    sizeBytes: integer().notNull(),
    data: bytea().notNull(),
    uploadedBy: uuid().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.paymentId)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    eventId: uuid().references(() => event.id, { onDelete: "cascade" }),
    actorId: uuid().references(() => user.id, { onDelete: "set null" }),
    entity: text().notNull(),
    entityId: uuid().notNull(),
    action: text().notNull(),
    diff: jsonb(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.eventId, t.createdAt)],
);
