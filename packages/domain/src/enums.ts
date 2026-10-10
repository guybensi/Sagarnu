export const USER_TYPES = ["couple", "planner"] as const;
export type UserType = (typeof USER_TYPES)[number];

export const ROLES = ["owner", "editor", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const EVENT_STYLES = ["hall", "garden", "outdoor", "restaurant", "other"] as const;
export type EventStyle = (typeof EVENT_STYLES)[number];

export const CEREMONY_TYPES = ["religious", "civil", "alternative", "other"] as const;
export type CeremonyType = (typeof CEREMONY_TYPES)[number];

export const KASHRUT_LEVELS = ["none", "kosher", "mehadrin"] as const;
export type Kashrut = (typeof KASHRUT_LEVELS)[number];

export const TIMES_OF_DAY = ["noon", "evening"] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

export const CONTRACT_STATUSES = ["quote", "negotiating", "approved", "rejected", "cancelled"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const VAT_MODES = ["included", "excluded", "unknown"] as const;
export type VatMode = (typeof VAT_MODES)[number];

export const PRICING_TYPES = ["fixed", "per_guest", "estimate"] as const;
export type PricingType = (typeof PRICING_TYPES)[number];

export const CONTRACT_SOURCES = ["manual", "ai"] as const;
export type ContractSource = (typeof CONTRACT_SOURCES)[number];

export const SCHEDULE_STATUSES = ["pending", "paid", "cancelled"] as const;
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

export const SCHEDULE_SOURCES = ["ai", "manual", "next_payment_prompt"] as const;
export type ScheduleSource = (typeof SCHEDULE_SOURCES)[number];

export const RELATIVE_ANCHORS = ["signing", "event"] as const;
export type RelativeAnchor = (typeof RELATIVE_ANCHORS)[number];

export const PAYMENT_METHODS = [
  "credit_card",
  "cash",
  "bank_transfer",
  "check",
  "bit",
  "paybox",
  "other",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
