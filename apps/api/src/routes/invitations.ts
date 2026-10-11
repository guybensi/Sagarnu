import { createHash, randomBytes } from "node:crypto";
import { schema, type Tx } from "@sagarnu/db";
import type { Role } from "@sagarnu/domain";
import { invitationMessage, type EmailProvider } from "@sagarnu/notifications";
import {
  createInvitationSchema,
  updateMemberSchema,
  type AcceptInvitationResultDto,
  type CreateInvitationResultDto,
  type InvitationDto,
  type InvitationInfoDto,
} from "@sagarnu/schemas";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { assertUuid, eventAccess } from "../lib/access";
import { audit } from "../lib/audit";
import { currentUser } from "../lib/context";
import { AppError, notFound } from "../lib/errors";

const { event, eventInvitation, eventMember, user } = schema;

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ROLE_LABEL: Record<Role, string> = { owner: "בעלים", editor: "עריכה", viewer: "צפייה בלבד" };

/** Only a hash is stored, so a database leak does not expose working invitation links. */
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

type Params = { eventId: string };
type InvitationRow = typeof eventInvitation.$inferSelect;

const toInvitationDto = (row: InvitationRow): InvitationDto => ({
  id: row.id,
  email: row.email,
  role: row.role,
  createdAt: row.createdAt.toISOString(),
  expiresAt: row.expiresAt.toISOString(),
});

function invitationStatus(row: InvitationRow): InvitationInfoDto["status"] {
  if (row.revokedAt) return "revoked";
  if (row.acceptedAt) return "accepted";
  if (row.expiresAt.getTime() < Date.now()) return "expired";
  return "valid";
}

async function findByToken(db: FastifyInstance["ctx"]["db"] | Tx, token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const [row] = await db
    .select({ invitation: eventInvitation, event, inviterName: user.name })
    .from(eventInvitation)
    .innerJoin(event, eq(event.id, eventInvitation.eventId))
    .innerJoin(user, eq(user.id, eventInvitation.invitedBy))
    .where(and(eq(eventInvitation.tokenHash, hashToken(token)), isNull(event.deletedAt)));
  return row ?? null;
}

/** The last owner can be neither demoted nor removed — an event always has someone in charge. */
async function assertNotLastOwner(tx: Tx, eventId: string, userId: string) {
  const [{ n } = { n: 0 }] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(eventMember)
    .where(and(eq(eventMember.eventId, eventId), eq(eventMember.role, "owner")));
  const [member] = await tx
    .select({ role: eventMember.role })
    .from(eventMember)
    .where(and(eq(eventMember.eventId, eventId), eq(eventMember.userId, userId)));
  if (member?.role === "owner" && n <= 1) throw new AppError("conflict", { reason: "last_owner" });
}

/** Public: anyone holding the link may see what it is for (rate-limited, no personal data). */
export async function publicInvitationRoutes(app: FastifyInstance): Promise<void> {
  const { db } = app.ctx;
  app.get<{ Params: { token: string } }>(
    "/v1/invitations/:token",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (req): Promise<InvitationInfoDto> => {
      const row = await findByToken(db, req.params.token);
      if (!row) throw notFound();
      return {
        status: invitationStatus(row.invitation),
        eventName: row.event.name,
        eventDate: row.event.eventDate,
        inviterName: row.inviterName,
        role: row.invitation.role,
      };
    },
  );
}

export function invitationRoutes(email: EmailProvider) {
  return async function routes(app: FastifyInstance): Promise<void> {
    const { db, env } = app.ctx;

    app.get<{ Params: Params }>("/v1/events/:eventId/invitations", async (req): Promise<InvitationDto[]> => {
      const { event: ev } = await eventAccess(req, req.params.eventId, "members.manage");
      const rows = await db
        .select()
        .from(eventInvitation)
        .where(
          and(
            eq(eventInvitation.eventId, ev.id),
            isNull(eventInvitation.acceptedAt),
            isNull(eventInvitation.revokedAt),
            gt(eventInvitation.expiresAt, new Date()),
          ),
        )
        .orderBy(eventInvitation.createdAt);
      return rows.map(toInvitationDto);
    });

    app.post<{ Params: Params }>(
      "/v1/events/:eventId/invitations",
      { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
      async (req, reply): Promise<CreateInvitationResultDto> => {
        const me = currentUser(req);
        const { event: ev } = await eventAccess(req, req.params.eventId, "members.manage");
        const input = createInvitationSchema.parse(req.body);
        const address = input.email.trim().toLowerCase();

        const [existing] = await db
          .select({ id: eventMember.id })
          .from(eventMember)
          .innerJoin(user, eq(user.id, eventMember.userId))
          .where(and(eq(eventMember.eventId, ev.id), eq(sql`lower(${user.email})`, address)));
        if (existing) throw new AppError("conflict", { reason: "already_member" });

        const token = randomBytes(24).toString("base64url");
        const row = await db.transaction(async (tx) => {
          // A new invitation to the same address replaces the previous pending one.
          await tx
            .update(eventInvitation)
            .set({ revokedAt: new Date() })
            .where(
              and(
                eq(eventInvitation.eventId, ev.id),
                eq(eventInvitation.email, address),
                isNull(eventInvitation.acceptedAt),
                isNull(eventInvitation.revokedAt),
              ),
            );
          const [created] = await tx
            .insert(eventInvitation)
            .values({
              eventId: ev.id,
              email: address,
              role: input.role,
              tokenHash: hashToken(token),
              invitedBy: me.id,
              expiresAt: new Date(Date.now() + INVITE_TTL_MS),
            })
            .returning();
          return created!;
        });

        const inviteUrl = `${env.WEB_ORIGIN}/invite/${token}`;
        let emailSent = true;
        try {
          await email.send(invitationMessage(address, me.name, ev.name, ROLE_LABEL[input.role], inviteUrl));
        } catch (err) {
          // Without a verified domain Resend only delivers to the account owner; the link still works.
          req.log.warn({ err }, "invitation email not sent");
          emailSent = false;
        }

        reply.status(201);
        return { invitation: toInvitationDto(row), inviteUrl, emailSent };
      },
    );

    app.delete<{ Params: Params & { invitationId: string } }>(
      "/v1/events/:eventId/invitations/:invitationId",
      async (req, reply) => {
        const { event: ev } = await eventAccess(req, req.params.eventId, "members.manage");
        const revoked = await db
          .update(eventInvitation)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(eventInvitation.id, assertUuid(req.params.invitationId)),
              eq(eventInvitation.eventId, ev.id),
              isNull(eventInvitation.acceptedAt),
            ),
          )
          .returning({ id: eventInvitation.id });
        if (revoked.length === 0) throw notFound();
        reply.status(204);
      },
    );

    app.post<{ Params: { token: string } }>(
      "/v1/invitations/:token/accept",
      { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
      async (req): Promise<AcceptInvitationResultDto> => {
        const me = currentUser(req);
        return db.transaction(async (tx) => {
          const row = await findByToken(tx, req.params.token);
          if (!row) throw notFound();
          const status = invitationStatus(row.invitation);
          if (status !== "valid") throw new AppError("conflict", { reason: `invitation_${status}` });

          // Anyone holding the link may join (it is often forwarded on WhatsApp); it works once.
          const [member] = await tx
            .select({ role: eventMember.role })
            .from(eventMember)
            .where(and(eq(eventMember.eventId, row.event.id), eq(eventMember.userId, me.id)));
          if (!member) {
            await tx
              .insert(eventMember)
              .values({ eventId: row.event.id, userId: me.id, role: row.invitation.role });
          }
          await tx
            .update(eventInvitation)
            .set({ acceptedAt: new Date() })
            .where(eq(eventInvitation.id, row.invitation.id));
          // Land on the shared event next time, unless the user already has a default.
          await tx
            .update(user)
            .set({ defaultEventId: row.event.id })
            .where(and(eq(user.id, me.id), isNull(user.defaultEventId)));
          await audit(tx, {
            eventId: row.event.id,
            actorId: me.id,
            entity: "event",
            entityId: row.event.id,
            action: "update",
            diff: { member: [null, { userId: me.id, role: member?.role ?? row.invitation.role }] },
          });
          return { eventId: row.event.id, role: member?.role ?? row.invitation.role };
        });
      },
    );

    app.patch<{ Params: Params & { userId: string } }>("/v1/events/:eventId/members/:userId", async (req) => {
      const me = currentUser(req);
      const { event: ev } = await eventAccess(req, req.params.eventId, "members.manage");
      const userId = assertUuid(req.params.userId);
      const { role } = updateMemberSchema.parse(req.body);
      await db.transaction(async (tx) => {
        if (role !== "owner") await assertNotLastOwner(tx, ev.id, userId);
        const updated = await tx
          .update(eventMember)
          .set({ role })
          .where(and(eq(eventMember.eventId, ev.id), eq(eventMember.userId, userId)))
          .returning({ id: eventMember.id });
        if (updated.length === 0) throw notFound();
        await audit(tx, {
          eventId: ev.id,
          actorId: me.id,
          entity: "event",
          entityId: ev.id,
          action: "update",
          diff: { memberRole: [userId, role] },
        });
      });
      return { userId, role };
    });

    // Owners remove anyone; everyone else may only remove themselves (leave the event).
    app.delete<{ Params: Params & { userId: string } }>(
      "/v1/events/:eventId/members/:userId",
      async (req, reply) => {
        const me = currentUser(req);
        const userId = assertUuid(req.params.userId);
        const { event: ev } = await eventAccess(
          req,
          req.params.eventId,
          userId === me.id ? "event.view" : "members.manage",
        );
        await db.transaction(async (tx) => {
          await assertNotLastOwner(tx, ev.id, userId);
          const removed = await tx
            .delete(eventMember)
            .where(and(eq(eventMember.eventId, ev.id), eq(eventMember.userId, userId)))
            .returning({ id: eventMember.id });
          if (removed.length === 0) throw notFound();
          await tx
            .update(user)
            .set({ defaultEventId: null })
            .where(and(eq(user.id, userId), eq(user.defaultEventId, ev.id)));
          await audit(tx, {
            eventId: ev.id,
            actorId: me.id,
            entity: "event",
            entityId: ev.id,
            action: "update",
            diff: { member: [userId, null] },
          });
        });
        reply.status(204);
      },
    );
  };
}
