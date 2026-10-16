import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

// The growth workflow spec runs against a dev server whose Google and GitHub
// calls go to the provider fake (src/server/e2e/growthProviderFake.ts).
export default defineConfig({
  outputDir: "../test-results",
  testDir: ".",
  testMatch: "growth-workflow.e2e.ts",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3102",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    cwd: repoRoot,
    command:
      "NODE_OPTIONS= AUTH_MODE=local_noauth VITE_E2E_GROWTH_FIXTURES=1 PORT=3102 pnpm exec vite dev --host 127.0.0.1 --strictPort",
    url: "http://localhost:3102",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
