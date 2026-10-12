import type { CategoryDto, EventDto, ExpensesDto, PaymentResultDto } from "@sagarnu/schemas";
import type { InjectOptions } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setup } from "./helpers";

describe("partners and payers", () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  let owner: { cookie: string; origin: string };
  let eventId: string;
  let contractId: string;

  const call = (opts: InjectOptions) =>
    ctx.app.inject({ ...opts, headers: { cookie: owner.cookie, origin: owner.origin, ...opts.headers } });
  const pay = (payload: Record<string, unknown>) =>
    call({
      method: "POST",
      url: `/v1/events/${eventId}/contracts/${contractId}/payments`,
      payload: { method: "bank_transfer", paidOn: "2026-10-01", ...payload },
    });

  beforeAll(async () => {
    ctx = await setup();
    owner = await ctx.signUp("נועה", "noa-payers@example.com");
    const created = await call({
      method: "POST",
      url: "/v1/events",
      payload: {
        name: "החתונה של נועה ומאיה",
        partner1Name: "נועה",
        partner2Name: "מאיה",
        partner1Role: "bride",
        partner2Role: "bride",
        defaultPayer: "joint",
        // Dropped: a name only goes with "other".
        defaultPayerName: "לא רלוונטי",
      },
    });
    expect(created.statusCode).toBe(201);
    const ev = created.json<EventDto>();
    eventId = ev.id;
    expect(ev).toMatchObject({
      partner1Role: "bride",
      partner2Role: "bride",
      defaultPayer: "joint",
      defaultPayerName: null,
    });

    const cats = (await call({ method: "GET", url: `/v1/events/${eventId}/categories` })).json<
      CategoryDto[]
    >();
    contractId = (
      await call({
        method: "POST",
        url: `/v1/events/${eventId}/contracts`,
        payload: {
          categoryId: cats[0]!.id,
          status: "approved",
          vendorName: "ספק",
          totalAmountAgorot: 100_000,
        },
      })
    ).json<{ id: string }>().id;
  });

  afterAll(() => ctx.close());

  it("stores who paid each payment and sums it up in expenses", async () => {
    expect((await pay({ amountAgorot: 30_000, payer: "joint" })).statusCode).toBe(201);
    expect((await pay({ amountAgorot: 20_000, payer: "other", payerName: "סבתא רחל" })).statusCode).toBe(201);
    const unnamed = await pay({ amountAgorot: 10_000, payer: "partner1", payerName: "יימחק" });
    expect(unnamed.json<PaymentResultDto>().payment).toMatchObject({ payer: "partner1", payerName: null });
    expect((await pay({ amountAgorot: 5_000 })).statusCode).toBe(201);

    const expenses = (
      await call({ method: "GET", url: `/v1/events/${eventId}/expenses` })
    ).json<ExpensesDto>();
    const expected = [
      { payer: "joint", payerName: null, amountAgorot: 30_000 },
      { payer: "other", payerName: "סבתא רחל", amountAgorot: 20_000 },
      { payer: "partner1", payerName: null, amountAgorot: 10_000 },
      { payer: null, payerName: null, amountAgorot: 5_000 },
    ];
    expect(expenses.paidBy).toEqual(expected);
    expect(expenses.rows[0]!.paidBy).toEqual(expected);
  });

  it("changes the payer of an existing payment", async () => {
    const created = (
      await pay({ amountAgorot: 1_000, payer: "other", payerName: "דוד משה" })
    ).json<PaymentResultDto>();
    const res = await call({
      method: "PATCH",
      url: `/v1/events/${eventId}/payments/${created.payment.id}`,
      payload: { payer: "partner2_parents" },
    });
    expect(res.statusCode).toBe(200);
    const expenses = (
      await call({ method: "GET", url: `/v1/events/${eventId}/expenses` })
    ).json<ExpensesDto>();
    expect(expenses.paidBy).toContainEqual({
      payer: "partner2_parents",
      payerName: null,
      amountAgorot: 1_000,
    });
    expect(expenses.paidBy.some((t) => t.payerName === "דוד משה")).toBe(false);
  });
});
