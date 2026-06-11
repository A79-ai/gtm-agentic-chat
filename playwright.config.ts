import { defineConfig, devices } from "@playwright/test";

// Target under test. Defaults to the local single-org bench (next dev on :3100,
// booted from .env.e2e). Point E2E_BASE_URL at the deployed multi-tenant app
// (e.g. https://gtm-chat-template.vercel.app) to run the login spec instead.
const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3100";
const IS_LOCAL = /localhost|127\.0\.0\.1/.test(BASE_URL);

export default defineConfig({
  testDir: "./e2e",
  // One worker: the bench is a single `next dev` server; parallel specs thrash
  // its on-demand route compilation and the durable chat runtime.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Boot the bench only for local runs. Against a remote URL we test what's
  // deployed, so no server is started.
  webServer: IS_LOCAL
    ? {
        command: "pnpm bench",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
