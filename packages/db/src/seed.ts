import { SYSTEM_CATEGORIES } from "@sagarnu/domain";
import { sql } from "drizzle-orm";
import type { Db } from "./client";
import { category, plan } from "./schema";

export { SYSTEM_CATEGORIES };

/** Idempotent: safe to run on every boot. */
export async function seed(db: Db): Promise<void> {
  await db
    .insert(category)
    .values(SYSTEM_CATEGORIES.map((c, i) => ({ ...c, sortOrder: i * 10 })))
    .onConflictDoUpdate({
      target: category.key,
      targetWhere: sql`event_id is null`,
      set: { nameHe: sql`excluded.name_he`, icon: sql`excluded.icon`, sortOrder: sql`excluded.sort_order` },
    });

  await db
    .insert(plan)
    .values({ id: "free", name: "Free", limits: { ai_analysis_per_day: 20, whatsapp_per_month: 200 } })
    .onConflictDoNothing();
}
