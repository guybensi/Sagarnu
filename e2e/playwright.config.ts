import { defineConfig, devices } from "@playwright/test";
import { API_PORT, WEB, WEB_PORT } from "./urls";

const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  // One in-memory database serves every test; more workers only make each request slower.
  workers: 2,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    // CI downloads Playwright's Chromium; locally the installed Edge is enough (E2E_CHANNEL overrides).
    channel: process.env.E2E_CHANNEL ?? (CI ? undefined : "msedge"),
    baseURL: WEB,
    locale: "he-IL",
    timezoneId: "Asia/Jerusalem",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      // Fresh in-memory database on every run.
      command: "pnpm --filter @sagarnu/api exec tsx src/server.ts",
      url: `http://localhost:${API_PORT}/v1/health`,
      env: {
        NODE_ENV: "test",
        PORT: String(API_PORT),
        DATABASE_URL: "pglite:memory",
        WEB_ORIGIN: WEB,
        BETTER_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-1234",
        REQUIRE_EMAIL_VERIFICATION: "false",
        // Every test signs up and logs in from the same IP.
        RATE_LIMITS: "false",
        LOG_LEVEL: "warn",
      },
      timeout: 120_000,
    },
    {
      // A production build: no dev compile delays, and it is what users get.
      command: `node clean-next.mjs && pnpm --filter @sagarnu/web build && pnpm --filter @sagarnu/web start --port ${WEB_PORT}`,
      url: `${WEB}/login`,
      env: { API_URL: `http://localhost:${API_PORT}` },
      timeout: 300_000,
    },
  ],
});
