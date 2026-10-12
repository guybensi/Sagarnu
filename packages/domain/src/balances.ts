import type { IsoDate } from "./dates";
import type { ContractStatus, Payer, ScheduleStatus } from "./enums";
import { sumAgorot, type Agorot } from "./money";

export interface ContractLike {
  id: string;
  status: ContractStatus;
  totalAmountAgorot: Agorot | null;
}

export interface PaymentLike {
  contractId: string;
  scheduleItemId: string | null;
  amountAgorot: Agorot;
}

export interface ScheduleItemLike {
  id: string;
  contractId: string;
  label: string;
  /** Already resolved (percent → amount). */
  amountAgorot: Agorot | null;
  /** Already resolved (relative → date). */
  dueDate: IsoDate | null;
  status: ScheduleStatus;
}

export interface OpenScheduleItem<T extends ScheduleItemLike = ScheduleItemLike> {
  item: T;
  /** What is still owed on this item after payments assigned to it. */
  remainingAgorot: Agorot | null;
}

export interface ContractBalance<T extends ScheduleItemLike = ScheduleItemLike> {
  totalAgorot: Agorot | null;
  paidAgorot: Agorot;
  /** Never negative. */
  remainingAgorot: Agorot | null;
  /** How much was paid above the total (extras, tips). */
  overpaidAgorot: Agorot;
  nextDue: OpenScheduleItem<T> | null;
  overdue: OpenScheduleItem<T>[];
}

export function paidTowardsItem(itemId: string, payments: readonly PaymentLike[]): Agorot {
  return sumAgorot(payments.filter((p) => p.scheduleItemId === itemId).map((p) => p.amountAgorot));
}

/** An item becomes paid once the payments assigned to it cover its amount. */
export function isScheduleItemCovered(item: ScheduleItemLike, payments: readonly PaymentLike[]): boolean {
  return item.amountAgorot != null && paidTowardsItem(item.id, payments) >= item.amountAgorot;
}

export function contractBalance<T extends ScheduleItemLike>(
  contract: ContractLike,
  payments: readonly PaymentLike[],
  items: readonly T[],
  today: IsoDate,
): ContractBalance<T> {
  const own = payments.filter((p) => p.contractId === contract.id);
  const paid = sumAgorot(own.map((p) => p.amountAgorot));
  const total = contract.totalAmountAgorot;

  const open = items
    .filter(
      (i): i is T & { dueDate: IsoDate } =>
        i.contractId === contract.id && i.status === "pending" && i.dueDate != null,
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((item) => ({
      item,
      remainingAgorot:
        item.amountAgorot == null ? null : Math.max(0, item.amountAgorot - paidTowardsItem(item.id, own)),
    }));

  return {
    totalAgorot: total,
    paidAgorot: paid,
    remainingAgorot: total == null ? null : Math.max(0, total - paid),
    overpaidAgorot: total == null ? 0 : Math.max(0, paid - total),
    nextDue: open.find((o) => o.item.dueDate >= today) ?? null,
    overdue: open.filter((o) => o.item.dueDate < today),
  };
}

export interface ExpenseSummary {
  /** Sum of totals of approved contracts. */
  committedAgorot: Agorot;
  /** Everything actually paid, including to vendors that are no longer active. */
  paidAgorot: Agorot;
  /** Paid to contracts that are no longer approved — money that already left. */
  paidInactiveAgorot: Agorot;
  /** What is still owed on approved contracts. */
  remainingAgorot: Agorot;
  budgetAgorot: Agorot | null;
  /** budget − paid − remaining. Negative means over budget. */
  budgetLeftAgorot: Agorot | null;
  isOverBudget: boolean;
}

export function summarizeExpenses(
  contracts: readonly ContractLike[],
  payments: readonly PaymentLike[],
  budgetAgorot: Agorot | null,
): ExpenseSummary {
  const ids = new Set(contracts.map((c) => c.id));
  const approved = contracts.filter((c) => c.status === "approved");
  const approvedIds = new Set(approved.map((c) => c.id));
  const live = payments.filter((p) => ids.has(p.contractId));

  const paid = sumAgorot(live.map((p) => p.amountAgorot));
  const paidInactive = sumAgorot(
    live.filter((p) => !approvedIds.has(p.contractId)).map((p) => p.amountAgorot),
  );
  const committed = sumAgorot(approved.map((c) => c.totalAmountAgorot ?? 0));
  const remaining = sumAgorot(
    approved.map((c) => {
      const paidOn = sumAgorot(live.filter((p) => p.contractId === c.id).map((p) => p.amountAgorot));
      return Math.max(0, (c.totalAmountAgorot ?? 0) - paidOn);
    }),
  );
  const budgetLeft = budgetAgorot == null ? null : budgetAgorot - paid - remaining;

  return {
    committedAgorot: committed,
    paidAgorot: paid,
    paidInactiveAgorot: paidInactive,
    remainingAgorot: remaining,
    budgetAgorot,
    budgetLeftAgorot: budgetLeft,
    isOverBudget: budgetLeft != null && budgetLeft < 0,
  };
}

export interface PayerTotal {
  payer: Payer | null;
  /** Set for `other` only. */
  payerName: string | null;
  amountAgorot: Agorot;
}

/** Same payer: same kind, and for `other` the same name (ignoring case and spaces around it). */
export function payerKey(payer: Payer | null, payerName: string | null): string {
  if (payer === "other") return `other:${(payerName ?? "").trim().toLowerCase()}`;
  return payer ?? "unknown";
}

/** Who paid how much, largest first. */
export function totalsByPayer(
  payments: readonly (Pick<PaymentLike, "amountAgorot"> & {
    payer: Payer | null;
    payerName: string | null;
  })[],
): PayerTotal[] {
  const totals = new Map<string, PayerTotal>();
  for (const p of payments) {
    const key = payerKey(p.payer, p.payerName);
    const total = totals.get(key);
    if (total) total.amountAgorot += p.amountAgorot;
    else
      totals.set(key, {
        payer: p.payer,
        payerName: p.payer === "other" ? (p.payerName?.trim() ?? null) : null,
        amountAgorot: p.amountAgorot,
      });
  }
  return [...totals.values()].sort((a, b) => b.amountAgorot - a.amountAgorot);
}
