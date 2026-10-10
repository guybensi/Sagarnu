import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, seed } from "@sagarnu/db";
import { createEmailProvider } from "@sagarnu/notifications";
import { buildApp } from "./app";
import { loadEnv } from "./env";

const env = loadEnv();

// Same depth from src/server.ts (dev) and dist/server.js (build): apps/api/<dir>/ → repo root.
const migrationsFolder = fileURLToPath(new URL("../../../packages/db/drizzle", import.meta.url));

if (env.DATABASE_URL.startsWith("pglite:") && env.DATABASE_URL !== "pglite:memory") {
  mkdirSync(dirname(resolve(env.DATABASE_URL.slice("pglite:".length))), { recursive: true });
}

const handle = createDb(env.DATABASE_URL);
if (env.MIGRATE_ON_START) {
  await handle.migrate(migrationsFolder);
  await seed(handle.db);
}

const app = await buildApp(
  {
    env,
    db: handle.db,
    email: createEmailProvider({ resendApiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM }),
  },
  {
    logger:
      env.NODE_ENV === "development"
        ? { level: env.LOG_LEVEL, transport: { target: "pino-pretty", options: { singleLine: true } } }
        : { level: env.LOG_LEVEL, redact: ["req.headers.cookie", "req.headers.authorization"] },
  },
);

const shutdown = async () => {
  await app.close();
  await handle.close();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await app.listen({ port: env.PORT, host: "0.0.0.0" });
if (!env.RESEND_API_KEY) app.log.warn("RESEND_API_KEY is not set — emails are printed to this log instead");
