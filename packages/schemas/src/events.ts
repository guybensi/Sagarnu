import { CEREMONY_TYPES, EVENT_STYLES, KASHRUT_LEVELS, TIMES_OF_DAY } from "@sagarnu/domain";
import { z } from "zod";
import { agorot, isoDate, longText, nullable, shortText, timeOfDay } from "./common";

const eventFields = {
  name: shortText,
  eventDate: nullable(isoDate),
  eventTime: nullable(timeOfDay),
  guestCount: nullable(z.number().int().min(1).max(5000)),
  estimatedBudgetAgorot: nullable(agorot),
  city: nullable(shortText),
  venueName: nullable(shortText),
  venueAddress: nullable(z.string().trim().max(200)),
  partner1Name: nullable(shortText),
  partner2Name: nullable(shortText),
  eventStyle: nullable(z.enum(EVENT_STYLES)),
  ceremonyType: nullable(z.enum(CEREMONY_TYPES)),
  kashrut: nullable(z.enum(KASHRUT_LEVELS)),
  timeOfDay: nullable(z.enum(TIMES_OF_DAY)),
  notes: nullable(longText),
};

export const createEventSchema = z.object({
  ...eventFields,
  /** System category keys the couple marked as relevant. Omitted = all relevant. */
  relevantCategoryKeys: z.array(z.string().max(40)).max(100).optional(),
  completeQuestionnaire: z.boolean().optional(),
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = z
  .object({ ...eventFields, completeQuestionnaire: z.boolean().optional() })
  .partial();
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export const customCategorySchema = z.object({
  name: shortText.max(40),
  icon: z.string().max(40).optional(),
});
export type CustomCategoryInput = z.infer<typeof customCategorySchema>;

export const categoryRelevanceSchema = z.object({ isRelevant: z.boolean() });
