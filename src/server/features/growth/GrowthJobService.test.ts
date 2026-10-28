import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db";
import {
  growthJobLogs,
  growthJobRuns,
  growthNotifications,
  growthSchedules,
} from "@/db/schema";
import { AppError } from "@/server/lib/errors";
import { GrowthJobService } from "./GrowthJobService";

const database = await vi.hoisted(async () => {
  const { createExperimentTestDatabase } =
    await import("@/server/features/experiments/repositories/experimentTestDb");
  return createExperimentTestDatabase();
});
const mocks = vi.hoisted(() => ({
  job: vi.fn(),
  membership: vi.fn(),
  paid: vi.fn(),
}));
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
vi.mock("./growthJobs", () => ({
  GROWTH_JOBS: {
    measurement_refresh: mocks.job,
    traffic_watch: mocks.job,
    audit_followup: mocks.job,
  },
}));
// The project and member tables of the test database are minimal.
vi.mock("@/server/features/projects/repositories/ProjectRepository", () => ({
  ProjectRepository: {
    getProjectById: async (id: string) => ({ id, organizationId: id }),
  },
}));
vi.mock("@/server/auth/repositories/AuthRepository", () => ({
  AuthRepository: { getMembership: mocks.membership },
}));
vi.mock("@/server/billing/subscription", () => ({
  customerHasPaidPlan: mocks.paid,
}));
vi.mock("@/server/lib/runtime-env", () => ({
  isHostedServerAuthMode: async () => true,
}));
beforeAll(() => database.prepare());
afterAll(() => database.close());

const now = new Date("2026-10-17T12:00:00.000Z");
async function project(
  kind: "measurement_refresh" | "traffic_watch" = "measurement_refresh",
) {
  const projectId = crypto.randomUUID();
  await database.client.execute({
    sql: "INSERT INTO organization (id, name, slug, created_at) VALUES (?, 'test', ?, CURRENT_TIMESTAMP)",
    args: [projectId, `${database.slugPrefix}${projectId}`],
  });
  await database.client.execute({
    sql: "INSERT INTO projects (id, organization_id, name) VALUES (?, ?, 'test')",
    args: [projectId, projectId],
  });
  const schedule = {
    id: crypto.randomUUID(),
    projectId,
    kind,
    enabled: true,
    interval: "daily" as const,
    hourUtc: 6,
    nextRunAt: "2026-10-17T06:00:00.000Z",
    ownerUserId: "owner",
    updatedBy: "owner",
    updatedAt: now.toISOString(),
  };
  await db.insert(growthSchedules).values(schedule);
  const request = (attempt = 1, maxAttempts = 3) => ({
    kind,
    projectId,
    scheduleId: schedule.id,
    windowKey: "2026-10-17",
    attempt,
    maxAttempts,
  });
  const nextRunAt = async () =>
    (
      await db
        .select({ value: growthSchedules.nextRunAt })
        .from(growthSchedules)
        .where(eq(growthSchedules.id, schedule.id))
    )[0]?.value;
  const notices = () =>
    db
      .select({
        kind: growthNotifications.kind,
        body: growthNotifications.body,
      })
      .from(growthNotifications)
      .where(eq(growthNotifications.projectId, projectId));
  return { projectId, schedule, request, nextRunAt, notices };
}

beforeEach(() => {
  mocks.membership.mockResolvedValue({ role: "owner" });
  mocks.paid.mockResolvedValue(true);
  mocks.job.mockImplementation(
    async (context: { log: (l: "info", m: string) => void }) => {
      context.log("info", "Checked 1 experiment.");
      return { summary: "Refreshed 1 of 1 experiments; 0 final results." };
    },
  );
});

it("lists due work without changing any row", async () => {
  const { schedule } = await project();
  const rows = async () => [
    (await db.select({ total: count() }).from(growthJobRuns))[0]?.total,
    (await db.select({ total: count() }).from(growthSchedules))[0]?.total,
  ];
  const before = await rows();
  const { items } = await GrowthJobService.due(now);
  expect(items).toContainEqual({
    kind: "measurement_refresh",
    projectId: schedule.projectId,
    scheduleId: schedule.id,
    windowKey: "2026-10-17",
  });
  expect(await rows()).toEqual(before);
});

it("leaves an archived project's jobs out of the due list", async () => {
  const { projectId } = await project();
  await database.client.execute({
    sql: "UPDATE projects SET archived_at = ? WHERE id = ?",
    args: [now.toISOString(), projectId],
  });
  const { items } = await GrowthJobService.due(now);
  expect(items.map((item) => item.projectId)).not.toContain(projectId);
});

it("runs a window once, keeps its log and moves the schedule to the next slot", async () => {
  const { projectId, request, nextRunAt } = await project();
  expect(await GrowthJobService.run(request(), now)).toEqual({
    status: 200,
    body: {
      status: "succeeded",
      summary: "Refreshed 1 of 1 experiments; 0 final results.",
    },
  });
  expect(await nextRunAt()).toBe("2026-10-18T06:00:00.000Z");
  // The row keeps the real start, not the earlier cron tick passed as `now`.
  const [row] = await db
    .select({ startedAt: growthJobRuns.startedAt })
    .from(growthJobRuns)
    .where(eq(growthJobRuns.projectId, projectId));
  expect(Date.parse(row?.startedAt ?? "")).toBeGreaterThan(now.getTime());
  expect(await db.select().from(growthJobLogs)).toContainEqual(
    expect.objectContaining({ message: "Checked 1 experiment." }),
  );
  // A repeated dispatch of the same window does no work.
  expect(await GrowthJobService.run(request(2), now)).toMatchObject({
    status: 200,
    body: { summary: "Already done for this window." },
  });
  expect(mocks.job).toHaveBeenCalledTimes(1);
});

it("asks for a retry, then fails for good and tells the project", async () => {
  const { request, nextRunAt, notices } = await project();
  mocks.job.mockRejectedValue(
    new AppError("UPSTREAM_UNAVAILABLE", "Search Console is busy."),
  );
  expect((await GrowthJobService.run(request(1), now)).status).toBe(503);
  expect(await nextRunAt()).toBe("2026-10-17T06:00:00.000Z");
  expect(await GrowthJobService.run(request(3), now)).toEqual({
    status: 422,
    body: { status: "failed", summary: "Search Console is busy." },
  });
  expect(await nextRunAt()).toBe("2026-10-18T06:00:00.000Z");
  expect(await notices()).toEqual([
    { kind: "job_failed", body: "Search Console is busy." },
  ]);
});

it("skips the job when the schedule owner lost access, and says so", async () => {
  const { request, notices } = await project();
  mocks.membership.mockResolvedValue(null);
  expect(await GrowthJobService.run(request(), now)).toMatchObject({
    status: 200,
    body: {
      status: "skipped",
      summary: "The schedule owner no longer has access.",
    },
  });
  expect(mocks.job).not.toHaveBeenCalled();
  expect((await notices())[0]?.kind).toBe("job_failed");
});

it("runs an audit follow-up as the member who started the audit", async () => {
  const { projectId, request } = await project();
  const auditId = crypto.randomUUID();
  await database.client.execute({
    sql: "INSERT INTO audits (id, project_id, started_by_user_id, start_url, status) VALUES (?, ?, 'starter', 'https://example.com/', 'completed')",
    args: [auditId, projectId],
  });
  mocks.membership.mockResolvedValue({ role: "member" });
  const followup = {
    ...request(),
    kind: "audit_followup" as const,
    scheduleId: null,
    windowKey: auditId,
  };
  expect(await GrowthJobService.run(followup, now)).toMatchObject({
    body: { status: "succeeded" },
  });
  expect(mocks.membership).toHaveBeenCalledWith("starter", projectId);
});

it("skips traffic watch on a free plan", async () => {
  const { request } = await project("traffic_watch");
  mocks.paid.mockResolvedValue(false);
  expect(await GrowthJobService.run(request(), now)).toMatchObject({
    body: {
      status: "skipped",
      summary: "Your plan does not include this job.",
    },
  });
  expect(mocks.job).not.toHaveBeenCalled();
});
