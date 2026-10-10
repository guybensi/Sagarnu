import type { CategoryDto, EventDto } from "@sagarnu/schemas";
import type { InjectOptions } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setup } from "./helpers";

// 1×1 transparent PNG.
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

describe("event extras", () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  let owner: { cookie: string; origin: string };
  let stranger: { cookie: string; origin: string };
  let ev: EventDto;

  const call = (who: { cookie: string; origin: string }, opts: InjectOptions) =>
    ctx.app.inject({ ...opts, headers: { cookie: who.cookie, origin: who.origin, ...opts.headers } });

  beforeAll(async () => {
    ctx = await setup();
    owner = await ctx.signUp("רוני", "roni@example.com");
    stranger = await ctx.signUp("זר", "stranger2@example.com");
    const res = await call(owner, {
      method: "POST",
      url: "/v1/events",
      payload: {
        name: "החתונה של רוני",
        eventTime: "13:00",
        timeOfDay: "evening",
        eventStyle: "festival",
        customCategories: ["צלם מגנטים", "בר קוקטיילים"],
      },
    });
    expect(res.statusCode).toBe(201);
    ev = res.json<EventDto>();
  });
  afterAll(() => ctx.close());

  it("derives noon/evening from the start time", async () => {
    expect(ev).toMatchObject({ timeOfDay: "noon", eventStyle: "festival", coverPhotoUrl: null });
    const updated = await call(owner, {
      method: "PATCH",
      url: `/v1/events/${ev.id}`,
      payload: { eventTime: "19:30" },
    });
    expect(updated.json<EventDto>().timeOfDay).toBe("evening");
  });

  it("creates the couple's own categories from the questionnaire", async () => {
    const cats = (await call(owner, { method: "GET", url: `/v1/events/${ev.id}/categories` })).json<
      CategoryDto[]
    >();
    const custom = cats.filter((c) => c.isCustom).map((c) => c.nameHe);
    expect(custom).toEqual(["צלם מגנטים", "בר קוקטיילים"]);
  });

  it("stores, serves and removes the dashboard photo", async () => {
    const put = await call(owner, {
      method: "PUT",
      url: `/v1/events/${ev.id}/cover`,
      payload: { dataUrl: `data:image/png;base64,${PNG}` },
    });
    expect(put.statusCode).toBe(200);
    const url = put.json<EventDto>().coverPhotoUrl!;
    expect(url).toMatch(new RegExp(`^/v1/events/${ev.id}/cover\\?v=\\d+$`));

    const img = await call(owner, { method: "GET", url });
    expect(img.statusCode).toBe(200);
    expect(img.headers["content-type"]).toBe("image/png");
    expect(img.rawPayload.subarray(1, 4).toString()).toBe("PNG");

    expect((await call(stranger, { method: "GET", url })).statusCode).toBe(404);

    const del = await call(owner, { method: "DELETE", url: `/v1/events/${ev.id}/cover` });
    expect(del.json<EventDto>().coverPhotoUrl).toBeNull();
    expect((await call(owner, { method: "GET", url })).statusCode).toBe(404);
  });

  it("rejects files that are not really images", async () => {
    const fake = Buffer.from("<script>alert(1)</script>").toString("base64");
    const res = await call(owner, {
      method: "PUT",
      url: `/v1/events/${ev.id}/cover`,
      payload: { dataUrl: `data:image/png;base64,${fake}` },
    });
    expect(res.statusCode).toBe(422);
  });
});
