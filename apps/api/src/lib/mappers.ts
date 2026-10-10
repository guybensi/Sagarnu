import type { schema } from "@sagarnu/db";
import type { Role } from "@sagarnu/domain";
import type { CategoryDto, EventDto, PaymentDto } from "@sagarnu/schemas";

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

export function toPaymentDto(row: PaymentRow): PaymentDto {
  return {
    id: row.id,
    contractId: row.contractId,
    scheduleItemId: row.scheduleItemId,
    amountAgorot: row.amountAgorot,
    method: row.method,
    paidOn: row.paidOn,
    receiptUrl: row.receiptUrl,
    confirmationUrl: row.confirmationUrl,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}
