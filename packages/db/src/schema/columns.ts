import { bigint, customType, timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";

export const id = () =>
  uuid()
    .primaryKey()
    .$defaultFn(() => uuidv7());

export const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
export const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
export const deletedAt = () => timestamp({ withTimezone: true });

/** Money: integer agorot. */
export const agorot = () => bigint({ mode: "number" });

export const timestamps = { createdAt: createdAt(), updatedAt: updatedAt() };

/** Raw file bytes (photos, receipts) until files move to R2 in phase 2. */
export const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (value) => Buffer.from(value),
});
