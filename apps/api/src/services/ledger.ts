import { type Db, schema, type Tx } from "@sagarnu/db";
import {
  contractBalance,
  isScheduleItemCovered,
  paidTowardsItem,
  resolveDueDate,
  resolveScheduleAmount,
  summarizeExpenses,
  todayIso,
  type ContractBalance,
  type IsoDate,
} from "@sagarnu/domain";
import type { ContractDetailDto, ContractDto, DueItemDto, ScheduleItemDto } from "@sagarnu/schemas";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { EventRow } from "../lib/access";
import { toPaymentDto } from "../lib/mappers";

const { contract, payment, paymentScheduleItem } = schema;

export type ContractRow = typeof contract.$inferSelect;
export type ScheduleRow = typeof paymentScheduleItem.$inferSelect;
export type PaymentRow = typeof payment.$inferSelect;

type ResolvedItem = Omit<ScheduleItemDto, "remainingAgorot">;

/** Resolves percent amounts and relative due dates against the current contract and event. */
export function resolveItem(row: ScheduleRow, c: ContractRow, eventDate: IsoDate | null): ResolvedItem {
  return {
    id: row.id,
    contractId: row.contractId,
    label: row.label,
    amountAgorot: resolveScheduleAmount(row, c.totalAmountAgorot),
    percent: row.percent,
    dueDate: resolveDueDate(row, { signingDate: c.signedOn, eventDate }),
    relativeAnchor: row.relativeAnchor,
    relativeDays: row.relativeDays,
    status: row.status,
    source: row.source,
    sortOrder: row.sortOrder,
  };
}

/** Everything financial about one event, loaded once and computed in memory with `domain`. */
export class Ledger {
  readonly today = todayIso();
  private readonly itemsByContract = new Map<string, ResolvedItem[]>();
  private readonly balances = new Map<string, ContractBalance<ResolvedItem>>();

  constructor(
    readonly event: EventRow,
    readonly contracts: ContractRow[],
    private readonly scheduleRows: ScheduleRow[],
    readonly payments: PaymentRow[],
  ) {
    const byId = new Map(contracts.map((c) => [c.id, c]));
    for (const row of scheduleRows) {
      const c = byId.get(row.contractId);
      if (!c) continue;
      const list = this.itemsByContract.get(c.id) ?? [];
      list.push(resolveItem(row, c, event.eventDate));
      this.itemsByContract.set(c.id, list);
    }
  }

  items(contractId: string): ResolvedItem[] {
    return this.itemsByContract.get(contractId) ?? [];
  }

  balance(c: ContractRow): ContractBalance<ResolvedItem> {
    let b = this.balances.get(c.id);
    if (!b) {
      b = contractBalance(c, this.payments, this.items(c.id), this.today);
      this.balances.set(c.id, b);
    }
    return b;
  }

  contractDto(c: ContractRow): ContractDto {
    const b = this.balance(c);
    return {
      id: c.id,
      categoryId: c.categoryId,
      status: c.status,
      vendorName: c.vendorName,
      vendorBusinessId: c.vendorBusinessId,
      vendorContactName: c.vendorContactName,
      vendorPhone: c.vendorPhone,
      vendorEmail: c.vendorEmail,
      websiteUrl: c.websiteUrl,
      facebookUrl: c.facebookUrl,
      instagramUrl: c.instagramUrl,
      contractUrl: c.contractUrl,
      totalAmountAgorot: c.totalAmountAgorot,
      vatMode: c.vatMode,
      pricingType: c.pricingType,
      perGuestPriceAgorot: c.perGuestPriceAgorot,
      minGuests: c.minGuests,
      includedItems: c.includedItems,
      excludedItems: c.excludedItems,
      cancellationPolicy: c.cancellationPolicy,
      notes: c.notes,
      signedOn: c.signedOn,
      source: c.source,
      version: c.version,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      paidAgorot: b.paidAgorot,
      remainingAgorot: b.remainingAgorot,
      overpaidAgorot: b.overpaidAgorot,
    };
  }

  /** What is still owed on a schedule item after payments assigned to it. */
  itemRemaining(item: ResolvedItem): number | null {
    if (item.status !== "pending") return 0;
    if (item.amountAgorot == null) return null;
    return Math.max(0, item.amountAgorot - paidTowardsItem(item.id, this.payments));
  }

  contractDetail(c: ContractRow): ContractDetailDto {
    return {
      ...this.contractDto(c),
      schedule: this.items(c.id)
        .sort((a, b) => a.sortOrder - b.sortOrder || (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
        .map((i) => ({ ...i, remainingAgorot: this.itemRemaining(i) })),
      payments: this.payments
        .filter((p) => p.contractId === c.id)
        .sort((a, b) => b.paidOn.localeCompare(a.paidOn))
        .map(toPaymentDto),
    };
  }

  private toDue(c: ContractRow, item: ResolvedItem): DueItemDto {
    return {
      scheduleItemId: item.id,
      contractId: c.id,
      vendorName: c.vendorName,
      label: item.label,
      dueDate: item.dueDate!,
      remainingAgorot: this.itemRemaining(item),
    };
  }

  nextDue(c: ContractRow): DueItemDto | null {
    const next = this.balance(c).nextDue;
    return next ? this.toDue(c, next.item) : null;
  }

  /** Only approved contracts create obligations. */
  approved(): ContractRow[] {
    return this.contracts.filter((c) => c.status === "approved");
  }

  overdue(): DueItemDto[] {
    return this.approved()
      .flatMap((c) => this.balance(c).overdue.map((o) => this.toDue(c, o.item)))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  upcoming(limit = 5): DueItemDto[] {
    return this.approved()
      .flatMap((c) =>
        this.items(c.id)
          .filter((i) => i.status === "pending" && i.dueDate != null && i.dueDate >= this.today)
          .map((i) => this.toDue(c, i)),
      )
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, limit);
  }

  summary() {
    return summarizeExpenses(this.contracts, this.payments, this.event.estimatedBudgetAgorot);
  }
}

export async function loadLedger(db: Db | Tx, ev: EventRow, contractId?: string): Promise<Ledger> {
  const contractWhere = [eq(contract.eventId, ev.id), isNull(contract.deletedAt)];
  if (contractId) contractWhere.push(eq(contract.id, contractId));

  const contracts = await db
    .select()
    .from(contract)
    .where(and(...contractWhere))
    .orderBy(asc(contract.createdAt));
  const ids = contracts.map((c) => c.id);
  if (ids.length === 0) return new Ledger(ev, [], [], []);

  const [items, payments] = await Promise.all([
    db
      .select()
      .from(paymentScheduleItem)
      .where(and(inArray(paymentScheduleItem.contractId, ids), isNull(paymentScheduleItem.deletedAt))),
    db
      .select()
      .from(payment)
      .where(and(inArray(payment.contractId, ids), isNull(payment.deletedAt))),
  ]);
  return new Ledger(ev, contracts, items, payments);
}

/** An item is `paid` once payments assigned to it cover it; partial payment keeps it pending. */
export async function refreshScheduleStatuses(tx: Tx, ev: EventRow, c: ContractRow): Promise<void> {
  const rows = await tx
    .select()
    .from(paymentScheduleItem)
    .where(and(eq(paymentScheduleItem.contractId, c.id), isNull(paymentScheduleItem.deletedAt)));
  const payments = await tx
    .select()
    .from(payment)
    .where(and(eq(payment.contractId, c.id), isNull(payment.deletedAt)));

  for (const row of rows) {
    if (row.status === "cancelled") continue;
    const covered = isScheduleItemCovered(resolveItem(row, c, ev.eventDate), payments);
    const status = covered ? "paid" : "pending";
    if (status !== row.status) {
      await tx.update(paymentScheduleItem).set({ status }).where(eq(paymentScheduleItem.id, row.id));
    }
  }
}
