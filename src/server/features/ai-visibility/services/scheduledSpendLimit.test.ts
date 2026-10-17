import { expect, it, vi } from "vitest";
import { AppError } from "@/server/lib/errors";
import { AiVisibilityRepository as repo } from "../repositories/AiVisibilityRepository";
import { configuration } from "./aiVisibilityTestFixtures";
import { runScheduledAiVisibility } from "./scheduledAiVisibility";

// RFC-0009 5.3: a scheduled check at a monthly limit skips with its reason.
const { testDb } = await vi.hoisted(async () => {
  const { createAiVisibilityTestDb } = await import("../aiVisibilityTestDb");
  return { testDb: await createAiVisibilityTestDb() };
});
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("@/db", () => ({ db: testDb.db }));
vi.mock("@/db/runBatch", () => ({ runBatch: testDb.runBatch }));
vi.mock("@/server/lib/runtime-env", () => ({
  isHostedServerAuthMode: async () => false,
}));
vi.mock("./aiVisibilityRetention", () => ({ pruneAiVisibility: vi.fn() }));
vi.mock("@/server/billing/spendAdmission", () => ({
  assertSpendRoom: async () => {
    throw new AppError("SPEND_LIMIT_REACHED");
  },
}));

it("skips a due tracker at the monthly limit and says why", async () => {
  await testDb.seedProject();
  const rows = configuration(
    { engines: ["chatgpt"], prompts: [{ text: "Which SEO tools?" }] },
    "project",
  );
  await repo.saveConfiguration(rows);
  await repo.updateTracker(rows.tracker.id, {
    enabled: true,
    nextCheckAt: "2026-09-01T06:00:00.000Z",
  });
  await runScheduledAiVisibility();
  expect((await repo.getTracker("project"))?.lastSkipReason).toBe(
    "Project monthly limit reached",
  );
  expect(await repo.listRuns("project")).toEqual([]);
});
