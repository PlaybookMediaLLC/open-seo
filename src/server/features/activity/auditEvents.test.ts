import { and, count, eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { db } from "@/db";
import { auditEvents, opportunities } from "@/db/schema";
import { AutomationService } from "@/server/features/growth/AutomationService";
import { OpportunityRepository } from "@/server/features/opportunities/repositories/OpportunityRepository";
import {
  candidate,
  reviewAudit,
  setupRun,
} from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { SpendLimitService } from "@/server/features/spend/SpendLimitService";
import { ActivityService, deleteAuditEventsBefore } from "./ActivityService";
import { recordAudit } from "./auditLog";

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
  getOptionalEnvValue: async () => undefined,
}));
// The minimal test database has no user table.
vi.mock("@/server/auth/repositories/AuthRepository", () => ({
  AuthRepository: { getHostedUserNames: async () => [] },
}));
// Tenancy has its own suite; these tests start after the project check.
vi.mock("@/server/features/opportunities/services/opportunityAccess", () => ({
  authorize: async () => undefined,
}));
beforeAll(() => database.prepare());
afterAll(() => database.close());

const eventsOf = (organizationId: string) =>
  db
    .select({
      action: auditEvents.action,
      actorType: auditEvents.actorType,
    })
    .from(auditEvents)
    .where(eq(auditEvents.organizationId, organizationId));

it("writes a decision event only when the decision lands", async () => {
  const first = await setupRun(database.client, database.slugPrefix);
  await OpportunityRepository.completeRun({
    ...first,
    candidates: [candidate()],
  });
  const [opportunity] = await db
    .select({ id: opportunities.id })
    .from(opportunities)
    .where(eq(opportunities.projectId, first.run.projectId));
  const audit = { ...reviewAudit, organizationId: first.run.projectId };
  const decide = () =>
    OpportunityRepository.review({
      projectId: first.run.projectId,
      opportunityId: opportunity?.id ?? "",
      expectedVersion: 1,
      actorUserId: "reviewer",
      decision: "reviewed",
      note: "",
      fromStatus: "discovered",
      toStatus: "reviewed",
      deferredUntil: null,
      audit,
    });
  expect(await decide()).toBe(true);
  // The second review lost the version check, so it writes no event.
  expect(await decide()).toBe(false);
  expect(await eventsOf(first.run.projectId)).toEqual([
    { action: "opportunity.reviewed", actorType: "user" },
  ]);
});

it("records schedule and limit changes with who made them", async () => {
  const { run } = await setupRun(database.client, database.slugPrefix);
  const owner = {
    organizationId: run.projectId,
    userId: "owner",
    role: "owner",
  };
  // An MCP tool passes its full context, client id included.
  const agent = { ...owner, clientId: "claude-code" };
  await AutomationService.save(agent, {
    projectId: run.projectId,
    kind: "traffic_watch",
    enabled: true,
    interval: "daily",
    hourUtc: 7,
  });
  await SpendLimitService.save(owner, {
    projectId: run.projectId,
    monthlyLimitCredits: 500,
  });
  expect(await eventsOf(run.projectId)).toEqual(
    expect.arrayContaining([
      { action: "schedule.changed", actorType: "mcp" },
      { action: "spend_limit.changed", actorType: "user" },
    ]),
  );
});

it("shows owners and admins the filtered activity, with safe CSV cells", async () => {
  const { run } = await setupRun(database.client, database.slugPrefix);
  const as = (role: string) => ({
    organizationId: run.projectId,
    userId: role,
    role,
  });
  for (const summary of ["=HYPERLINK(1)", "Approved a change"])
    await recordAudit({
      organizationId: run.projectId,
      projectId: run.projectId,
      actor: { userId: "admin" },
      action: "proposal.approved_and_executed",
      targetType: "proposal",
      targetId: "p-1",
      summary,
    });
  await expect(ActivityService.list(as("member"), {})).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(
    await ActivityService.list(as("admin"), { action: "ticket.created" }),
  ).toEqual([]);
  const csv = await ActivityService.exportCsv(as("owner"), {});
  expect(csv).toContain(`"'=HYPERLINK(1)"`);
  expect(csv).not.toContain(`,"=HYPERLINK`);
});

it("deletes events older than one year", async () => {
  const { run } = await setupRun(database.client, database.slugPrefix);
  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    organizationId: run.projectId,
    projectId: null,
    actorType: "user",
    actorId: "owner",
    action: "member.invited",
    targetType: "member",
    targetId: "m-1",
    summary: "Invited a member",
    createdAt: "2025-01-01T00:00:00.000Z",
  });
  await deleteAuditEventsBefore("2025-10-17T00:00:00.000Z");
  const [left] = await db
    .select({ total: count() })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.organizationId, run.projectId),
        eq(auditEvents.action, "member.invited"),
      ),
    );
  expect(Number(left?.total)).toBe(0);
});
