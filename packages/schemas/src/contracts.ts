import {
  CONTRACT_STATUSES,
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
  vatMode: z.enum(VAT_MODES).default("unknown"),
  pricingType: z.enum(PRICING_TYPES).default("fixed"),
  perGuestPriceAgorot: nullable(agorot),
  minGuests: nullable(z.number().int().min(0).max(5000)),
  includedItems: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
  excludedItems: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
  cancellationPolicy: nullable(longText),
  notes: nullable(longText),
  signedOn: nullable(isoDate),
};

export const scheduleItemSchema = z
  .object({
    label: shortText,
    amountAgorot: nullable(positiveAgorot),
    percent: nullable(z.number().min(0).max(100)),
    dueDate: nullable(isoDate),
    relativeAnchor: nullable(z.enum(RELATIVE_ANCHORS)),
    relativeDays: nullable(z.number().int().min(-3650).max(3650)),
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
  schedule: z.array(scheduleItemSchema).max(24).default([]),
});
export type CreateContractInput = z.input<typeof createContractSchema>;

export const updateContractSchema = z
  .object(contractFields)
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
  scheduleItemId: nullable(id),
  receiptUrl: nullable(httpUrl),
  confirmationUrl: nullable(httpUrl),
  notes: nullable(longText),
  /** Paying above the contract total needs explicit confirmation. */
  confirmOverpay: z.boolean().optional(),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

export const updatePaymentSchema = paymentSchema.partial();
