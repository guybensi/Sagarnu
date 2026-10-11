import { schema } from "@sagarnu/db";
import { desc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAuthAttemptLimiter } from "../src/lib/auth-limits";
import { setup } from "./helpers";

const HOUR = 60 * 60 * 1000;

describe("auth security", () => {
  let ctx: Awaited<ReturnType<typeof setup>>;

  const signIn = (email: string, password: string, ip: string, rememberMe?: boolean) =>
    ctx.app.inject({
      method: "POST",
      url: "/v1/auth/sign-in/email",
      remoteAddress: ip,
      headers: { origin: ctx.env.WEB_ORIGIN },
      payload: { email, password, ...(rememberMe === undefined ? {} : { rememberMe }) },
    });

  const latestSessionExpiry = async (email: string) => {
    const [u] = await ctx.db.select().from(schema.user).where(eq(schema.user.email, email));
    const [s] = await ctx.db
      .select()
      .from(schema.session)
      .where(eq(schema.session.userId, u!.id))
      .orderBy(desc(schema.session.createdAt))
      .limit(1);
    return s!.expiresAt.getTime() - Date.now();
  };

  beforeAll(async () => {
    ctx = await setup();
    await ctx.signUp("רוני", "roni@example.com");
    await ctx.signUp("דני", "dani@example.com");
  });
  afterAll(() => ctx.close());

  it("without 'remember me' the session lasts 24 hours, with it 30 days", async () => {
    const short = await signIn("roni@example.com", "Secret1!", "10.0.0.1", false);
    expect(short.statusCode).toBe(200);
    const shortLeft = await latestSessionExpiry("roni@example.com");
    expect(shortLeft).toBeGreaterThan(23 * HOUR);
    expect(shortLeft).toBeLessThanOrEqual(24 * HOUR);
    // The cookie itself is a browser-session cookie (no Max-Age).
    const cookie = [short.headers["set-cookie"]].flat().find((c) => String(c).includes("session_token"));
    expect(String(cookie)).not.toMatch(/Max-Age/i);

    const long = await signIn("roni@example.com", "Secret1!", "10.0.0.2", true);
    expect(long.statusCode).toBe(200);
    expect(await latestSessionExpiry("roni@example.com")).toBeGreaterThan(29 * 24 * HOUR);
  });

  it("limits sign-in to 5 a minute per email, even from different IPs", async () => {
    for (let i = 1; i <= 5; i++) {
      const res = await signIn("dani@example.com", "Wrong1!x", `10.1.0.${i}`);
      expect(res.statusCode).toBe(401);
    }
    const blocked = await signIn("dani@example.com", "Secret1!", "10.1.0.99");
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().code).toBe("TOO_MANY_REQUESTS");
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("limits sign-in to 5 a minute per IP, even across emails", async () => {
    for (let i = 1; i <= 5; i++) {
      const res = await signIn(`nobody${i}@example.com`, "Wrong1!x", "10.2.0.1");
      expect(res.statusCode).toBe(401);
    }
    expect((await signIn("roni@example.com", "Secret1!", "10.2.0.1")).statusCode).toBe(429);
    // Another IP with another email is unaffected.
    expect((await signIn("roni@example.com", "Secret1!", "10.2.0.2")).statusCode).toBe(200);
  });

  it("limits password-reset requests too", async () => {
    const request = (ip: string) =>
      ctx.app.inject({
        method: "POST",
        url: "/v1/auth/request-password-reset",
        remoteAddress: ip,
        headers: { origin: ctx.env.WEB_ORIGIN },
        payload: { email: "roni@example.com", redirectTo: `${ctx.env.WEB_ORIGIN}/reset-password` },
      });
    for (let i = 1; i <= 5; i++) expect((await request(`10.3.0.${i}`)).statusCode).toBe(200);
    expect((await request("10.3.0.9")).statusCode).toBe(429);
  });

  it("opens again after the minute passes", async () => {
    let t = 0;
    const limiter = createAuthAttemptLimiter(2, () => t);
    const reply = { status: () => reply, header: () => reply, send: (b: unknown) => b };
    const attempt = () =>
      limiter(
        {
          method: "POST",
          url: "/v1/auth/sign-in/email",
          ip: "1.1.1.1",
          body: { email: "A@example.com" },
          log: { warn: () => {} },
        } as never,
        reply as never,
      );
    expect(await attempt()).toBeUndefined();
    expect(await attempt()).toBeUndefined();
    expect(await attempt()).toMatchObject({ code: "TOO_MANY_REQUESTS" });
    t += 60_001;
    expect(await attempt()).toBeUndefined();
  });
});
