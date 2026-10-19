import { afterAll, beforeAll, expect, it, vi } from "vitest";
import {
  candidate,
  finishRun,
  setupRun,
} from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { PerformanceResultService } from "./PerformanceResultService";

// RFC-0014 5.6: the field result counts from the day a person marked the
// item implemented, from stored CrUX History weeks.
const database = await vi.hoisted(async () => {
  const { createOpportunityTestDatabase } =
    await import("@/server/features/opportunities/repositories/opportunityRepositoryTestDb");
  return createOpportunityTestDatabase("performance-result-test-");
});
const mocks = vi.hoisted(() => ({ history: vi.fn() }));
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
vi.mock("@/server/lib/runtime-env", () => ({
  getOptionalEnvValue: async () => "crux-test-key",
}));
vi.mock("@/server/lib/crux", () => ({ queryCruxHistory: mocks.history }));
vi.mock("@/server/features/projects/repositories/ProjectRepository", () => ({
  ProjectRepository: {
    getProjectForOrganization: async (projectId: string, orgId: string) =>
      projectId === orgId ? { id: projectId } : null,
  },
}));
beforeAll(() => database.prepare());
afterAll(() => database.close());

const week = (end: string, lcpP75Ms: number) => ({
  collectionEnd: end,
  lcpP75Ms,
  inpP75Ms: null,
  clsP75: null,
});

it("labels the weeks before the change against the weeks from 4 weeks after", async () => {
  const input = await setupRun(database.client, "performance-result-test-");
  const item = await finishRun(input, [
    candidate({
      identityKey: "blog-lcp",
      type: "performance_issue",
      query: null,
      performance: {
        template: "/blog/:slug",
        metric: "lcp",
        formFactor: "phone",
        p75Value: 3_000,
        threshold: 2_500,
        scope: "url",
        target: "https://example.com/blog/a-b-c",
        collectionEnd: "2026-08-22",
        labValue: null,
        causeIds: "",
      },
    }),
  ]);
  const projectId = input.run.projectId;
  const context = { organizationId: projectId, userId: "owner", role: "owner" };
  const scope = { projectId, opportunityId: item.id };
  expect(await PerformanceResultService.get(context, scope)).toEqual({
    status: "not_implemented",
  });
  await database.client.execute({
    sql: "INSERT INTO opportunity_decisions (id, project_id, opportunity_id, evidence_run_id, actor_user_id, decision, from_status, to_status, note, created_at) VALUES (?, ?, ?, ?, 'owner', 'implemented', 'in_progress', 'implemented', '', '2026-08-29T10:00:00.000Z')",
    args: [crypto.randomUUID(), projectId, item.id, input.run.id],
  });
  mocks.history.mockResolvedValue([
    week("2026-08-01", 3_000),
    week("2026-08-08", 3_100),
    week("2026-08-15", 2_900),
    week("2026-08-22", 3_000),
    week("2026-09-26", 2_400),
    week("2026-10-03", 2_300),
    week("2026-10-10", 2_450),
    week("2026-10-17", 2_400),
  ]);
  expect(await PerformanceResultService.refresh(context, scope)).toMatchObject({
    status: "measured",
    changedOn: "2026-08-29",
    before: 3_000,
    after: 2_400,
    label: "improved",
  });
  expect(mocks.history).toHaveBeenCalledWith(
    "crux-test-key",
    { scope: "url", value: "https://example.com/blog/a-b-c" },
    "phone",
  );
  // The stored weeks answer without another request.
  expect(await PerformanceResultService.get(context, scope)).toMatchObject({
    label: "improved",
  });
});
