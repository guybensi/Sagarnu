import type { CategoryDto, ContractDetailDto, ContractFileDto, EventDto } from "@sagarnu/schemas";
import type { InjectOptions } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setup } from "./helpers";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF");
// Enough of a .docx for the byte check: a ZIP whose entries include word/document.xml.
const DOCX = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("....word/document.xml....")]);
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const dataUrl = (mime: string, bytes: Buffer) => `data:${mime};base64,${bytes.toString("base64")}`;

describe("contract files", () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  let owner: { cookie: string; origin: string };
  let stranger: { cookie: string; origin: string };
  let eventId: string;
  let contractId: string;

  const call = (who: { cookie: string; origin: string }, opts: InjectOptions) =>
    ctx.app.inject({ ...opts, headers: { cookie: who.cookie, origin: who.origin, ...opts.headers } });
  const upload = (who: typeof owner, name: string, url: string) =>
    call(who, {
      method: "POST",
      url: `/v1/events/${eventId}/contracts/${contractId}/files`,
      payload: { name, dataUrl: url },
    });
  const detail = async () =>
    (
      await call(owner, { method: "GET", url: `/v1/events/${eventId}/contracts/${contractId}` })
    ).json<ContractDetailDto>();

  beforeAll(async () => {
    ctx = await setup();
    owner = await ctx.signUp("רוני", "roni-files@example.com");
    stranger = await ctx.signUp("זר", "stranger-files@example.com");
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
        payload: { categoryId: cats[0]!.id, status: "approved", vendorName: "צלם" },
      })
    ).json<{ id: string }>().id;
  });

  afterAll(() => ctx.close());

  it("uploads a PDF and a Word file, listed on the contract", async () => {
    const pdf = await upload(owner, "חוזה חתום.pdf", dataUrl("application/pdf", PDF));
    expect(pdf.statusCode).toBe(201);
    const docx = await upload(owner, "הצעת מחיר.docx", dataUrl(DOCX_MIME, DOCX));
    expect(docx.statusCode).toBe(201);
    expect(docx.json<ContractFileDto>().mime).toBe(DOCX_MIME);

    const files = (await detail()).files;
    expect(files.map((f) => f.name)).toEqual(["חוזה חתום.pdf", "הצעת מחיר.docx"]);
  });

  it("opens PDFs in the browser and downloads Word files", async () => {
    const [pdf, docx] = (await detail()).files;
    const pdfRes = await call(owner, { method: "GET", url: pdf!.url });
    expect(pdfRes.statusCode).toBe(200);
    expect(pdfRes.headers["content-type"]).toBe("application/pdf");
    expect(pdfRes.headers["content-disposition"]).toMatch(/^inline;/);
    expect(pdfRes.headers["content-security-policy"]).toMatch(/sandbox/);

    const docxRes = await call(owner, { method: "GET", url: docx!.url });
    expect(docxRes.headers["content-disposition"]).toMatch(/^attachment;/);
  });

  it("rejects files that are not what they claim, and non-members", async () => {
    const fake = await upload(owner, "x.pdf", dataUrl("application/pdf", Buffer.from("not a pdf")));
    expect(fake.statusCode).toBe(422);
    const outsider = await upload(stranger, "x.pdf", dataUrl("application/pdf", PDF));
    expect(outsider.statusCode).toBe(404);
    const [pdf] = (await detail()).files;
    expect((await call(stranger, { method: "GET", url: pdf!.url })).statusCode).toBe(404);
  });

  it("deletes a file", async () => {
    const [pdf] = (await detail()).files;
    const res = await call(owner, { method: "DELETE", url: pdf!.url });
    expect(res.statusCode).toBe(204);
    expect((await detail()).files).toHaveLength(1);
  });
});
