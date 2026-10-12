import { schema } from "@sagarnu/db";
import type {
  CategoryDto,
  CreateInvitationResultDto,
  EventDto,
  MeDto,
  MemberDto,
  SessionDto,
} from "@sagarnu/schemas";
import { eq } from "drizzle-orm";
import type { InjectOptions } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setup } from "./helpers";

type Who = { cookie: string; origin: string };

describe("account settings, export and deletion", () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  let roni: Who;
  let partner: Who;

  const call = (who: Who, opts: InjectOptions) =>
    ctx.app.inject({ ...opts, headers: { cookie: who.cookie, origin: who.origin, ...opts.headers } });
  const me = async (who: Who) => (await call(who, { method: "GET", url: "/v1/me" })).json<MeDto>();
  const patchMe = (who: Who, payload: object) => call(who, { method: "PATCH", url: "/v1/me", payload });
  const deleteMe = (who: Who, payload: object) => call(who, { method: "DELETE", url: "/v1/me", payload });
  const createEvent = async (who: Who, name: string) =>
    (await call(who, { method: "POST", url: "/v1/events", payload: { name } })).json<EventDto>();
  const join = async (owner: Who, eventId: string, who: Who) => {
    const res = await call(owner, {
      method: "POST",
      url: `/v1/events/${eventId}/invitations`,
      payload: { email: "someone@example.com" },
    });
    const token = res.json<CreateInvitationResultDto>().inviteUrl.split("/invite/")[1]!;
    await call(who, { method: "POST", url: `/v1/invitations/${token}/accept` });
  };

  beforeAll(async () => {
    ctx = await setup();
    roni = await ctx.signUp("רוני", "roni@example.com", "planner");
    partner = await ctx.signUp("שקד", "shaked@example.com");
  });
  afterAll(() => ctx.close());

  it("profile: name, account type, phone and WhatsApp consent", async () => {
    const before = await me(roni);
    expect(before).toMatchObject({
      hasPassword: true,
      hasGoogle: false,
      phoneE164: null,
      whatsappOptInAt: null,
    });

    expect((await patchMe(roni, { whatsappOptIn: true })).statusCode).toBe(422);
    expect((await patchMe(roni, { phoneE164: "050-1234567" })).statusCode).toBe(422);

    const updated = await patchMe(roni, {
      name: "רוני כהן",
      userType: "couple",
      phoneE164: "+972501234567",
      whatsappOptIn: true,
    });
    expect(updated.statusCode).toBe(200);
    const body = updated.json<MeDto>();
    expect(body).toMatchObject({ name: "רוני כהן", userType: "couple", phoneE164: "+972501234567" });
    expect(body.whatsappOptInAt).not.toBeNull();

    // Removing the number withdraws the consent.
    const cleared = (await patchMe(roni, { phoneE164: null })).json<MeDto>();
    expect(cleared.whatsappOptInAt).toBeNull();
    await patchMe(roni, { userType: "planner" });
  });

  it("lists signed-in devices and signs them out", async () => {
    const signIn = async () => {
      const res = await ctx.app.inject({
        method: "POST",
        url: "/v1/auth/sign-in/email",
        remoteAddress: `10.9.0.${Math.floor(Math.random() * 200)}`,
        headers: { origin: ctx.env.WEB_ORIGIN, "user-agent": "Mozilla/5.0 (iPhone) Safari/604.1" },
        payload: { email: "shaked@example.com", password: "Secret1!" },
      });
      const cookie = [res.headers["set-cookie"]]
        .flat()
        .map((c) => String(c).split(";")[0])
        .join("; ");
      return { cookie, origin: ctx.env.WEB_ORIGIN };
    };
    const phone = await signIn();
    const tablet = await signIn();
    const list = (await call(partner, { method: "GET", url: "/v1/me/sessions" })).json<SessionDto[]>();
    expect(list).toHaveLength(3);
    expect(list[0]!.current).toBe(true);
    expect(list.filter((s) => s.current)).toHaveLength(1);
    expect(list.some((s) => s.userAgent?.includes("iPhone"))).toBe(true);
    expect(JSON.stringify(list)).not.toContain("token");

    // Sign out one device.
    const phoneId = (await call(phone, { method: "GET", url: "/v1/me/sessions" }))
      .json<SessionDto[]>()
      .find((s) => s.current)!.id;
    expect((await call(partner, { method: "DELETE", url: `/v1/me/sessions/${phoneId}` })).statusCode).toBe(
      204,
    );
    expect((await call(phone, { method: "GET", url: "/v1/me" })).statusCode).toBe(401);
    expect((await call(partner, { method: "DELETE", url: "/v1/me/sessions/not-a-uuid" })).statusCode).toBe(
      404,
    );
    // Someone else's session is not found.
    expect((await call(roni, { method: "DELETE", url: `/v1/me/sessions/${list[0]!.id}` })).statusCode).toBe(
      404,
    );

    // Sign out all the others; this device stays.
    expect((await call(partner, { method: "DELETE", url: "/v1/me/sessions" })).json()).toEqual({
      removed: 1,
    });
    expect((await call(tablet, { method: "GET", url: "/v1/me" })).statusCode).toBe(401);
    expect((await call(partner, { method: "GET", url: "/v1/me" })).statusCode).toBe(200);
  });

  it("exports the account and its events as a JSON download, without file contents", async () => {
    const ev = await createEvent(roni, "החתונה של רוני");
    const categories = (await call(roni, { method: "GET", url: `/v1/events/${ev.id}/categories` })).json<
      CategoryDto[]
    >();
    const contract = await call(roni, {
      method: "POST",
      url: `/v1/events/${ev.id}/contracts`,
      payload: {
        categoryId: categories[0]!.id,
        status: "approved",
        vendorName: "צלם",
        totalAmountAgorot: 500_000,
        schedule: [{ label: "מקדמה", amountAgorot: 100_000, dueDate: "2027-01-01" }],
      },
    });
    expect(contract.statusCode).toBe(201);

    const res = await call(roni, { method: "GET", url: "/v1/me/export" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-disposition"]).toMatch(
      /attachment; filename="sagarnu-export-\d{4}-\d{2}-\d{2}\.json"/,
    );
    const data = res.json();
    expect(data.account).toMatchObject({
      email: "roni@example.com",
      loginMethods: [{ provider: "credential" }],
    });
    expect(data.account.password).toBeUndefined();
    expect(JSON.stringify(data)).not.toContain("tokenHash");
    expect(data.sessions.length).toBeGreaterThan(0);
    expect(data.sessions[0].token).toBeUndefined();
    const exported = data.events.find((e: { id: string }) => e.id === ev.id);
    expect(exported.myRole).toBe("owner");
    expect(exported.contracts[0]).toMatchObject({ vendorName: "צלם", schedule: [{ label: "מקדמה" }] });
  });

  it("deletion needs the password", async () => {
    expect((await deleteMe(roni, { confirm: true })).statusCode).toBe(403);
    expect((await deleteMe(roni, { password: "Wrong1!x", confirm: true })).json().code).toBe(
      "wrong_password",
    );
    expect((await deleteMe(roni, { password: "Secret1!" })).statusCode).toBe(422);
  });

  it("is refused while the user is the only owner of a shared event", async () => {
    const shared = await createEvent(roni, "אירוע משותף");
    await join(roni, shared.id, partner);
    const res = await deleteMe(roni, { password: "Secret1!", confirm: true });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: "sole_owner", details: { events: [{ name: "אירוע משותף" }] } });

    // After making the partner a co-owner, deletion goes through.
    const members = (await call(roni, { method: "GET", url: `/v1/events/${shared.id}/members` })).json<
      MemberDto[]
    >();
    const shaked = members.find((m) => m.email === "shaked@example.com")!;
    await call(roni, {
      method: "PATCH",
      url: `/v1/events/${shared.id}/members/${shaked.userId}`,
      payload: { role: "owner" },
    });
    await call(roni, {
      method: "POST",
      url: `/v1/events/${shared.id}/invitations`,
      payload: { email: "x@example.com" },
    });

    const roniId = (await me(roni)).id;
    expect((await deleteMe(roni, { password: "Secret1!", confirm: true })).statusCode).toBe(204);

    // Signed out everywhere; the user, their solo events and their invitation links are gone.
    expect((await call(roni, { method: "GET", url: "/v1/me" })).statusCode).toBe(401);
    expect(await ctx.db.select().from(schema.user).where(eq(schema.user.id, roniId))).toHaveLength(0);
    expect(
      await ctx.db.select().from(schema.event).where(eq(schema.event.name, "החתונה של רוני")),
    ).toHaveLength(0);
    expect(
      await ctx.db.select().from(schema.eventInvitation).where(eq(schema.eventInvitation.eventId, shared.id)),
    ).toHaveLength(0);

    // The shared event stays with the partner, who is now its owner.
    const left = (await call(partner, { method: "GET", url: "/v1/events" })).json<EventDto[]>();
    expect(left.map((e) => [e.name, e.role])).toEqual([["אירוע משותף", "owner"]]);
    const [row] = await ctx.db.select().from(schema.event).where(eq(schema.event.id, shared.id));
    expect(row!.createdBy).toBeNull();
  });
});
