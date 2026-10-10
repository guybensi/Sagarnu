import { isNull } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { agorot, createdAt, deletedAt, id, timestamps } from "./columns";
import { ceremonyType, eventStyle, kashrut, role, timeOfDay } from "./enums";

/** Questionnaire fields are nullable: null means "not known yet". */
export const event = pgTable("event", {
  id: id(),
  name: text().notNull(),
  eventDate: date({ mode: "string" }),
  eventTime: time(),
  guestCount: integer(),
  estimatedBudgetAgorot: agorot(),
  city: text(),
  venueName: text(),
  venueAddress: text(),
  partner1Name: text(),
  partner2Name: text(),
  eventStyle: eventStyle(),
  ceremonyType: ceremonyType(),
  kashrut: kashrut(),
  timeOfDay: timeOfDay(),
  notes: text(),
  questionnaireCompletedAt: timestamp({ withTimezone: true }),
  /** Set when a dashboard photo exists; also busts the browser cache when it changes. */
  coverPhotoUpdatedAt: timestamp({ withTimezone: true }),
  createdBy: uuid()
    .notNull()
    .references(() => user.id),
  deletedAt: deletedAt(),
  ...timestamps,
});

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (value) => Buffer.from(value),
});

/**
 * The couple's dashboard photo. Kept in its own table so event queries never load the bytes.
 * Moves to R2 together with contract files in phase 2.
 */
export const eventCoverPhoto = pgTable("event_cover_photo", {
  eventId: uuid()
    .primaryKey()
    .references(() => event.id, { onDelete: "cascade" }),
  mime: text().notNull(),
  data: bytea().notNull(),
  uploadedBy: uuid().references(() => user.id, { onDelete: "set null" }),
  ...timestamps,
});

export const eventMember = pgTable(
  "event_member",
  {
    id: id(),
    eventId: uuid()
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: role().notNull(),
    ...timestamps,
  },
  (t) => [unique().on(t.eventId, t.userId), index().on(t.userId)],
);

export const eventInvitation = pgTable(
  "event_invitation",
  {
    id: id(),
    eventId: uuid()
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    email: text().notNull(),
    role: role().notNull(),
    tokenHash: text().notNull().unique(),
    invitedBy: uuid()
      .notNull()
      .references(() => user.id),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    acceptedAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.eventId)],
);

/** `eventId = null` is a system category shared by all events. */
export const category = pgTable(
  "category",
  {
    id: id(),
    eventId: uuid().references(() => event.id, { onDelete: "cascade" }),
    key: text(),
    nameHe: text().notNull(),
    icon: text(),
    sortOrder: integer().notNull().default(0),
    isCustom: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("category_system_key_idx").on(t.key).where(isNull(t.eventId)), index().on(t.eventId)],
);

export const eventCategorySetting = pgTable(
  "event_category_setting",
  {
    eventId: uuid()
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    categoryId: uuid()
      .notNull()
      .references(() => category.id, { onDelete: "cascade" }),
    isRelevant: boolean().notNull(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.categoryId] })],
);
