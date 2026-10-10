import { sql } from "drizzle-orm";
import type { Db } from "./client";
import { category, plan } from "./schema";

export const SYSTEM_CATEGORIES = [
  { key: "venue", nameHe: "אולם / גן אירועים", icon: "building" },
  { key: "catering", nameHe: "קייטרינג", icon: "utensils" },
  { key: "bar", nameHe: "בר ואלכוהול", icon: "wine" },
  { key: "photo", nameHe: "צילום סטילס", icon: "camera" },
  { key: "video", nameHe: "צילום וידאו", icon: "video" },
  { key: "dj", nameHe: "די-ג׳יי", icon: "disc" },
  { key: "band", nameHe: "להקה ונגנים", icon: "music" },
  { key: "design", nameHe: "עיצוב ופרחים", icon: "flower" },
  { key: "dress", nameHe: "שמלת כלה", icon: "sparkles" },
  { key: "suit", nameHe: "חליפת חתן", icon: "shirt" },
  { key: "makeup", nameHe: "איפור ושיער", icon: "brush" },
  { key: "rabbi", nameHe: "רב ועורך טקס", icon: "book" },
  { key: "invitations", nameHe: "הזמנות ודפוס", icon: "mail" },
  { key: "transport", nameHe: "הסעות", icon: "bus" },
  { key: "gifts", nameHe: "מתנות לאורחים", icon: "gift" },
  { key: "rings", nameHe: "טבעות", icon: "gem" },
  { key: "suite", nameHe: "לינה וסוויטה", icon: "bed" },
  { key: "honeymoon", nameHe: "ירח דבש", icon: "plane" },
  { key: "attractions", nameHe: "אטרקציות", icon: "party" },
  { key: "permits", nameHe: "רישוי ואישורים", icon: "file" },
  { key: "other", nameHe: "אחר", icon: "dots" },
] as const;

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
