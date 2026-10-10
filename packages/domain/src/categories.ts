/** System vendor categories, shared by the seed (DB) and the onboarding questionnaire (client). */
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

export type SystemCategoryKey = (typeof SYSTEM_CATEGORIES)[number]["key"];
