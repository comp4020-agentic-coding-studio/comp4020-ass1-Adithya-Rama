import { defineConfig, devices } from "@playwright/test";

// Browser-level checks for the interactive contract that spec/*.test.ts
// (jsdom, static HTML only) can't exercise: real pointer holds, timers, and
// the CSS-driven scene visibility they drive. Runs against a built-and-
// previewed copy of the site, at the same base path GitHub Pages serves
// (see astro.config.mjs).
const PORT = 4321;
const BASE_PATH = "/comp4020-ass1-Adithya-Rama";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  timeout: 45_000,
  use: {
    baseURL: `http://localhost:${PORT}${BASE_PATH}/`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm build && pnpm preview",
    url: `http://localhost:${PORT}${BASE_PATH}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    { name: "Desktop Chrome", use: { ...devices["Desktop Chrome"] } },
    { name: "Mobile Chrome", use: { ...devices["Pixel 5"] } },
  ],
});
