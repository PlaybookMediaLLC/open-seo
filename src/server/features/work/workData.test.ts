import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { db } from "@/db";
import {
  growthSchedules,
  splitTests,
  workCycleEntries,
  workCycles,
} from "@/db/schema";
import {
  finishRun,
  setupRun,
} from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { WorkService } from "./WorkService";
import { WORK_DEFAULTS, weekOf, writeCycle } from "./workData";

// RFC-0018 5.2 and 5.8: one cycle per project and week, the last week
// closed, and exactly one record link per entry.
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
vi.mock(
  "@/server/features/publishing/repositories/PublishingRepository",
  () => ({ PublishingRepository: { getConnection: async () => ({}) } }),
);

// Tenant and owner authorization have separate service boundary coverage.
vi.mock("@/server/features/publishing/publishingAccess", () => ({
  authorizePublishing: vi.fn(),
}));

const settings = { ...WORK_DEFAULTS, timeZone: "UTC" };
beforeAll(() => database.prepare());
afterAll(() => database.close());

async function project() {
  const input = await setupRun(database.client, "work-cycle-test-");
  await finishRun(input);
  return input.run.projectId;
}

it("writes one cycle per week, and closes the earlier week", async () => {
  const projectId = await project();
  const now = new Date();
  const week = weekOf(now, settings);
  const first = await writeCycle(projectId, week, now, settings);
  expect(
    first?.entries.filter((entry) => entry.section === "next"),
  ).toHaveLength(1);
  expect(await writeCycle(projectId, week, now, settings)).toBeNull();
  const later = new Date(now.getTime() + 7 * 86_400_000);
  await writeCycle(projectId, weekOf(later, settings), later, settings);
  const cycles = await db
    .select({ weekStart: workCycles.weekStart, status: workCycles.status })
    .from(workCycles)
    .where(eq(workCycles.projectId, projectId));
  expect(cycles).toHaveLength(2);
  expect(cycles.map((cycle) => cycle.status)).toEqual(
    expect.arrayContaining(["closed", "open"]),
  );
});

it("refuses an entry with two record links", async () => {
  const projectId = await project();
  const [opportunity] = await database.client
    .execute({
      sql: "SELECT id FROM opportunities WHERE project_id = ?",
      args: [projectId],
    })
    .then((result) => result.rows);
  const splitTestId = crypto.randomUUID();
  await db.insert(splitTests).values({
    id: splitTestId,
    projectId,
    name: "Titles",
    hypothesis: "Shorter titles",
    field: "title",
    pagePattern: "/docs/*",
    origin: "https://example.com",
    status: "draft",
    createdBy: "owner",
    createdAt: new Date().toISOString(),
  });
  const cycleId = crypto.randomUUID();
  await db.insert(workCycles).values({
    id: cycleId,
    projectId,
    weekStart: "2026-01-05",
    status: "open",
    generatedAt: new Date().toISOString(),
    completedCount: 0,
    measuringCount: 0,
    nextCount: 1,
    waitingCount: 0,
  });
  const error = await db
    .insert(workCycleEntries)
    .values({
      id: crypto.randomUUID(),
      projectId,
      cycleId,
      section: "next",
      rank: 0,
      opportunityId: String(opportunity?.id),
      splitTestId,
      title: "Two links",
      reason: "",
      approvalNeeded: "review",
    })
    .then(
      () => null,
      (failure: unknown) => failure,
    );
  expect(error instanceof Error ? String(error.cause) : "").toMatch(
    /work_cycle_entries_one_link|CHECK constraint failed/i,
  );
});

it("changes weekly activation only when explicitly requested", async () => {
  const projectId = await project();
  const context = {
    organizationId: projectId,
    userId: "owner",
    role: "owner" as const,
  };
  const input = { projectId, ...settings };
  const enabled = async () =>
    (
      await db
        .select({ enabled: growthSchedules.enabled })
        .from(growthSchedules)
        .where(eq(growthSchedules.projectId, projectId))
    )[0]?.enabled;
  await WorkService.saveSettings(context, input);
  expect(await enabled()).toBe(false);
  await WorkService.saveSettings(context, { ...input, enabled: true });
  expect(await enabled()).toBe(true);
  await WorkService.saveSettings(context, { ...input, cycleHour: 9 });
  expect(await enabled()).toBe(true);
  await WorkService.saveSettings(context, { ...input, enabled: false });
  expect(await enabled()).toBe(false);
});
