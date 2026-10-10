import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, pgliteTarget, seed } from "@sagarnu/db";
import { createEmailProvider } from "@sagarnu/notifications";
import { buildApp } from "./app";
import { loadEnv } from "./env";

const env = loadEnv();

// Same depth from src/server.ts (dev) and dist/server.js (build): apps/api/<dir>/ → repo root.
const migrationsFolder = fileURLToPath(new URL("../../../packages/db/drizzle", import.meta.url));

const pgliteDir = env.DATABASE_URL.startsWith("pglite:") ? pgliteTarget(env.DATABASE_URL) : undefined;
if (pgliteDir && /onedrive|dropbox|google ?drive|icloud/i.test(resolve(pgliteDir))) {
  console.warn(
    `\n⚠ The local database is inside a synced folder (${resolve(pgliteDir)}).\n` +
      `  Sync clients break it. Use DATABASE_URL=pglite:local in apps/api/.env.\n`,
  );
}

const handle = createDb(env.DATABASE_URL);
if (env.MIGRATE_ON_START) {
  try {
    await handle.migrate(migrationsFolder);
    await seed(handle.db);
  } catch (error) {
    if (pgliteDir) {
      console.error(
        `\nThe local database at ${resolve(pgliteDir)} could not be opened.\n` +
          `Delete that folder and start again — it only holds local test data.\n`,
      );
    }
    throw error;
  }
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
