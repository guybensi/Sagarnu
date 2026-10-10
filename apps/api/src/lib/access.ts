import { schema } from "@sagarnu/db";
import { can, type EventAction, type Role } from "@sagarnu/domain";
import { and, eq, isNull } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { currentUser } from "./context";
import { AppError, notFound } from "./errors";

const { event, eventMember } = schema;

export type EventRow = typeof event.$inferSelect;

const uuid = z.uuid();

export function assertUuid(value: string): string {
  if (!uuid.safeParse(value).success) throw notFound();
  return value;
}

/**
 * Loads the event for the current user. Non-members get 404 (not 403) so event ids are not revealed.
 */
export async function eventAccess(
  req: FastifyRequest,
  eventId: string,
  action: EventAction,
): Promise<{ event: EventRow; role: Role }> {
  const user = currentUser(req);
  assertUuid(eventId);
  const [row] = await req.server.ctx.db
    .select({ event, role: eventMember.role })
    .from(event)
    .innerJoin(eventMember, and(eq(eventMember.eventId, event.id), eq(eventMember.userId, user.id)))
    .where(and(eq(event.id, eventId), isNull(event.deletedAt)));
  if (!row) throw notFound();
  if (!can(row.role, action)) throw new AppError("forbidden");
  return row;
}
