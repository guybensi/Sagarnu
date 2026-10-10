import { fileURLToPath } from "node:url";
import { createDb, seed } from "@sagarnu/db";
import type { EmailMessage, EmailProvider } from "@sagarnu/notifications";
import { buildApp } from "../src/app";
import { loadEnv } from "../src/env";

export class MemoryEmail implements EmailProvider {
  readonly sent: EmailMessage[] = [];
  async send(message: EmailMessage) {
    this.sent.push(message);
    return { id: String(this.sent.length) };
  }
}

export async function setup(envOverrides: Record<string, string> = {}) {
  const env = loadEnv({
    NODE_ENV: "test",
    BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123",
    DATABASE_URL: "pglite:memory",
    REQUIRE_EMAIL_VERIFICATION: "false",
    ...envOverrides,
  });
  const handle = createDb(env.DATABASE_URL);
  await handle.migrate(fileURLToPath(new URL("../../../packages/db/drizzle", import.meta.url)));
  await seed(handle.db);
  const email = new MemoryEmail();
  const app = await buildApp({ env, db: handle.db, email });

  /** Signs up and returns a cookie header for subsequent requests. */
  const signUp = async (name: string, mail: string, userType: "couple" | "planner" = "couple") => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/sign-up/email",
      headers: { origin: env.WEB_ORIGIN },
      payload: { name, email: mail, password: "Secret1!", userType },
    });
    if (res.statusCode !== 200) throw new Error(`sign-up failed ${res.statusCode}: ${res.body}`);
    const cookie = [res.headers["set-cookie"]]
      .flat()
      .filter(Boolean)
      .map((c) => String(c).split(";")[0])
      .join("; ");
    return { cookie, origin: env.WEB_ORIGIN };
  };

  const close = async () => {
    await app.close();
    await handle.close();
  };

  return { app, env, email, signUp, close, db: handle.db };
}
