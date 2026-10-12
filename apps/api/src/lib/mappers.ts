import type { schema } from "@sagarnu/db";
import type { Role } from "@sagarnu/domain";
import type { CategoryDto, ContractFileDto, EventDto, PaymentDto, PaymentFileDto } from "@sagarnu/schemas";

type EventRow = typeof schema.event.$inferSelect;
type CategoryRow = typeof schema.category.$inferSelect;
type PaymentRow = typeof schema.payment.$inferSelect;

export function toEventDto(row: EventRow, role: Role): EventDto {
  return {
    id: row.id,
    name: row.name,
    eventDate: row.eventDate,
    // Postgres returns `HH:mm:ss`; the app works with `HH:mm`.
    eventTime: row.eventTime?.slice(0, 5) ?? null,
    guestCount: row.guestCount,
    estimatedBudgetAgorot: row.estimatedBudgetAgorot,
    city: row.city,
    venueName: row.venueName,
    venueAddress: row.venueAddress,
    partner1Name: row.partner1Name,
    partner2Name: row.partner2Name,
    partner1Role: row.partner1Role,
    partner2Role: row.partner2Role,
    defaultPayer: row.defaultPayer,
    defaultPayerName: row.defaultPayerName,
    eventStyle: row.eventStyle,
    ceremonyType: row.ceremonyType,
    kashrut: row.kashrut,
    timeOfDay: row.timeOfDay,
    notes: row.notes,
    questionnaireCompletedAt: row.questionnaireCompletedAt?.toISOString() ?? null,
    coverPhotoUrl: row.coverPhotoUpdatedAt
      ? `/v1/events/${row.id}/cover?v=${row.coverPhotoUpdatedAt.getTime()}`
      : null,
    role,
  };
}

export function toCategoryDto(row: CategoryRow, isRelevant: boolean): CategoryDto {
  return {
    id: row.id,
    key: row.key,
    nameHe: row.nameHe,
    icon: row.icon,
    sortOrder: row.sortOrder,
    isCustom: row.isCustom,
    isRelevant,
  };
}

/** Everything about an uploaded file except its bytes. */
export type PaymentFileMeta = Omit<typeof schema.paymentFile.$inferSelect, "data">;

export function toPaymentFileDto(row: PaymentFileMeta): PaymentFileDto {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    mime: row.mime,
    sizeBytes: row.sizeBytes,
    url: `/v1/events/${row.eventId}/files/${row.id}`,
    createdAt: row.createdAt.toISOString(),
  };
}

export type ContractFileMeta = Omit<typeof schema.contractFile.$inferSelect, "data">;

export function toContractFileDto(row: ContractFileMeta): ContractFileDto {
  return {
    id: row.id,
    name: row.name,
    mime: row.mime,
    sizeBytes: row.sizeBytes,
    url: `/v1/events/${row.eventId}/contract-files/${row.id}`,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toPaymentDto(row: PaymentRow, files: PaymentFileMeta[] = []): PaymentDto {
  return {
    id: row.id,
    contractId: row.contractId,
    scheduleItemId: row.scheduleItemId,
    amountAgorot: row.amountAgorot,
    method: row.method,
    paidOn: row.paidOn,
    payer: row.payer,
    payerName: row.payerName,
    receiptUrl: row.receiptUrl,
    confirmationUrl: row.confirmationUrl,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    files: files.map(toPaymentFileDto),
  };
}

/**
 * A payer name only means something next to `other`. Applies to payments (`payer`/`payerName`)
 * and to the event default (`defaultPayer`/`defaultPayerName`); untouched keys stay untouched.
 */
export function normalizePayer<T extends Record<string, unknown>>(
  input: T,
  kindKey: keyof T,
  nameKey: keyof T,
): T {
  if (!(kindKey in input)) return input;
  return { ...input, [nameKey]: input[kindKey] === "other" ? (input[nameKey] ?? null) : null };
}
