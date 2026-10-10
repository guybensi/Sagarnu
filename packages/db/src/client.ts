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
 * `postgres://…` connects to a real server (Railway).
 * `pglite:./path` (or `pglite:memory`) runs an embedded Postgres — for local dev and tests, no install needed.
 */
export function createDb(url: string): DbHandle {
  if (url.startsWith("pglite:")) {
    const target = url.slice("pglite:".length);
    const client = new PGlite(target === "memory" ? undefined : target);
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
