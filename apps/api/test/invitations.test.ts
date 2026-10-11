import type {
  AcceptInvitationResultDto,
  CreateInvitationResultDto,
  EventDto,
  InvitationDto,
  InvitationInfoDto,
  MemberDto,
} from "@sagarnu/schemas";
import type { InjectOptions } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setup } from "./helpers";

type Who = { cookie: string; origin: string };

describe("invitations and members", () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  let planner: Who;
  let partner: Who;
  let parent: Who;
  let stranger: Who;
  let eventId: string;

  const call = (who: Who | null, opts: InjectOptions) =>
    ctx.app.inject({
      ...opts,
      headers: {
        ...(who ? { cookie: who.cookie, origin: who.origin } : { origin: ctx.env.WEB_ORIGIN }),
        ...opts.headers,
      },
    });
  const invite = (email: string, role?: string) =>
    call(planner, { method: "POST", url: `/v1/events/${eventId}/invitations`, payload: { email, role } });
  const tokenOf = (res: { json: () => CreateInvitationResultDto }) =>
    res.json().inviteUrl.split("/invite/")[1]!;

  beforeAll(async () => {
    ctx = await setup();
    planner = await ctx.signUp("שירן המפיקה", "planner@example.com", "planner");
    partner = await ctx.signUp("נועה", "noa@example.com");
    parent = await ctx.signUp("אבא של נועה", "dad@example.com");
    stranger = await ctx.signUp("זר", "stranger4@example.com");
    eventId = (
      await call(planner, { method: "POST", url: "/v1/events", payload: { name: "החתונה של נועה ועידו" } })
    ).json<EventDto>().id;
  });
  afterAll(() => ctx.close());

  it("planners can run several events", async () => {
    const second = await call(planner, {
      method: "POST",
      url: "/v1/events",
      payload: { name: "אירוע נוסף" },
    });
    expect(second.statusCode).toBe(201);
  });

  it("invites by email, sends a link, and shows a public preview", async () => {
    const res = await invite("Noa@Example.com");
    expect(res.statusCode).toBe(201);
    const body = res.json<CreateInvitationResultDto>();
    expect(body).toMatchObject({ emailSent: true, invitation: { email: "noa@example.com", role: "editor" } });
    expect(ctx.email.sent.at(-1)?.text).toContain(body.inviteUrl);

    const info = await call(null, { method: "GET", url: `/v1/invitations/${tokenOf(res)}` });
    expect(info.json<InvitationInfoDto>()).toMatchObject({
      status: "valid",
      eventName: "החתונה של נועה ועידו",
      inviterName: "שירן המפיקה",
      role: "editor",
    });

    const pending = await call(planner, { method: "GET", url: `/v1/events/${eventId}/invitations` });
    expect(pending.json<InvitationDto[]>().map((i) => i.email)).toEqual(["noa@example.com"]);
  });

  it("only owners can invite; strangers see nothing", async () => {
    const res = await call(stranger, {
      method: "POST",
      url: `/v1/events/${eventId}/invitations`,
      payload: { email: "x@example.com" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("accepting joins the event once; the link then stops working", async () => {
    const token = tokenOf(await invite("noa@example.com"));
    const accepted = await call(partner, { method: "POST", url: `/v1/invitations/${token}/accept` });
    expect(accepted.json<AcceptInvitationResultDto>()).toEqual({ eventId, role: "editor" });

    const events = (await call(partner, { method: "GET", url: "/v1/events" })).json<EventDto[]>();
    expect(events.map((e) => [e.id, e.role])).toEqual([[eventId, "editor"]]);

    const again = await call(stranger, { method: "POST", url: `/v1/invitations/${token}/accept` });
    expect(again.json()).toMatchObject({ code: "conflict", details: { reason: "invitation_accepted" } });
    const info = await call(null, { method: "GET", url: `/v1/invitations/${token}` });
    expect(info.json<InvitationInfoDto>().status).toBe("accepted");

    // Re-inviting an existing member is refused.
    expect((await invite("noa@example.com")).json()).toMatchObject({ details: { reason: "already_member" } });
  });

  it("viewers can look but not change anything", async () => {
    const token = tokenOf(await invite("dad@example.com", "viewer"));
    await call(parent, { method: "POST", url: `/v1/invitations/${token}/accept` });
    expect((await call(parent, { method: "GET", url: `/v1/events/${eventId}/dashboard` })).statusCode).toBe(
      200,
    );
    const edit = await call(parent, {
      method: "PATCH",
      url: `/v1/events/${eventId}`,
      payload: { guestCount: 10 },
    });
    expect(edit.statusCode).toBe(403);
  });

  it("revoked and unknown links are refused", async () => {
    const res = await invite("someone@example.com");
    const id = res.json<CreateInvitationResultDto>().invitation.id;
    await call(planner, { method: "DELETE", url: `/v1/events/${eventId}/invitations/${id}` });
    const accept = await call(stranger, { method: "POST", url: `/v1/invitations/${tokenOf(res)}/accept` });
    expect(accept.json()).toMatchObject({ details: { reason: "invitation_revoked" } });
    expect(
      (await call(null, { method: "GET", url: "/v1/invitations/not-a-real-token-abcdefgh" })).statusCode,
    ).toBe(404);
  });

  it("owners change roles and remove members; the last owner is protected", async () => {
    const members = (await call(planner, { method: "GET", url: `/v1/events/${eventId}/members` })).json<
      MemberDto[]
    >();
    const noa = members.find((m) => m.email === "noa@example.com")!;
    const me = members.find((m) => m.role === "owner")!;

    // Promote the partner to co-owner, then the planner may step down.
    expect(
      (
        await call(planner, {
          method: "PATCH",
          url: `/v1/events/${eventId}/members/${noa.userId}`,
          payload: { role: "owner" },
        })
      ).statusCode,
    ).toBe(200);

    // Editors / viewers cannot manage members.
    const dad = members.find((m) => m.email === "dad@example.com")!;
    expect(
      (await call(parent, { method: "DELETE", url: `/v1/events/${eventId}/members/${noa.userId}` }))
        .statusCode,
    ).toBe(403);
    // …but anyone may leave.
    expect(
      (await call(parent, { method: "DELETE", url: `/v1/events/${eventId}/members/${dad.userId}` }))
        .statusCode,
    ).toBe(204);

    // Demote Noa back; now the planner is the only owner and cannot leave or be demoted.
    await call(planner, {
      method: "PATCH",
      url: `/v1/events/${eventId}/members/${noa.userId}`,
      payload: { role: "editor" },
    });
    const leave = await call(planner, {
      method: "DELETE",
      url: `/v1/events/${eventId}/members/${me.userId}`,
    });
    expect(leave.json()).toMatchObject({ code: "conflict", details: { reason: "last_owner" } });
    const demote = await call(planner, {
      method: "PATCH",
      url: `/v1/events/${eventId}/members/${me.userId}`,
      payload: { role: "viewer" },
    });
    expect(demote.json()).toMatchObject({ details: { reason: "last_owner" } });
  });
});
