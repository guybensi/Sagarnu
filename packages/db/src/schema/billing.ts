import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { id, timestamps } from "./columns";

/** Billing is not live yet — everyone is on `free`, but entitlements read from here. */
export const plan = pgTable("plan", {
  id: text().primaryKey(),
  name: text().notNull(),
  /** e.g. `{ "ai_analysis_per_day": 20, "whatsapp_per_month": 200 }` */
  limits: jsonb().$type<Record<string, number>>().notNull(),
  ...timestamps,
});

export const subscription = pgTable("subscription", {
  id: id(),
  userId: uuid()
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  planId: text()
    .notNull()
    .references(() => plan.id),
  status: text().notNull().default("active"),
  provider: text(),
  providerRef: text(),
  currentPeriodEnd: timestamp({ withTimezone: true }),
  ...timestamps,
});
