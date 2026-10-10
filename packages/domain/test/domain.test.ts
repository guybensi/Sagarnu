import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  can,
  contractBalance,
  countdown,
  isValidIsoDate,
  jerusalemInstant,
  perGuestTotal,
  resolveDueDate,
  resolveScheduleAmount,
  shekelsToAgorot,
  summarizeExpenses,
  todayIso,
  type ScheduleItemLike,
} from "../src";

describe("money", () => {
  it.each([
    ["12,500", 1_250_000],
    ["1250.5", 125_050],
    ["0.99", 99],
    ["₪ 3 000", 300_000],
    [42, 4200],
  ])("parses %s", (input, expected) => {
    expect(shekelsToAgorot(input)).toBe(expected);
  });

  it.each(["", "abc", "1.234", "-5", "1e3"])("rejects %s", (input) => {
    expect(shekelsToAgorot(input)).toBeNull();
  });
});

describe("dates", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDaysIso("2026-12-29", 5)).toBe("2027-01-03");
    expect(addDaysIso("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("validates calendar dates", () => {
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("2028-02-29")).toBe(true);
  });

  it("uses Israel time for today", () => {
    // 22:30 UTC on Oct 10 is already Oct 11 in Israel (UTC+3 in summer time).
    expect(todayIso(new Date("2026-10-10T22:30:00Z"))).toBe("2026-10-11");
  });

  it("converts local time to the correct instant in summer and winter", () => {
    expect(jerusalemInstant("2026-07-01", "20:00").toISOString()).toBe("2026-07-01T17:00:00.000Z");
    expect(jerusalemInstant("2026-12-01", "20:00").toISOString()).toBe("2026-12-01T18:00:00.000Z");
  });
});

describe("permissions", () => {
  it("follows the role matrix", () => {
    expect(can("viewer", "event.view")).toBe(true);
    expect(can("viewer", "contract.write")).toBe(false);
    expect(can("editor", "payment.write")).toBe(true);
    expect(can("editor", "members.manage")).toBe(false);
    expect(can("owner", "event.delete")).toBe(true);
    expect(can(null, "event.view")).toBe(false);
  });
});

describe("schedule", () => {
  it("resolves relative due dates from the event date", () => {
    const item = { dueDate: "2026-01-01", relativeAnchor: "event" as const, relativeDays: -7 };
    expect(resolveDueDate(item, { eventDate: "2026-06-10", signingDate: null })).toBe("2026-06-03");
    expect(resolveDueDate(item, { eventDate: null, signingDate: null })).toBe("2026-01-01");
  });

  it("resolves percent amounts", () => {
    expect(resolveScheduleAmount({ amountAgorot: null, percent: 30 }, 1_000_000)).toBe(300_000);
    expect(resolveScheduleAmount({ amountAgorot: 5000, percent: 30 }, 1_000_000)).toBe(5000);
    expect(resolveScheduleAmount({ amountAgorot: null, percent: 30 }, null)).toBeNull();
  });

  it("computes per-guest totals using the minimum", () => {
    expect(perGuestTotal(25_000, 200, 250)).toBe(6_250_000);
    expect(perGuestTotal(25_000, 300, 250)).toBe(7_500_000);
    expect(perGuestTotal(25_000, null, null)).toBeNull();
  });
});

describe("balances", () => {
  const items: ScheduleItemLike[] = [
    {
      id: "a",
      contractId: "c1",
      label: "מקדמה",
      amountAgorot: 300_000,
      dueDate: "2026-01-01",
      status: "pending",
    },
    {
      id: "b",
      contractId: "c1",
      label: "תשלום 2",
      amountAgorot: 300_000,
      dueDate: "2026-05-01",
      status: "pending",
    },
    {
      id: "c",
      contractId: "c1",
      label: "יתרה",
      amountAgorot: 400_000,
      dueDate: "2026-06-01",
      status: "pending",
    },
  ];

  it("finds overdue and next due items with partial payments", () => {
    const b = contractBalance(
      { id: "c1", status: "approved", totalAmountAgorot: 1_000_000 },
      [{ contractId: "c1", scheduleItemId: "a", amountAgorot: 100_000 }],
      items,
      "2026-03-01",
    );
    expect(b.paidAgorot).toBe(100_000);
    expect(b.remainingAgorot).toBe(900_000);
    expect(b.overdue.map((o) => [o.item.id, o.remainingAgorot])).toEqual([["a", 200_000]]);
    expect(b.nextDue?.item.id).toBe("b");
  });

  it("reports overpayment instead of a negative remainder", () => {
    const b = contractBalance(
      { id: "c1", status: "approved", totalAmountAgorot: 100_000 },
      [{ contractId: "c1", scheduleItemId: null, amountAgorot: 120_000 }],
      [],
      "2026-03-01",
    );
    expect(b.remainingAgorot).toBe(0);
    expect(b.overpaidAgorot).toBe(20_000);
  });

  it("counts payments to inactive vendors as spent", () => {
    const s = summarizeExpenses(
      [
        { id: "c1", status: "approved", totalAmountAgorot: 1_000_000 },
        { id: "c2", status: "cancelled", totalAmountAgorot: 500_000 },
      ],
      [
        { contractId: "c1", scheduleItemId: null, amountAgorot: 200_000 },
        { contractId: "c2", scheduleItemId: null, amountAgorot: 50_000 },
      ],
      1_000_000,
    );
    expect(s).toMatchObject({
      committedAgorot: 1_000_000,
      paidAgorot: 250_000,
      paidInactiveAgorot: 50_000,
      remainingAgorot: 800_000,
      budgetLeftAgorot: -50_000,
      isOverBudget: true,
    });
  });
});

describe("countdown", () => {
  it("splits the remaining time", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(countdown(new Date("2026-01-03T05:07:00Z"), now)).toEqual({
      days: 2,
      hours: 5,
      minutes: 7,
      isPast: false,
    });
    expect(countdown(new Date("2025-01-01T00:00:00Z"), now).isPast).toBe(true);
  });
});
