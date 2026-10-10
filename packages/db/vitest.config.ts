import { defineConfig } from "vitest/config";

// Booting embedded Postgres (PGlite) takes a few seconds, more on a loaded machine or CI runner.
export default defineConfig({
  test: { testTimeout: 60_000, hookTimeout: 60_000 },
});
