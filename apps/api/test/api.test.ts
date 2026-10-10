import { schema } from "@sagarnu/db";
import { addDaysIso, todayIso } from "@sagarnu/domain";
import type {
  CategoryDto,
  ContractDetailDto,
  DashboardDto,
  EventDto,
  ExpensesDto,
  PaymentResultDto,
} from "@sagarnu/schemas";
import type { InjectOptions } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setup } from "./helpers";

type Ctx = Awaited<ReturnType<typeof setup>>;

describe("api", () => {
  let ctx: Ctx;
  let dana: { cookie: string; origin: string };
  let stranger: { cookie: string; origin: string };

  const call = (who: { cookie: string; origin: string }, opts: InjectOptions) =>
    ctx.app.inject({ ...opts, headers: { cookie: who.cookie, origin: who.origin, ...opts.headers } });

  beforeAll(async () => {
    ctx = await setup();
    dana = await ctx.signUp("דנה", "dana@example.com");
    stranger = await ctx.signUp("זר", "stranger@example.com");
  });
  afterAll(() => ctx.close());

  it("rejects weak passwords on sign-up", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/v1/auth/sign-up/email",
      headers: { origin: ctx.env.WEB_ORIGIN },
      payload: { name: "חלש", email: "weak@example.com", password: "password", userType: "couple" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("requires a session", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/v1/events" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ code: "unauthorized" });
  });

  it("runs the core flow: event → contract → payment → dashboard", async () => {
    const eventDate = addDaysIso(todayIso(), 120);
    const created = await call(dana, {
      method: "POST",
      url: "/v1/events",
      payload: {
        name: "החתונה של דנה ויואב",
        eventDate,
        eventTime: "19:30",
        guestCount: 250,
        estimatedBudgetAgorot: 15_000_000,
        relevantCategoryKeys: ["venue", "photo", "dj"],
        completeQuestionnaire: true,
      },
    });
    expect(created.statusCode).toBe(201);
    const ev = created.json<EventDto>();
    expect(ev).toMatchObject({ role: "owner", eventTime: "19:30", guestCount: 250 });

    // Couples may own a single event.
    const second = await call(dana, { method: "POST", url: "/v1/events", payload: { name: "עוד אחד" } });
    expect(second.json()).toEqual({ code: "couple_event_limit" });

    const categories = (await call(dana, { method: "GET", url: `/v1/events/${ev.id}/categories` })).json<
      CategoryDto[]
    >();
    const venue = categories.find((c) => c.key === "venue")!;
    expect(categories.find((c) => c.key === "catering")?.isRelevant).toBe(false);

    const contractRes = await call(dana, {
      method: "POST",
      url: `/v1/events/${ev.id}/contracts`,
      payload: {
        categoryId: venue.id,
        status: "approved",
        vendorName: "אולמי הגן",
        totalAmountAgorot: 10_000_000,
        schedule: [
          { label: "מקדמה", percent: 30, dueDate: addDaysIso(todayIso(), -5) },
          { label: "יתרה", amountAgorot: 7_000_000, relativeAnchor: "event", relativeDays: -7 },
        ],
      },
    });
    expect(contractRes.statusCode).toBe(201);
    const contract = contractRes.json<ContractDetailDto>();
    expect(contract.schedule.map((s) => s.amountAgorot)).toEqual([3_000_000, 7_000_000]);
    expect(contract.schedule[1]!.dueDate).toBe(addDaysIso(eventDate, -7));

    let dash = (
      await call(dana, { method: "GET", url: `/v1/events/${ev.id}/dashboard` })
    ).json<DashboardDto>();
    expect(dash.overdue).toHaveLength(1);
    expect(dash.vendors.missingCategories.map((c) => c.nameHe)).toEqual(["צילום סטילס", "די-ג׳יי"]);

    const deposit = contract.schedule[0]!;
    const paid = await call(dana, {
      method: "POST",
      url: `/v1/events/${ev.id}/contracts/${contract.id}/payments`,
      payload: {
        amountAgorot: 3_000_000,
        method: "bank_transfer",
        paidOn: todayIso(),
        scheduleItemId: deposit.id,
      },
    });
    expect(paid.statusCode).toBe(201);
    const result = paid.json<PaymentResultDto>();
    expect(result.remainingAgorot).toBe(7_000_000);
    expect(result.nextDue?.label).toBe("יתרה");

    dash = (await call(dana, { method: "GET", url: `/v1/events/${ev.id}/dashboard` })).json<DashboardDto>();
    expect(dash.overdue).toHaveLength(0);
    expect(dash.summary).toMatchObject({ paidAgorot: 3_000_000, remainingAgorot: 7_000_000 });

    // Overpaying needs confirmation.
    const over = await call(dana, {
      method: "POST",
      url: `/v1/events/${ev.id}/contracts/${contract.id}/payments`,
      payload: { amountAgorot: 8_000_000, method: "cash", paidOn: todayIso() },
    });
    expect(over.json()).toEqual({ code: "confirmation_required", details: { overpaidAgorot: 1_000_000 } });

    // The second edit still sends version 1, so it is rejected.
    const stale = await call(dana, {
      method: "PATCH",
      url: `/v1/events/${ev.id}/contracts/${contract.id}`,
      payload: { version: 1, notes: "ראשון" },
    });
    expect(stale.statusCode).toBe(200);
    const conflict = await call(dana, {
      method: "PATCH",
      url: `/v1/events/${ev.id}/contracts/${contract.id}`,
      payload: { version: 1, notes: "שני" },
    });
    expect(conflict.json()).toEqual({ code: "version_conflict" });

    // Leaving approved cancels pending items but keeps payments.
    const needConfirm = await call(dana, {
      method: "POST",
      url: `/v1/events/${ev.id}/contracts/${contract.id}/status`,
      payload: { status: "cancelled" },
    });
    expect(needConfirm.json()).toMatchObject({ code: "confirmation_required", details: { pendingCount: 1 } });
    const cancelled = await call(dana, {
      method: "POST",
      url: `/v1/events/${ev.id}/contracts/${contract.id}/status`,
      payload: { status: "cancelled", confirm: true },
    });
    expect(cancelled.json<ContractDetailDto>().schedule.map((s) => s.status)).toEqual(["paid", "cancelled"]);

    const expenses = (
      await call(dana, { method: "GET", url: `/v1/events/${ev.id}/expenses` })
    ).json<ExpensesDto>();
    expect(expenses.rows).toHaveLength(0);
    expect(expenses.summary.paidInactiveAgorot).toBe(3_000_000);

    // Strangers get 404, never 403, and cannot see the event exists.
    for (const url of [`/v1/events/${ev.id}`, `/v1/events/${ev.id}/contracts/${contract.id}`]) {
      const res = await call(stranger, { method: "GET", url });
      expect(res.statusCode).toBe(404);
    }

    const audit = await ctx.db.select().from(schema.auditLog);
    expect(audit.some((a) => a.action === "status")).toBe(true);
  });

  it("asks for confirmation before deleting a contract with payments", async () => {
    const ev = (await call(dana, { method: "GET", url: "/v1/events" })).json<EventDto[]>()[0]!;
    const [contract] = (await call(dana, { method: "GET", url: `/v1/events/${ev.id}/contracts` })).json<
      { id: string }[]
    >();
    const res = await call(dana, { method: "DELETE", url: `/v1/events/${ev.id}/contracts/${contract!.id}` });
    expect(res.json()).toMatchObject({ code: "confirmation_required", details: { paymentCount: 1 } });
    const ok = await call(dana, {
      method: "DELETE",
      url: `/v1/events/${ev.id}/contracts/${contract!.id}?confirm=true`,
    });
    expect(ok.statusCode).toBe(204);
  });
});
