import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface DbHandle {
  db: Db;
  migrate(migrationsFolder: string): Promise<void>;
  close(): Promise<void>;
}

/**
 * Where `pglite:local` keeps its files: the per-user app-data folder, never inside the project.
 * Projects often live under OneDrive/Dropbox, and a sync client rewriting Postgres files while it
 * runs leaves the database unopenable ("PGlite failed to initialize properly").
 */
export function localPgliteDir(): string {
  const base =
    process.env.LOCALAPPDATA ??
    (process.platform === "darwin"
      ? join(homedir(), "Library", "Application Support")
      : (process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share")));
  return join(base, "sagarnu", "pglite-dev");
}

/** `pglite:local` → app-data folder, `pglite:memory` → in memory, `pglite:<path>` → that folder. */
export function pgliteTarget(url: string): string | undefined {
  const target = url.slice("pglite:".length);
  if (target === "memory") return undefined;
  return target === "local" ? localPgliteDir() : target;
}

/**
 * `postgres://…` connects to a real server (Railway).
 * `pglite:local` (or `pglite:memory`) runs an embedded Postgres — for local dev and tests, no install needed.
 */
export function createDb(url: string): DbHandle {
  if (url.startsWith("pglite:")) {
    const dir = pgliteTarget(url);
    if (dir) mkdirSync(dir, { recursive: true });
    const client = new PGlite(dir);
    const db = drizzlePglite({ client, schema, casing: "snake_case" });
    return {
      db: db as unknown as Db,
      migrate: (migrationsFolder) => migratePglite(db, { migrationsFolder }),
      close: () => client.close(),
    };
  }

  const client = postgres(url, { max: 10, onnotice: () => {} });
  const db = drizzlePostgres({ client, schema, casing: "snake_case" });
  return {
    db,
    migrate: (migrationsFolder) => migratePostgres(db, { migrationsFolder }),
    close: () => client.end(),
  };
}
