import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

// Core app flows that need no provider keys: pages load cleanly at desktop and
// phone width, and the save flows keep input and say what went wrong.
export default defineConfig({
  outputDir: "../test-results",
  testDir: ".",
  testMatch: "core-flows.e2e.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3103",
    actionTimeout: 10_000,
    navigationTimeout: 45_000,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    cwd: repoRoot,
    command:
      "NODE_OPTIONS= AUTH_MODE=local_noauth PORT=3103 pnpm exec vite dev --host 127.0.0.1 --strictPort",
    url: "http://localhost:3103",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
