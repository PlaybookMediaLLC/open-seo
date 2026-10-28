import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { db } from "@/db";
import { growthJobRuns } from "@/db/schema";
import { setupRun } from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import {
  AutomationService,
  ensureDefaultSchedules,
  SEARCH_CONSOLE_JOBS,
} from "./AutomationService";

const database = await vi.hoisted(async () => {
  const { createExperimentTestDatabase } =
    await import("@/server/features/experiments/repositories/experimentTestDb");
  return createExperimentTestDatabase();
});
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
vi.mock("@/server/lib/runtime-env", () => ({
  getOptionalEnvValue: async () => "trigger",
}));
// Tenancy has its own test; these tests start after the project check.
vi.mock("@/server/features/opportunities/services/opportunityAccess", () => ({
  authorize: async () => undefined,
}));
beforeAll(() => database.prepare());
afterAll(() => database.close());

const viewer = (role: string) => ({
  organizationId: "org",
  userId: "admin",
  userEmail: "admin@example.com",
  role,
});
const enabledKinds = async (projectId: string) =>
  (await AutomationService.get(viewer("owner"), projectId)).schedules
    .filter((schedule) => schedule.enabled)
    .map((schedule) => schedule.kind);

it("turns the default jobs on once, and leaves a turned-off job off", async () => {
  const { run } = await setupRun(database.client, database.slugPrefix);
  await AutomationService.save(viewer("admin"), {
    projectId: run.projectId,
    kind: "traffic_watch",
    enabled: false,
    interval: "daily",
    hourUtc: 5,
  });
  await ensureDefaultSchedules(run.projectId, "owner", SEARCH_CONSOLE_JOBS);
  await ensureDefaultSchedules(run.projectId, "owner", SEARCH_CONSOLE_JOBS);
  expect(await enabledKinds(run.projectId)).toEqual([
    "opportunity_refresh",
    "recommendation_recheck",
  ]);
});

it("shows when each job last started", async () => {
  const { run } = await setupRun(database.client, database.slugPrefix);
  const started = (windowKey: string, startedAt: string) => ({
    id: crypto.randomUUID(),
    projectId: run.projectId,
    kind: "traffic_watch" as const,
    windowKey,
    attempt: 1,
    status: "succeeded" as const,
    startedAt,
    createdAt: startedAt,
  });
  await db
    .insert(growthJobRuns)
    .values([
      started("2026-10-17", "2026-10-17T07:08:00.000Z"),
      started("2026-10-18", "2026-10-18T07:00:04.000Z"),
    ]);
  const { schedules } = await AutomationService.get(
    viewer("owner"),
    run.projectId,
  );
  const lastRunAt = (kind: string) =>
    schedules.find((schedule) => schedule.kind === kind)?.lastRunAt;
  expect(lastRunAt("traffic_watch")).toBe("2026-10-18T07:00:04.000Z");
  expect(lastRunAt("deployment_check")).toBeNull();
});

it("lets only members who manage integrations change a schedule", async () => {
  const { run } = await setupRun(database.client, database.slugPrefix);
  await expect(
    AutomationService.save(viewer("member"), {
      projectId: run.projectId,
      kind: "traffic_watch",
      enabled: true,
      interval: "daily",
      hourUtc: 7,
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(await enabledKinds(run.projectId)).toEqual([]);
});
