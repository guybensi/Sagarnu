import { schema } from "@sagarnu/db";
import { deleteAccountSchema, updateMeSchema, type MeDto, type SessionDto } from "@sagarnu/schemas";
import { and, asc, desc, eq, gt, inArray, isNull, ne, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { currentUser } from "../lib/context";
import { AppError, notFound } from "../lib/errors";

const {
  account,
  category,
  contract,
  event,
  eventCategorySetting,
  eventInvitation,
  eventMember,
  payment,
  paymentFile,
  paymentScheduleItem,
  session,
  user,
} = schema;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function meRoutes(app: FastifyInstance): Promise<void> {
  const { db, auth } = app.ctx;

  const passwordHash = async (userId: string) => {
    const [row] = await db
      .select({ password: account.password })
      .from(account)
      .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
    return row?.password ?? null;
  };

  const signInMethods = async (userId: string) => {
    const rows = await db
      .select({ providerId: account.providerId, password: account.password })
      .from(account)
      .where(eq(account.userId, userId));
    return {
      hasPassword: rows.some((r) => r.providerId === "credential" && r.password != null),
      hasGoogle: rows.some((r) => r.providerId === "google"),
    };
  };

  const load = async (id: string): Promise<MeDto> => {
    const [row] = await db.select().from(user).where(eq(user.id, id));
    if (!row) throw notFound();
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      emailVerified: row.emailVerified,
      image: row.image,
      userType: row.userType,
      phoneE164: row.phoneE164,
      whatsappOptInAt: row.whatsappOptInAt?.toISOString() ?? null,
      defaultEventId: row.defaultEventId,
      ...(await signInMethods(id)),
    };
  };

  app.get("/v1/me", async (req) => load(currentUser(req).id));

  app.patch("/v1/me", async (req) => {
    const me = currentUser(req);
    const { whatsappOptIn, ...input } = updateMeSchema.parse(req.body);
    const [current] = await db.select().from(user).where(eq(user.id, me.id));
    if (!current) throw notFound();
    const phone = input.phoneE164 === undefined ? current.phoneE164 : input.phoneE164;
    const changes: Partial<typeof user.$inferInsert> = { ...input };
    if (whatsappOptIn === true) {
      if (!phone) throw new AppError("validation_failed", { field: "phoneE164" });
      if (!current.whatsappOptInAt || input.phoneE164 !== undefined) changes.whatsappOptInAt = new Date();
    }
    // Consent belongs to a number: turning it off, or removing the number, withdraws it.
    if (whatsappOptIn === false || phone == null) changes.whatsappOptInAt = null;
    if (Object.keys(changes).length > 0) await db.update(user).set(changes).where(eq(user.id, me.id));
    return load(me.id);
  });

  // Signed-in devices. Better Auth's own list needs a session younger than a day, which a
  // "remember me" session soon is not, so these work on the session table directly.
  app.get("/v1/me/sessions", async (req): Promise<SessionDto[]> => {
    const me = currentUser(req);
    const rows = await db
      .select()
      .from(session)
      .where(and(eq(session.userId, me.id), gt(session.expiresAt, new Date())))
      .orderBy(desc(session.updatedAt));
    return rows
      .map((s) => ({
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        lastActiveAt: s.updatedAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        current: s.id === req.sessionId,
      }))
      .sort((a, b) => Number(b.current) - Number(a.current));
  });

  app.delete<{ Params: { sessionId: string } }>("/v1/me/sessions/:sessionId", async (req, reply) => {
    const me = currentUser(req);
    if (!UUID.test(req.params.sessionId)) throw notFound();
    const removed = await db
      .delete(session)
      .where(and(eq(session.id, req.params.sessionId), eq(session.userId, me.id)))
      .returning({ id: session.id });
    if (removed.length === 0) throw notFound();
    return reply.status(204).send();
  });

  /** Signs out every other device; this one stays signed in. */
  app.delete("/v1/me/sessions", async (req) => {
    const me = currentUser(req);
    const removed = await db
      .delete(session)
      .where(and(eq(session.userId, me.id), ne(session.id, req.sessionId ?? "")))
      .returning({ id: session.id });
    return { removed: removed.length };
  });

  /** Everything we hold about the user and their events, as JSON (privacy law, amendment 13). */
  app.get("/v1/me/export", async (req, reply) => {
    const me = currentUser(req);
    const [profile] = await db.select().from(user).where(eq(user.id, me.id));
    if (!profile) throw notFound();
    const sessions = await db
      .select({
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      })
      .from(session)
      .where(eq(session.userId, me.id));
    const logins = await db
      .select({ provider: account.providerId, createdAt: account.createdAt })
      .from(account)
      .where(eq(account.userId, me.id));

    const memberships = await db
      .select({ event, role: eventMember.role, joinedAt: eventMember.createdAt })
      .from(eventMember)
      .innerJoin(event, eq(event.id, eventMember.eventId))
      .where(and(eq(eventMember.userId, me.id), isNull(event.deletedAt)));
    const eventIds = memberships.map((m) => m.event.id);
    const any = eventIds.length > 0;
    const [members, categories, settings, contracts, schedule, payments, files] = any
      ? await Promise.all([
          db
            .select({ eventId: eventMember.eventId, name: user.name, role: eventMember.role })
            .from(eventMember)
            .innerJoin(user, eq(user.id, eventMember.userId))
            .where(inArray(eventMember.eventId, eventIds)),
          db.select().from(category).where(inArray(category.eventId, eventIds)),
          db.select().from(eventCategorySetting).where(inArray(eventCategorySetting.eventId, eventIds)),
          db
            .select()
            .from(contract)
            .where(and(inArray(contract.eventId, eventIds), isNull(contract.deletedAt)))
            .orderBy(asc(contract.createdAt)),
          db
            .select()
            .from(paymentScheduleItem)
            .where(and(inArray(paymentScheduleItem.eventId, eventIds), isNull(paymentScheduleItem.deletedAt)))
            .orderBy(asc(paymentScheduleItem.sortOrder)),
          db
            .select()
            .from(payment)
            .where(and(inArray(payment.eventId, eventIds), isNull(payment.deletedAt)))
            .orderBy(asc(payment.paidOn)),
          // File contents stay out; they can be downloaded from the app.
          db
            .select({
              paymentId: paymentFile.paymentId,
              kind: paymentFile.kind,
              name: paymentFile.name,
              mime: paymentFile.mime,
              sizeBytes: paymentFile.sizeBytes,
              createdAt: paymentFile.createdAt,
            })
            .from(paymentFile)
            .where(inArray(paymentFile.eventId, eventIds)),
        ])
      : [[], [], [], [], [], [], []];

    const strip = <T extends { eventId?: unknown }>({ eventId: _e, ...rest }: T) => rest;
    const data = {
      exportedAt: new Date().toISOString(),
      note: "סגרנו – כל המידע שנשמר עליך ועל האירועים שלך. סכומים באגורות (100 = ₪1).",
      account: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        emailVerified: profile.emailVerified,
        userType: profile.userType,
        phoneE164: profile.phoneE164,
        whatsappOptInAt: profile.whatsappOptInAt,
        createdAt: profile.createdAt,
        loginMethods: logins,
      },
      sessions,
      events: memberships.map(({ event: ev, role, joinedAt }) => ({
        ...ev,
        myRole: role,
        joinedAt,
        members: members.filter((m) => m.eventId === ev.id).map(strip),
        customCategories: categories.filter((c) => c.eventId === ev.id).map(strip),
        categorySettings: settings.filter((s) => s.eventId === ev.id).map(strip),
        contracts: contracts
          .filter((c) => c.eventId === ev.id)
          .map((c) => ({
            ...strip(c),
            schedule: schedule.filter((s) => s.contractId === c.id).map(strip),
            payments: payments
              .filter((p) => p.contractId === c.id)
              .map((p) => ({ ...strip(p), files: files.filter((f) => f.paymentId === p.id) })),
          })),
      })),
    };
    const day = new Date().toISOString().slice(0, 10);
    return reply
      .header("content-disposition", `attachment; filename="sagarnu-export-${day}.json"`)
      .header("cache-control", "no-store")
      .send(data);
  });

  /**
   * Deletes the account. Events only this user belongs to are deleted with it; shared events stay
   * with their other members. Refused while the user is the only owner of a shared event, so no
   * event is left without someone in charge.
   */
  app.delete("/v1/me", async (req, reply) => {
    const me = currentUser(req);
    const input = deleteAccountSchema.parse(req.body);
    const hash = await passwordHash(me.id);
    if (hash) {
      const ctx = await auth.$context;
      if (!input.password || !(await ctx.password.verify({ hash, password: input.password }))) {
        throw new AppError("wrong_password");
      }
    }

    await db.transaction(async (tx) => {
      const mine = await tx
        .select({ eventId: eventMember.eventId, role: eventMember.role, name: event.name })
        .from(eventMember)
        .innerJoin(event, eq(event.id, eventMember.eventId))
        .where(eq(eventMember.userId, me.id));
      const ids = mine.map((m) => m.eventId);
      const others = ids.length
        ? await tx
            .select({
              eventId: eventMember.eventId,
              count: sql<number>`count(*)::int`,
              owners: sql<number>`count(*) filter (where ${eventMember.role} = 'owner')::int`,
            })
            .from(eventMember)
            .where(and(inArray(eventMember.eventId, ids), ne(eventMember.userId, me.id)))
            .groupBy(eventMember.eventId)
        : [];
      const othersOf = new Map(others.map((o) => [o.eventId, o]));

      const blocking = mine.filter(
        (m) =>
          m.role === "owner" && (othersOf.get(m.eventId)?.count ?? 0) > 0 && !othersOf.get(m.eventId)?.owners,
      );
      if (blocking.length > 0) {
        throw new AppError("sole_owner", { events: blocking.map((m) => ({ id: m.eventId, name: m.name })) });
      }

      const solo = mine.filter((m) => !othersOf.has(m.eventId)).map((m) => m.eventId);
      if (solo.length > 0) await tx.delete(event).where(inArray(event.id, solo));
      // Links this user sent stop working; the shared events keep their members.
      await tx.delete(eventInvitation).where(eq(eventInvitation.invitedBy, me.id));
      await tx.delete(user).where(eq(user.id, me.id));
    });
    req.log.info({ userId: me.id }, "account deleted");
    return reply.status(204).send();
  });
}
