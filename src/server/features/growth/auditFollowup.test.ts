import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { db } from "@/db";
import { growthJobRuns, growthNotifications } from "@/db/schema";
import { OpportunityRepository as opportunities } from "@/server/features/opportunities/repositories/OpportunityRepository";
import {
  candidate,
  setupRun,
} from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { queueAuditFollowup } from "./auditFollowup";
import { auditFollowupJob } from "./jobs/auditFollowup";

const database = await vi.hoisted(async () => {
  const { createExperimentTestDatabase } =
    await import("@/server/features/experiments/repositories/experimentTestDb");
  return createExperimentTestDatabase();
});
const env = vi.hoisted(() => ({ values: {} as Record<string, string> }));
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
vi.mock("@/server/lib/runtime-env", () => ({
  getOptionalEnvValue: async (name: string) => env.values[name],
}));
vi.mock("@/server/features/opportunities/services/OpportunityService", () => ({
  OpportunityService: {
    detect: async () => ({ message: "Using the recent analysis." }),
  },
}));
beforeAll(() => database.prepare());
afterAll(() => database.close());
afterEach(() => {
  vi.unstubAllGlobals();
  env.values = {};
});

const queued = (projectId: string) =>
  db
    .select({ windowKey: growthJobRuns.windowKey })
    .from(growthJobRuns)
    .where(eq(growthJobRuns.projectId, projectId));

async function audit(
  projectId: string,
  completedAt: string,
  issues: string[][],
) {
  const id = crypto.randomUUID();
  await database.client.execute({
    sql: "INSERT INTO audits (id, project_id, started_by_user_id, start_url, status, completed_at) VALUES (?, ?, 'starter', 'https://example.com/', 'completed', ?)",
    args: [id, projectId, completedAt],
  });
  for (const [page, type] of issues)
    await database.client.execute({
      sql: "INSERT INTO audit_issues (id, audit_id, page_url, issue_type, severity) VALUES (?, ?, ?, ?, 'critical')",
      args: [crypto.randomUUID(), id, page, type],
    });
  return id;
}

it("asks Trigger.dev for the follow-up once per audit", async () => {
  env.values = { GROWTH_JOBS_SECRET: "secret", TRIGGER_SECRET_KEY: "tr_test" };
  const fetch = vi.fn(
    async (_url: string, _init: { body: string }) =>
      new Response("{}", { status: 200 }),
  );
  vi.stubGlobal("fetch", fetch);
  const { run } = await setupRun(database.client, database.slugPrefix);
  await queueAuditFollowup(run.projectId, "audit-1");
  const [url, init] = fetch.mock.lastCall ?? [];
  expect(url).toBe(
    "https://api.trigger.dev/api/v1/tasks/audit-followup/trigger",
  );
  expect(JSON.parse(init?.body ?? "")).toMatchObject({
    payload: { kind: "audit_followup", windowKey: "audit-1" },
    options: { idempotencyKey: "audit:audit-1" },
  });
  expect(await queued(run.projectId)).toEqual([]);
});

it("queues the follow-up when Trigger.dev is down, and never fails the audit", async () => {
  env.values = { GROWTH_JOBS_SECRET: "secret", TRIGGER_SECRET_KEY: "tr_test" };
  vi.stubGlobal("fetch", async () => {
    throw new Error("network down");
  });
  const { run } = await setupRun(database.client, database.slugPrefix);
  await queueAuditFollowup(run.projectId, "audit-2");
  await queueAuditFollowup(run.projectId, "audit-2");
  expect(await queued(run.projectId)).toEqual([{ windowKey: "audit-2" }]);
  // A project that does not exist fails the insert; the hook still returns.
  await expect(
    queueAuditFollowup("missing-project", "audit-3"),
  ).resolves.toBeUndefined();
});

it("queues nothing when scheduled jobs are off", async () => {
  const { run } = await setupRun(database.client, database.slugPrefix);
  await queueAuditFollowup(run.projectId, "audit-off");
  expect(await queued(run.projectId)).toEqual([]);
});

it("announces new critical issues on pages with impressions only", async () => {
  const first = await setupRun(database.client, database.slugPrefix);
  const { projectId } = first.run;
  const metrics = { clicks: 5, impressions: 400, ctr: 0.0125, position: 9 };
  await opportunities.completeRun({
    ...first,
    candidates: [
      candidate({
        evidence: [
          {
            period: "current",
            url: "https://example.com/a",
            query: "",
            metrics,
          },
          {
            period: "current",
            url: "https://example.com/b",
            query: "",
            metrics,
          },
        ],
      }),
    ],
  });
  await audit(projectId, "2026-10-01T00:00:00.000Z", [
    ["https://example.com/a", "missing_title"],
  ]);
  const latest = await audit(projectId, "2026-10-15T00:00:00.000Z", [
    ["https://example.com/a", "missing_title"],
    ["https://example.com/b", "noindex"],
    ["https://example.com/quiet", "noindex"],
  ]);
  const result = await auditFollowupJob({
    projectId,
    windowKey: latest,
    organizationId: projectId,
    actor: { organizationId: projectId, userId: "starter", role: "owner" },
    now: new Date(),
    log: () => undefined,
  });
  expect(result.summary).toMatch(/^1 new critical issues/);
  const [notice] = await db
    .select({
      title: growthNotifications.title,
      body: growthNotifications.body,
    })
    .from(growthNotifications)
    .where(eq(growthNotifications.projectId, projectId));
  expect(notice).toEqual({
    title: "1 new critical issues on pages with search traffic",
    body: "noindex: https://example.com/b",
  });
});
