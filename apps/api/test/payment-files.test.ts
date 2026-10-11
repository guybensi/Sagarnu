import type {
  CategoryDto,
  ContractDetailDto,
  EventDto,
  PaymentFileDto,
  PaymentResultDto,
} from "@sagarnu/schemas";
import type { InjectOptions } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setup } from "./helpers";

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF",
).toString("base64");

describe("payment files", () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  let owner: { cookie: string; origin: string };
  let stranger: { cookie: string; origin: string };
  let eventId: string;
  let contractId: string;
  let paymentId: string;

  const call = (who: { cookie: string; origin: string }, opts: InjectOptions) =>
    ctx.app.inject({ ...opts, headers: { cookie: who.cookie, origin: who.origin, ...opts.headers } });
  const upload = (who: typeof owner, body: Record<string, unknown>) =>
    call(who, { method: "POST", url: `/v1/events/${eventId}/payments/${paymentId}/files`, payload: body });

  beforeAll(async () => {
    ctx = await setup();
    owner = await ctx.signUp("אור", "or@example.com");
    stranger = await ctx.signUp("זר", "stranger3@example.com");
    eventId = (
      await call(owner, { method: "POST", url: "/v1/events", payload: { name: "בדיקה" } })
    ).json<EventDto>().id;
    const cats = (await call(owner, { method: "GET", url: `/v1/events/${eventId}/categories` })).json<
      CategoryDto[]
    >();
    contractId = (
      await call(owner, {
        method: "POST",
        url: `/v1/events/${eventId}/contracts`,
        payload: {
          categoryId: cats[0]!.id,
          status: "approved",
          vendorName: "ספק",
          totalAmountAgorot: 100_000,
        },
      })
    ).json<ContractDetailDto>().id;
    paymentId = (
      await call(owner, {
        method: "POST",
        url: `/v1/events/${eventId}/contracts/${contractId}/payments`,
        payload: { amountAgorot: 50_000, method: "cash", paidOn: "2026-10-01" },
      })
    ).json<PaymentResultDto>().payment.id;
  });
  afterAll(() => ctx.close());

  it("stores a PDF receipt and an image confirmation, and lists them with the payment", async () => {
    const pdf = await upload(owner, {
      kind: "receipt",
      name: "קבלה מספר 17.pdf",
      dataUrl: `data:application/pdf;base64,${PDF}`,
    });
    expect(pdf.statusCode).toBe(201);
    expect(pdf.json<PaymentFileDto>()).toMatchObject({
      kind: "receipt",
      mime: "application/pdf",
      name: "קבלה מספר 17.pdf",
    });

    const img = await upload(owner, {
      kind: "confirmation",
      name: "אישור.png",
      dataUrl: `data:image/png;base64,${PNG}`,
    });
    expect(img.statusCode).toBe(201);

    const detail = (
      await call(owner, { method: "GET", url: `/v1/events/${eventId}/contracts/${contractId}` })
    ).json<ContractDetailDto>();
    expect(detail.payments[0]!.files.map((f) => [f.kind, f.mime])).toEqual([
      ["receipt", "application/pdf"],
      ["confirmation", "image/png"],
    ]);
  });

  it("serves files only to event members, safely", async () => {
    const detail = (
      await call(owner, { method: "GET", url: `/v1/events/${eventId}/contracts/${contractId}` })
    ).json<ContractDetailDto>();
    const file = detail.payments[0]!.files[0]!;
    const res = await call(owner, { method: "GET", url: file.url });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-security-policy"]).toMatch(/sandbox/);
    expect(res.headers["content-disposition"]).toContain("filename*=UTF-8''");
    expect(res.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");

    expect((await call(stranger, { method: "GET", url: file.url })).statusCode).toBe(404);
  });

  it("rejects files whose bytes are not a PDF or image", async () => {
    const fake = Buffer.from("<html><script>alert(1)</script></html>").toString("base64");
    const res = await upload(owner, {
      kind: "receipt",
      name: "x.pdf",
      dataUrl: `data:application/pdf;base64,${fake}`,
    });
    expect(res.statusCode).toBe(422);
  });

  it("lets strangers neither upload nor delete", async () => {
    const res = await upload(stranger, {
      kind: "receipt",
      name: "x.png",
      dataUrl: `data:image/png;base64,${PNG}`,
    });
    expect(res.statusCode).toBe(404);
  });

  it("deletes a file and enforces the per-payment limit", async () => {
    const detail = (
      await call(owner, { method: "GET", url: `/v1/events/${eventId}/contracts/${contractId}` })
    ).json<ContractDetailDto>();
    const file = detail.payments[0]!.files[1]!;
    expect((await call(stranger, { method: "DELETE", url: file.url })).statusCode).toBe(404);
    expect((await call(owner, { method: "DELETE", url: file.url })).statusCode).toBe(204);
    expect((await call(owner, { method: "GET", url: file.url })).statusCode).toBe(404);

    // 1 left; fill up to the limit (6), then the 7th is refused.
    for (let i = 0; i < 5; i++) {
      expect(
        (await upload(owner, { kind: "receipt", name: `r${i}.png`, dataUrl: `data:image/png;base64,${PNG}` }))
          .statusCode,
      ).toBe(201);
    }
    const over = await upload(owner, {
      kind: "receipt",
      name: "r6.png",
      dataUrl: `data:image/png;base64,${PNG}`,
    });
    expect(over.json()).toMatchObject({ code: "conflict" });
  });
});
