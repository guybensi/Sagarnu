import {
  CONTRACT_STATUSES,
  PAYERS,
  PAYMENT_FILE_KINDS,
  PAYMENT_METHODS,
  PRICING_TYPES,
  RELATIVE_ANCHORS,
  VAT_MODES,
} from "@sagarnu/domain";
import { z } from "zod";
import { agorot, httpUrl, id, isoDate, longText, nullable, positiveAgorot, shortText } from "./common";

const contractFields = {
  categoryId: id,
  status: z.enum(CONTRACT_STATUSES),
  vendorName: shortText,
  vendorBusinessId: nullable(z.string().trim().max(20)),
  vendorContactName: nullable(shortText),
  vendorPhone: nullable(z.string().trim().max(30)),
  vendorEmail: nullable(z.email()),
  websiteUrl: nullable(httpUrl),
  facebookUrl: nullable(httpUrl),
  instagramUrl: nullable(httpUrl),
  contractUrl: nullable(httpUrl),
  totalAmountAgorot: nullable(agorot),
  vatMode: z.enum(VAT_MODES),
  pricingType: z.enum(PRICING_TYPES),
  perGuestPriceAgorot: nullable(agorot),
  minGuests: nullable(z.number().int().min(0).max(5000)),
  includedItems: z.array(z.string().trim().min(1).max(200)).max(50),
  excludedItems: z.array(z.string().trim().min(1).max(200)).max(50),
  cancellationPolicy: nullable(longText),
  notes: nullable(longText),
  signedOn: nullable(isoDate),
};

/** Defaults only apply on create — a PATCH must never reset omitted fields. */
const createDefaults = {
  vatMode: contractFields.vatMode.default("unknown"),
  pricingType: contractFields.pricingType.default("fixed"),
  includedItems: contractFields.includedItems.default([]),
  excludedItems: contractFields.excludedItems.default([]),
};

export const scheduleItemSchema = z
  .object({
    label: shortText,
    amountAgorot: nullable(positiveAgorot),
    percent: nullable(z.number().min(0).max(100)),
    dueDate: nullable(isoDate),
    relativeAnchor: nullable(z.enum(RELATIVE_ANCHORS)),
    relativeDays: nullable(z.number().int().min(-3650).max(3650)),
    /** `next_payment_prompt` when created from the "when is the next payment?" dialog. */
    source: z.enum(["manual", "next_payment_prompt"]).optional(),
  })
  .refine((v) => v.relativeAnchor == null || v.relativeDays != null, {
    path: ["relativeDays"],
    message: "required",
  });
export type ScheduleItemInput = z.infer<typeof scheduleItemSchema>;

export const updateScheduleItemSchema = z.object({
  label: shortText.optional(),
  amountAgorot: nullable(positiveAgorot),
  percent: nullable(z.number().min(0).max(100)),
  dueDate: nullable(isoDate),
  relativeAnchor: nullable(z.enum(RELATIVE_ANCHORS)),
  relativeDays: nullable(z.number().int().min(-3650).max(3650)),
  status: z.enum(["pending", "cancelled"]).optional(),
});

export const createContractSchema = z.object({
  ...contractFields,
  ...createDefaults,
  schedule: z.array(scheduleItemSchema).max(24).default([]),
});
export type CreateContractInput = z.input<typeof createContractSchema>;

/** Status changes go through `changeContractStatusSchema` because they have side effects. */
export const updateContractSchema = z
  .object(contractFields)
  .omit({ status: true })
  .partial()
  .extend({
    /** Optimistic locking: the version the client last saw. */
    version: z.number().int().min(1),
  });
export type UpdateContractInput = z.input<typeof updateContractSchema>;

export const changeContractStatusSchema = z.object({
  status: z.enum(CONTRACT_STATUSES),
  /** Required when leaving `approved` cancels future scheduled payments. */
  confirm: z.boolean().optional(),
});

export const paymentSchema = z.object({
  amountAgorot: positiveAgorot,
  method: z.enum(PAYMENT_METHODS),
  paidOn: isoDate,
  /** Null: not recorded. `payerName` is only kept for `other`. */
  payer: nullable(z.enum(PAYERS)),
  payerName: nullable(shortText),
  scheduleItemId: nullable(id),
  receiptUrl: nullable(httpUrl),
  confirmationUrl: nullable(httpUrl),
  notes: nullable(longText),
  /** Paying above the contract total needs explicit confirmation. */
  confirmOverpay: z.boolean().optional(),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

export const updatePaymentSchema = paymentSchema.partial();

export const PAYMENT_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
/** Receipts are small; photos are resized in the browser before upload. */
export const PAYMENT_FILE_MAX_BYTES = 5 * 1024 * 1024;
export const PAYMENT_FILES_PER_PAYMENT = 6;

export const paymentFileUploadSchema = z.object({
  kind: z.enum(PAYMENT_FILE_KINDS),
  name: z.string().trim().min(1).max(200),
  /** `data:application/pdf;base64,...` or an image data URL. */
  dataUrl: z
    .string()
    .max(Math.ceil((PAYMENT_FILE_MAX_BYTES * 4) / 3) + 64)
    .regex(/^data:(application\/pdf|image\/(jpeg|png|webp));base64,[A-Za-z0-9+/=]+$/, {
      message: "invalid_file",
    }),
});
export type PaymentFileUploadInput = z.infer<typeof paymentFileUploadSchema>;

/** The signed contract or the quote itself: PDF, Word or a photo of the pages. */
export const CONTRACT_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
/** Scanned contracts run to several MB; photos are resized in the browser first. */
export const CONTRACT_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const CONTRACT_FILES_PER_CONTRACT = 5;

export const contractFileUploadSchema = z.object({
  name: z.string().trim().min(1).max(200),
  dataUrl: z
    .string()
    .max(Math.ceil((CONTRACT_FILE_MAX_BYTES * 4) / 3) + 128)
    .regex(
      /^data:(application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)|image\/(jpeg|png|webp));base64,[A-Za-z0-9+/=]+$/,
      { message: "invalid_file" },
    ),
});
export type ContractFileUploadInput = z.infer<typeof contractFileUploadSchema>;
