import { defineConfig } from "vitest/config";

// Every suite boots embedded Postgres (PGlite) and runs migrations in beforeAll.
export default defineConfig({
  test: { testTimeout: 60_000, hookTimeout: 60_000 },
});
