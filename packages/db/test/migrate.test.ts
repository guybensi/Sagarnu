import { fileURLToPath } from "node:url";
import { isNull } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDb, seed, SYSTEM_CATEGORIES } from "../src";
import { category } from "../src/schema";

describe("migrations", () => {
  it("apply on an empty database and seed idempotently", async () => {
    const { db, migrate, close } = createDb("pglite:memory");
    await migrate(fileURLToPath(new URL("../drizzle", import.meta.url)));
    await seed(db);
    await seed(db);

    const rows = await db.select().from(category).where(isNull(category.eventId));
    expect(rows).toHaveLength(SYSTEM_CATEGORIES.length);
    await close();
  });
});
