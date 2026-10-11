import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  can,
  contractBalance,
  countdown,
  daysUntil,
  formatPhone,
  isValidIsoDate,
  jerusalemInstant,
  normalizePhone,
  perGuestTotal,
  resolveDueDate,
  resolveScheduleAmount,
  shekelsToAgorot,
  summarizeExpenses,
  timeOfDayFor,
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

describe("event timing", () => {
  it("derives noon/evening from the start time", () => {
    expect(timeOfDayFor("12:30")).toBe("noon");
    expect(timeOfDayFor("16:59")).toBe("noon");
    expect(timeOfDayFor("17:00")).toBe("evening");
    expect(timeOfDayFor("19:30")).toBe("evening");
    expect(timeOfDayFor(null)).toBeNull();
  });

  it("counts calendar days to the event", () => {
    expect(daysUntil("2026-10-11", "2026-10-10")).toBe(1);
    expect(daysUntil("2026-10-10", "2026-10-10")).toBe(0);
    expect(daysUntil("2027-10-10", "2026-10-10")).toBe(365);
    // Across the DST change (Oct 25, 2026) a day is still a day.
    expect(daysUntil("2026-11-01", "2026-10-20")).toBe(12);
    expect(daysUntil("2026-10-01", "2026-10-10")).toBe(-9);
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

describe("phone", () => {
  it("normalizes how people type Israeli numbers", () => {
    expect(normalizePhone("050-123 4567")).toBe("+972501234567");
    expect(normalizePhone("0501234567")).toBe("+972501234567");
    expect(normalizePhone("972501234567")).toBe("+972501234567");
    expect(normalizePhone("+972 (0)50 123 4567")).toBe("+972501234567");
    expect(normalizePhone("00972501234567")).toBe("+972501234567");
    expect(normalizePhone("03-1234567")).toBe("+97231234567");
    expect(normalizePhone("+1 415 555 0100")).toBe("+14155550100");
  });

  it("rejects what is not a phone number", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("050-123")).toBeNull();
    expect(normalizePhone("1234567")).toBeNull();
    expect(normalizePhone("+97201234567")).toBeNull();
  });

  it("formats Israeli numbers for display", () => {
    expect(formatPhone("+972501234567")).toBe("050-123-4567");
    expect(formatPhone("+97231234567")).toBe("03-123-4567");
    expect(formatPhone("+14155550100")).toBe("+14155550100");
  });
});
