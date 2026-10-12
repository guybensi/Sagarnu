import {
  CEREMONY_TYPES,
  CONTRACT_SOURCES,
  CONTRACT_STATUSES,
  EVENT_STYLES,
  KASHRUT_LEVELS,
  PARTNER_ROLES,
  PAYERS,
  PAYMENT_FILE_KINDS,
  PAYMENT_METHODS,
  PRICING_TYPES,
  RELATIVE_ANCHORS,
  ROLES,
  SCHEDULE_SOURCES,
  SCHEDULE_STATUSES,
  TIMES_OF_DAY,
  USER_TYPES,
  VAT_MODES,
} from "@sagarnu/domain";
import { pgEnum } from "drizzle-orm/pg-core";

export const userType = pgEnum("user_type", USER_TYPES);
export const role = pgEnum("event_role", ROLES);
export const eventStyle = pgEnum("event_style", EVENT_STYLES);
export const ceremonyType = pgEnum("ceremony_type", CEREMONY_TYPES);
export const kashrut = pgEnum("kashrut", KASHRUT_LEVELS);
export const timeOfDay = pgEnum("time_of_day", TIMES_OF_DAY);
export const contractStatus = pgEnum("contract_status", CONTRACT_STATUSES);
export const vatMode = pgEnum("vat_mode", VAT_MODES);
export const pricingType = pgEnum("pricing_type", PRICING_TYPES);
export const contractSource = pgEnum("contract_source", CONTRACT_SOURCES);
export const scheduleStatus = pgEnum("schedule_status", SCHEDULE_STATUSES);
export const scheduleSource = pgEnum("schedule_source", SCHEDULE_SOURCES);
export const relativeAnchor = pgEnum("relative_anchor", RELATIVE_ANCHORS);
export const paymentMethod = pgEnum("payment_method", PAYMENT_METHODS);
export const paymentFileKind = pgEnum("payment_file_kind", PAYMENT_FILE_KINDS);
export const partnerRole = pgEnum("partner_role", PARTNER_ROLES);
export const payer = pgEnum("payer", PAYERS);
