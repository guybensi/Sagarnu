import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/env";

const secret = "s".repeat(40);

describe("env", () => {
  it("treats empty values as unset", () => {
    const env = loadEnv({
      NODE_ENV: "development",
      BETTER_AUTH_SECRET: secret,
      REQUIRE_EMAIL_VERIFICATION: "",
      RESEND_API_KEY: "",
    });
    expect(env.requireEmailVerification).toBe(false);
    expect(env.DATABASE_URL).toBe("pglite:./.data/dev");
  });

  it("turns verification on when email is configured", () => {
    const env = loadEnv({ NODE_ENV: "development", BETTER_AUTH_SECRET: secret, RESEND_API_KEY: "re_x" });
    expect(env.requireEmailVerification).toBe(true);
  });

  it("lists every missing variable at once", () => {
    let message = "";
    try {
      loadEnv({});
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/BETTER_AUTH_SECRET: missing/);
    expect(message).toMatch(/DATABASE_URL: missing/);
    expect(message).toMatch(/WEB_ORIGIN: missing/);
  });

  it("refuses to start in production without a real database and web origin", () => {
    expect(() => loadEnv({ BETTER_AUTH_SECRET: secret })).toThrow(/DATABASE_URL/);
    expect(() => loadEnv({ BETTER_AUTH_SECRET: secret, DATABASE_URL: "postgresql://x" })).toThrow(
      /WEB_ORIGIN/,
    );
  });
});
