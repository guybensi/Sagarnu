import { isValidIsoDate } from "@sagarnu/domain";
import { z } from "zod";

export const isoDate = z.string().refine(isValidIsoDate, { message: "invalid_date" });
export const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "invalid_time" });
export const agorot = z.number().int().nonnegative().max(1_000_000_000_00);
export const positiveAgorot = agorot.refine((v) => v > 0, { message: "must_be_positive" });
/** Only http(s) links — user-entered URLs are rendered as links, never fetched by the server. */
export const httpUrl = z.url({ protocol: /^https?$/ }).max(2048);
export const id = z.uuid();

const trimmed = (max: number) => z.string().trim().min(1).max(max);
export const shortText = trimmed(120);
export const longText = z.string().trim().max(5000);

/** `null` means "not known yet" in questionnaire fields. */
export const nullable = <T extends z.ZodType>(schema: T) => schema.nullable().optional();

export const ERROR_CODES = [
  "bad_request",
  "validation_failed",
  "unauthorized",
  "email_not_verified",
  "forbidden",
  "not_found",
  "conflict",
  "version_conflict",
  "couple_event_limit",
  "confirmation_required",
  "rate_limited",
  "internal",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiError {
  code: ErrorCode;
  message?: string;
  fields?: Record<string, string[]>;
  /** Extra data for confirmation dialogs (e.g. payment count before delete). */
  details?: Record<string, unknown>;
}
