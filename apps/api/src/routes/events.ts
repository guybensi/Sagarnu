import { schema } from "@sagarnu/db";
import {
  categoryRelevanceSchema,
  createEventSchema,
  customCategorySchema,
  updateEventSchema,
  type DashboardDto,
  type EventDto,
  type MemberDto,
} from "@sagarnu/schemas";
import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { assertUuid, eventAccess } from "../lib/access";
import { audit, diffOf } from "../lib/audit";
import { currentUser } from "../lib/context";
import { AppError, notFound } from "../lib/errors";
import { toCategoryDto, toEventDto } from "../lib/mappers";
import { loadLedger } from "../services/ledger";

const { category, contract, event, eventCategorySetting, eventMember, user } = schema;

type Params = { eventId: string };

export async function eventRoutes(app: FastifyInstance): Promise<void> {
  const { db, env } = app.ctx;

  const listCategories = async (eventId: string) => {
    const rows = await db
      .select({ category, isRelevant: eventCategorySetting.isRelevant })
      .from(category)
      .leftJoin(
        eventCategorySetting,
        and(eq(eventCategorySetting.categoryId, category.id), eq(eventCategorySetting.eventId, eventId)),
      )
      .where(or(isNull(category.eventId), eq(category.eventId, eventId)))
      .orderBy(asc(category.sortOrder), asc(category.createdAt));
    return rows.map((r) => toCategoryDto(r.category, r.isRelevant ?? true));
  };

  app.get("/v1/events", async (req): Promise<EventDto[]> => {
    const me = currentUser(req);
    const rows = await db
      .select({ event, role: eventMember.role })
      .from(event)
      .innerJoin(eventMember, and(eq(eventMember.eventId, event.id), eq(eventMember.userId, me.id)))
      .where(isNull(event.deletedAt))
      .orderBy(desc(event.updatedAt));
    return rows.map((r) => toEventDto(r.event, r.role));
  });

  app.post("/v1/events", async (req, reply): Promise<EventDto> => {
    const me = currentUser(req);
    if (env.requireEmailVerification && !me.emailVerified) throw new AppError("email_not_verified");
    const { relevantCategoryKeys, completeQuestionnaire, ...fields } = createEventSchema.parse(req.body);

    const created = await db.transaction(async (tx) => {
      if (me.userType === "couple") {
        const [owned] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(eventMember)
          .innerJoin(event, eq(event.id, eventMember.eventId))
          .where(and(eq(eventMember.userId, me.id), eq(eventMember.role, "owner"), isNull(event.deletedAt)));
        if ((owned?.n ?? 0) > 0) throw new AppError("couple_event_limit");
      }

      const [row] = await tx
        .insert(event)
        .values({
          ...fields,
          createdBy: me.id,
          questionnaireCompletedAt: completeQuestionnaire ? new Date() : null,
        })
        .returning();
      if (!row) throw new AppError("internal");
      await tx.insert(eventMember).values({ eventId: row.id, userId: me.id, role: "owner" });

      if (relevantCategoryKeys) {
        const relevant = new Set(relevantCategoryKeys);
        const system = await tx.select().from(category).where(isNull(category.eventId));
        if (system.length > 0) {
          await tx.insert(eventCategorySetting).values(
            system.map((c) => ({
              eventId: row.id,
              categoryId: c.id,
              isRelevant: relevant.has(c.key ?? ""),
            })),
          );
        }
      }
      await tx.update(user).set({ defaultEventId: row.id }).where(eq(user.id, me.id));
      await audit(tx, {
        eventId: row.id,
        actorId: me.id,
        entity: "event",
        entityId: row.id,
        action: "create",
      });
      return row;
    });

    reply.status(201);
    return toEventDto(created, "owner");
  });

  app.get<{ Params: Params }>("/v1/events/:eventId", async (req) => {
    const { event: ev, role } = await eventAccess(req, req.params.eventId, "event.view");
    return toEventDto(ev, role);
  });

  app.patch<{ Params: Params }>("/v1/events/:eventId", async (req) => {
    const me = currentUser(req);
    const { event: ev, role } = await eventAccess(req, req.params.eventId, "event.edit");
    const { completeQuestionnaire, ...patch } = updateEventSchema.parse(req.body);

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(event)
        .set({
          ...patch,
          ...(completeQuestionnaire && !ev.questionnaireCompletedAt
            ? { questionnaireCompletedAt: new Date() }
            : {}),
        })
        .where(eq(event.id, ev.id))
        .returning();
      const diff = diffOf(toEventDto(ev, role) as unknown as Record<string, unknown>, patch);
      if (Object.keys(diff).length > 0) {
        await audit(tx, {
          eventId: ev.id,
          actorId: me.id,
          entity: "event",
          entityId: ev.id,
          action: "update",
          diff,
        });
      }
      return row!;
    });
    // Relative due dates are resolved on read, so a new event date is reflected immediately.
    return toEventDto(updated, role);
  });

  app.delete<{ Params: Params }>("/v1/events/:eventId", async (req, reply) => {
    const me = currentUser(req);
    const { event: ev } = await eventAccess(req, req.params.eventId, "event.delete");
    await db.transaction(async (tx) => {
      await tx.update(event).set({ deletedAt: new Date() }).where(eq(event.id, ev.id));
      await tx.update(user).set({ defaultEventId: null }).where(eq(user.defaultEventId, ev.id));
      await audit(tx, { eventId: ev.id, actorId: me.id, entity: "event", entityId: ev.id, action: "delete" });
    });
    reply.status(204);
  });

  app.get<{ Params: Params }>("/v1/events/:eventId/dashboard", async (req): Promise<DashboardDto> => {
    const { event: ev, role } = await eventAccess(req, req.params.eventId, "event.view");
    const [ledger, categories] = await Promise.all([loadLedger(db, ev), listCategories(ev.id)]);

    const approvedCategoryIds = new Set(ledger.approved().map((c) => c.categoryId));
    const count = (s: string) => ledger.contracts.filter((c) => c.status === s).length;

    return {
      event: toEventDto(ev, role),
      summary: ledger.summary(),
      overdue: ledger.overdue(),
      upcoming: ledger.upcoming(),
      vendors: {
        approved: count("approved"),
        negotiating: count("negotiating"),
        quotes: count("quote"),
        missingCategories: categories
          .filter((c) => c.isRelevant && c.key !== "other" && !approvedCategoryIds.has(c.id))
          .map(({ id, nameHe, icon }) => ({ id, nameHe, icon })),
      },
    };
  });

  app.get<{ Params: Params }>("/v1/events/:eventId/categories", async (req) => {
    const { event: ev } = await eventAccess(req, req.params.eventId, "event.view");
    return listCategories(ev.id);
  });

  app.post<{ Params: Params }>("/v1/events/:eventId/categories", async (req, reply) => {
    const me = currentUser(req);
    const { event: ev } = await eventAccess(req, req.params.eventId, "contract.write");
    const input = customCategorySchema.parse(req.body);
    const [{ max } = { max: 0 }] = await db
      .select({ max: sql<number>`coalesce(max(${category.sortOrder}), 0)::int` })
      .from(category)
      .where(or(isNull(category.eventId), eq(category.eventId, ev.id)));
    const [row] = await db
      .insert(category)
      .values({
        eventId: ev.id,
        nameHe: input.name,
        icon: input.icon ?? "tag",
        isCustom: true,
        sortOrder: max + 10,
      })
      .returning();
    await audit(db, {
      eventId: ev.id,
      actorId: me.id,
      entity: "category",
      entityId: row!.id,
      action: "create",
    });
    reply.status(201);
    return toCategoryDto(row!, true);
  });

  app.put<{ Params: Params & { categoryId: string } }>(
    "/v1/events/:eventId/categories/:categoryId/relevance",
    async (req) => {
      const { event: ev } = await eventAccess(req, req.params.eventId, "event.edit");
      const categoryId = assertUuid(req.params.categoryId);
      const { isRelevant } = categoryRelevanceSchema.parse(req.body);
      const [cat] = await db
        .select()
        .from(category)
        .where(and(eq(category.id, categoryId), or(isNull(category.eventId), eq(category.eventId, ev.id))));
      if (!cat) throw notFound();
      await db
        .insert(eventCategorySetting)
        .values({ eventId: ev.id, categoryId, isRelevant })
        .onConflictDoUpdate({
          target: [eventCategorySetting.eventId, eventCategorySetting.categoryId],
          set: { isRelevant },
        });
      return toCategoryDto(cat, isRelevant);
    },
  );

  app.delete<{ Params: Params & { categoryId: string } }>(
    "/v1/events/:eventId/categories/:categoryId",
    async (req, reply) => {
      const { event: ev } = await eventAccess(req, req.params.eventId, "contract.write");
      const categoryId = assertUuid(req.params.categoryId);
      const [used] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(contract)
        .where(and(eq(contract.categoryId, categoryId), isNull(contract.deletedAt)));
      if ((used?.n ?? 0) > 0) throw new AppError("conflict", { contractCount: used!.n });
      const deleted = await db
        .delete(category)
        .where(and(eq(category.id, categoryId), eq(category.eventId, ev.id), eq(category.isCustom, true)))
        .returning({ id: category.id });
      if (deleted.length === 0) throw notFound();
      reply.status(204);
    },
  );

  app.get<{ Params: Params }>("/v1/events/:eventId/members", async (req): Promise<MemberDto[]> => {
    const { event: ev } = await eventAccess(req, req.params.eventId, "event.view");
    const rows = await db
      .select({ member: eventMember, user })
      .from(eventMember)
      .innerJoin(user, eq(user.id, eventMember.userId))
      .where(eq(eventMember.eventId, ev.id))
      .orderBy(asc(eventMember.createdAt));
    return rows.map((r) => ({
      userId: r.user.id,
      name: r.user.name,
      email: r.user.email,
      role: r.member.role,
      joinedAt: r.member.createdAt.toISOString(),
    }));
  });
}
