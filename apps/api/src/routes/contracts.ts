import { schema, type Tx } from "@sagarnu/db";
import {
  changeContractStatusSchema,
  createContractSchema,
  paymentSchema,
  scheduleItemSchema,
  updateContractSchema,
  updatePaymentSchema,
  updateScheduleItemSchema,
  type ContractDto,
  type ExpensesDto,
  type PaymentResultDto,
} from "@sagarnu/schemas";
import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { assertUuid, eventAccess, type EventRow } from "../lib/access";
import { audit, diffOf } from "../lib/audit";
import { currentUser } from "../lib/context";
import { AppError, notFound } from "../lib/errors";
import { toPaymentDto } from "../lib/mappers";
import { loadLedger, refreshScheduleStatuses, type ContractRow } from "../services/ledger";

const { category, contract, payment, paymentScheduleItem } = schema;

type Params = { eventId: string };
type ContractParams = Params & { contractId: string };

export async function contractRoutes(app: FastifyInstance): Promise<void> {
  const { db } = app.ctx;

  const findContract = async (tx: typeof db | Tx, ev: EventRow, contractId: string): Promise<ContractRow> => {
    assertUuid(contractId);
    const [row] = await tx
      .select()
      .from(contract)
      .where(and(eq(contract.id, contractId), eq(contract.eventId, ev.id), isNull(contract.deletedAt)));
    if (!row) throw notFound();
    return row;
  };

  const detail = async (ev: EventRow, contractId: string) => {
    const ledger = await loadLedger(db, ev, contractId);
    const c = ledger.contracts[0];
    if (!c) throw notFound();
    return ledger.contractDetail(c);
  };

  const assertCategory = async (ev: EventRow, categoryId: string) => {
    const [cat] = await db
      .select({ id: category.id })
      .from(category)
      .where(and(eq(category.id, categoryId), or(isNull(category.eventId), eq(category.eventId, ev.id))));
    if (!cat) throw new AppError("validation_failed", { field: "categoryId" });
  };

  /** Shared by contract and payment endpoints. */
  const access = (req: FastifyRequest<{ Params: Params }>, action: Parameters<typeof eventAccess>[2]) =>
    eventAccess(req, req.params.eventId, action);

  // ── Contracts ────────────────────────────────────────────────────────────

  app.get<{ Params: Params; Querystring: { categoryId?: string; status?: string } }>(
    "/v1/events/:eventId/contracts",
    async (req): Promise<ContractDto[]> => {
      const { event: ev } = await access(req, "event.view");
      const ledger = await loadLedger(db, ev);
      const { categoryId, status } = req.query;
      return ledger.contracts
        .filter((c) => (!categoryId || c.categoryId === categoryId) && (!status || c.status === status))
        .map((c) => ledger.contractDto(c));
    },
  );

  app.post<{ Params: Params }>("/v1/events/:eventId/contracts", async (req, reply) => {
    const me = currentUser(req);
    const { event: ev } = await access(req, "contract.write");
    const { schedule, ...fields } = createContractSchema.parse(req.body);
    await assertCategory(ev, fields.categoryId);

    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(contract)
        .values({
          ...fields,
          eventId: ev.id,
          source: "manual",
          approvedAt: fields.status === "approved" ? new Date() : null,
          createdBy: me.id,
          updatedBy: me.id,
        })
        .returning();
      if (schedule.length > 0) {
        await tx
          .insert(paymentScheduleItem)
          .values(schedule.map((s, i) => ({ ...s, contractId: row!.id, eventId: ev.id, sortOrder: i * 10 })));
      }
      await audit(tx, {
        eventId: ev.id,
        actorId: me.id,
        entity: "contract",
        entityId: row!.id,
        action: "create",
      });
      return row!.id;
    });

    reply.status(201);
    return detail(ev, id);
  });

  app.get<{ Params: ContractParams }>("/v1/events/:eventId/contracts/:contractId", async (req) => {
    const { event: ev } = await access(req, "event.view");
    return detail(ev, assertUuid(req.params.contractId));
  });

  app.patch<{ Params: ContractParams }>("/v1/events/:eventId/contracts/:contractId", async (req) => {
    const me = currentUser(req);
    const { event: ev } = await access(req, "contract.write");
    const { version, ...patch } = updateContractSchema.parse(req.body);
    if (patch.categoryId) await assertCategory(ev, patch.categoryId);

    await db.transaction(async (tx) => {
      const before = await findContract(tx, ev, req.params.contractId);
      // Optimistic locking: two partners editing the same contract must not overwrite each other.
      const updated = await tx
        .update(contract)
        .set({ ...patch, updatedBy: me.id, version: sql`${contract.version} + 1` })
        .where(and(eq(contract.id, before.id), eq(contract.version, version)))
        .returning();
      if (updated.length === 0) throw new AppError("version_conflict");
      // A new total changes percent-based items, and therefore which items are covered.
      if (patch.totalAmountAgorot !== undefined) await refreshScheduleStatuses(tx, ev, updated[0]!);
      const diff = diffOf(before as unknown as Record<string, unknown>, patch);
      if (Object.keys(diff).length > 0) {
        await audit(tx, {
          eventId: ev.id,
          actorId: me.id,
          entity: "contract",
          entityId: before.id,
          action: "update",
          diff,
        });
      }
    });
    return detail(ev, req.params.contractId);
  });

  app.post<{ Params: ContractParams }>("/v1/events/:eventId/contracts/:contractId/status", async (req) => {
    const me = currentUser(req);
    const { event: ev } = await access(req, "contract.write");
    const { status, confirm } = changeContractStatusSchema.parse(req.body);

    await db.transaction(async (tx) => {
      const before = await findContract(tx, ev, req.params.contractId);
      if (before.status === status) return;

      if (before.status === "approved") {
        // Leaving approved cancels future payments; payments already made are kept.
        const pending = await tx
          .select({ id: paymentScheduleItem.id })
          .from(paymentScheduleItem)
          .where(
            and(
              eq(paymentScheduleItem.contractId, before.id),
              eq(paymentScheduleItem.status, "pending"),
              isNull(paymentScheduleItem.deletedAt),
            ),
          );
        if (pending.length > 0 && !confirm) {
          throw new AppError("confirmation_required", { pendingCount: pending.length });
        }
        if (pending.length > 0) {
          await tx
            .update(paymentScheduleItem)
            .set({ status: "cancelled" })
            .where(
              inArray(
                paymentScheduleItem.id,
                pending.map((p) => p.id),
              ),
            );
        }
      }

      const [row] = await tx
        .update(contract)
        .set({
          status,
          approvedAt: status === "approved" ? new Date() : before.approvedAt,
          updatedBy: me.id,
          version: sql`${contract.version} + 1`,
        })
        .where(eq(contract.id, before.id))
        .returning();
      if (status === "approved") await refreshScheduleStatuses(tx, ev, row!);
      await audit(tx, {
        eventId: ev.id,
        actorId: me.id,
        entity: "contract",
        entityId: before.id,
        action: "status",
        diff: { status: [before.status, status] },
      });
    });
    return detail(ev, req.params.contractId);
  });

  app.delete<{ Params: ContractParams; Querystring: { confirm?: string } }>(
    "/v1/events/:eventId/contracts/:contractId",
    async (req, reply) => {
      const me = currentUser(req);
      const { event: ev } = await access(req, "contract.delete");

      await db.transaction(async (tx) => {
        const c = await findContract(tx, ev, req.params.contractId);
        const [paid] = await tx
          .select({
            n: sql<number>`count(*)::int`,
            sum: sql<number>`coalesce(sum(${payment.amountAgorot}), 0)::bigint`,
          })
          .from(payment)
          .where(and(eq(payment.contractId, c.id), isNull(payment.deletedAt)));
        if ((paid?.n ?? 0) > 0 && req.query.confirm !== "true") {
          throw new AppError("confirmation_required", {
            paymentCount: paid!.n,
            paidAgorot: Number(paid!.sum),
          });
        }
        // Soft delete — restorable for 30 days (restore UI comes in phase 4).
        const now = new Date();
        await tx.update(contract).set({ deletedAt: now, updatedBy: me.id }).where(eq(contract.id, c.id));
        await tx
          .update(paymentScheduleItem)
          .set({ deletedAt: now })
          .where(and(eq(paymentScheduleItem.contractId, c.id), isNull(paymentScheduleItem.deletedAt)));
        await tx
          .update(payment)
          .set({ deletedAt: now })
          .where(and(eq(payment.contractId, c.id), isNull(payment.deletedAt)));
        await audit(tx, {
          eventId: ev.id,
          actorId: me.id,
          entity: "contract",
          entityId: c.id,
          action: "delete",
        });
      });
      reply.status(204);
    },
  );

  // ── Payment schedule ─────────────────────────────────────────────────────

  app.post<{ Params: ContractParams }>(
    "/v1/events/:eventId/contracts/:contractId/schedule",
    async (req, reply) => {
      const me = currentUser(req);
      const { event: ev } = await access(req, "payment.write");
      const input = scheduleItemSchema.parse(req.body);
      await db.transaction(async (tx) => {
        const c = await findContract(tx, ev, req.params.contractId);
        const [{ max } = { max: 0 }] = await tx
          .select({ max: sql<number>`coalesce(max(${paymentScheduleItem.sortOrder}), 0)::int` })
          .from(paymentScheduleItem)
          .where(eq(paymentScheduleItem.contractId, c.id));
        const [row] = await tx
          .insert(paymentScheduleItem)
          .values({ ...input, contractId: c.id, eventId: ev.id, sortOrder: max + 10 })
          .returning();
        await refreshScheduleStatuses(tx, ev, c);
        await audit(tx, {
          eventId: ev.id,
          actorId: me.id,
          entity: "schedule_item",
          entityId: row!.id,
          action: "create",
        });
      });
      reply.status(201);
      return detail(ev, req.params.contractId);
    },
  );

  app.patch<{ Params: Params & { itemId: string } }>("/v1/events/:eventId/schedule/:itemId", async (req) => {
    const me = currentUser(req);
    const { event: ev } = await access(req, "payment.write");
    const patch = updateScheduleItemSchema.parse(req.body);
    const contractId = await db.transaction(async (tx) => {
      const [item] = await tx
        .select()
        .from(paymentScheduleItem)
        .where(
          and(
            eq(paymentScheduleItem.id, assertUuid(req.params.itemId)),
            eq(paymentScheduleItem.eventId, ev.id),
            isNull(paymentScheduleItem.deletedAt),
          ),
        );
      if (!item) throw notFound();
      await tx.update(paymentScheduleItem).set(patch).where(eq(paymentScheduleItem.id, item.id));
      await refreshScheduleStatuses(tx, ev, await findContract(tx, ev, item.contractId));
      const diff = diffOf(item as unknown as Record<string, unknown>, patch);
      await audit(tx, {
        eventId: ev.id,
        actorId: me.id,
        entity: "schedule_item",
        entityId: item.id,
        action: "update",
        diff,
      });
      return item.contractId;
    });
    return detail(ev, contractId);
  });

  app.delete<{ Params: Params & { itemId: string } }>(
    "/v1/events/:eventId/schedule/:itemId",
    async (req, reply) => {
      const me = currentUser(req);
      const { event: ev } = await access(req, "payment.write");
      await db.transaction(async (tx) => {
        const [item] = await tx
          .update(paymentScheduleItem)
          .set({ deletedAt: new Date() })
          .where(
            and(
              eq(paymentScheduleItem.id, assertUuid(req.params.itemId)),
              eq(paymentScheduleItem.eventId, ev.id),
              isNull(paymentScheduleItem.deletedAt),
            ),
          )
          .returning();
        if (!item) throw notFound();
        // Payments that were assigned to it now count toward the contract only.
        await tx.update(payment).set({ scheduleItemId: null }).where(eq(payment.scheduleItemId, item.id));
        await audit(tx, {
          eventId: ev.id,
          actorId: me.id,
          entity: "schedule_item",
          entityId: item.id,
          action: "delete",
        });
      });
      reply.status(204);
    },
  );

  // ── Payments ─────────────────────────────────────────────────────────────

  /** Same contract, still open — a payment can only be assigned to its own contract's items. */
  const assertItemOnContract = async (tx: Tx, contractId: string, itemId: string | null | undefined) => {
    if (!itemId) return;
    const [item] = await tx
      .select({ id: paymentScheduleItem.id })
      .from(paymentScheduleItem)
      .where(
        and(
          eq(paymentScheduleItem.id, itemId),
          eq(paymentScheduleItem.contractId, contractId),
          isNull(paymentScheduleItem.deletedAt),
        ),
      );
    if (!item) throw new AppError("validation_failed", { field: "scheduleItemId" });
  };

  const paymentResult = async (
    ev: EventRow,
    c: ContractRow,
    paymentId: string,
  ): Promise<PaymentResultDto> => {
    const ledger = await loadLedger(db, ev, c.id);
    const fresh = ledger.contracts[0]!;
    const row = ledger.payments.find((p) => p.id === paymentId)!;
    return {
      payment: toPaymentDto(row),
      remainingAgorot: ledger.balance(fresh).remainingAgorot,
      nextDue: ledger.nextDue(fresh) ?? ledger.overdue().find((d) => d.contractId === c.id) ?? null,
    };
  };

  app.get<{ Params: ContractParams }>("/v1/events/:eventId/contracts/:contractId/payments", async (req) => {
    const { event: ev } = await access(req, "event.view");
    return (await detail(ev, assertUuid(req.params.contractId))).payments;
  });

  app.post<{ Params: ContractParams }>(
    "/v1/events/:eventId/contracts/:contractId/payments",
    async (req, reply) => {
      const me = currentUser(req);
      const { event: ev } = await access(req, "payment.write");
      const { confirmOverpay, ...input } = paymentSchema.parse(req.body);

      const { c, id } = await db.transaction(async (tx) => {
        const c = await findContract(tx, ev, req.params.contractId);
        await assertItemOnContract(tx, c.id, input.scheduleItemId);
        if (c.totalAmountAgorot != null) {
          const [{ sum } = { sum: 0 }] = await tx
            .select({ sum: sql<number>`coalesce(sum(${payment.amountAgorot}), 0)::bigint` })
            .from(payment)
            .where(and(eq(payment.contractId, c.id), isNull(payment.deletedAt)));
          const overpaid = Number(sum) + input.amountAgorot - c.totalAmountAgorot;
          // Paying more than the total is allowed (extras, tips) but must be confirmed.
          if (overpaid > 0 && !confirmOverpay) {
            throw new AppError("confirmation_required", { overpaidAgorot: overpaid });
          }
        }
        const [row] = await tx
          .insert(payment)
          .values({ ...input, contractId: c.id, eventId: ev.id, createdBy: me.id })
          .returning();
        await refreshScheduleStatuses(tx, ev, c);
        await audit(tx, {
          eventId: ev.id,
          actorId: me.id,
          entity: "payment",
          entityId: row!.id,
          action: "create",
          diff: { amountAgorot: [null, row!.amountAgorot] },
        });
        return { c, id: row!.id };
      });

      reply.status(201);
      return paymentResult(ev, c, id);
    },
  );

  const findPayment = async (tx: Tx, ev: EventRow, paymentId: string) => {
    const [row] = await tx
      .select()
      .from(payment)
      .where(
        and(eq(payment.id, assertUuid(paymentId)), eq(payment.eventId, ev.id), isNull(payment.deletedAt)),
      );
    if (!row) throw notFound();
    return row;
  };

  app.patch<{ Params: Params & { paymentId: string } }>(
    "/v1/events/:eventId/payments/:paymentId",
    async (req) => {
      const me = currentUser(req);
      const { event: ev } = await access(req, "payment.write");
      const { confirmOverpay: _confirm, ...patch } = updatePaymentSchema.parse(req.body);
      const c = await db.transaction(async (tx) => {
        const before = await findPayment(tx, ev, req.params.paymentId);
        await assertItemOnContract(tx, before.contractId, patch.scheduleItemId);
        await tx.update(payment).set(patch).where(eq(payment.id, before.id));
        const c = await findContract(tx, ev, before.contractId);
        await refreshScheduleStatuses(tx, ev, c);
        const diff = diffOf(before as unknown as Record<string, unknown>, patch);
        await audit(tx, {
          eventId: ev.id,
          actorId: me.id,
          entity: "payment",
          entityId: before.id,
          action: "update",
          diff,
        });
        return c;
      });
      return paymentResult(ev, c, req.params.paymentId);
    },
  );

  app.delete<{ Params: Params & { paymentId: string } }>(
    "/v1/events/:eventId/payments/:paymentId",
    async (req, reply) => {
      const me = currentUser(req);
      const { event: ev } = await access(req, "payment.write");
      await db.transaction(async (tx) => {
        const before = await findPayment(tx, ev, req.params.paymentId);
        await tx.update(payment).set({ deletedAt: new Date() }).where(eq(payment.id, before.id));
        await refreshScheduleStatuses(tx, ev, await findContract(tx, ev, before.contractId));
        await audit(tx, {
          eventId: ev.id,
          actorId: me.id,
          entity: "payment",
          entityId: before.id,
          action: "delete",
          diff: { amountAgorot: [before.amountAgorot, null] },
        });
      });
      reply.status(204);
    },
  );

  // ── Expenses ─────────────────────────────────────────────────────────────

  app.get<{ Params: Params }>("/v1/events/:eventId/expenses", async (req): Promise<ExpensesDto> => {
    const { event: ev } = await access(req, "event.view");
    const ledger = await loadLedger(db, ev);
    const categories = await db
      .select({ id: category.id, nameHe: category.nameHe, sortOrder: category.sortOrder })
      .from(category)
      .where(or(isNull(category.eventId), eq(category.eventId, ev.id)))
      .orderBy(asc(category.sortOrder));
    const byId = new Map(categories.map((c) => [c.id, c]));

    return {
      summary: ledger.summary(),
      rows: ledger
        .approved()
        .sort((a, b) => (byId.get(a.categoryId)?.sortOrder ?? 0) - (byId.get(b.categoryId)?.sortOrder ?? 0))
        .map((c) => ({
          contract: ledger.contractDto(c),
          categoryName: byId.get(c.categoryId)?.nameHe ?? "",
          nextDue: ledger.nextDue(c),
          isOverdue: ledger.balance(c).overdue.length > 0,
        })),
    };
  });
}
