import { afterAll, beforeAll, expect, it, vi } from "vitest";
import {
  candidate,
  finishRun,
  setupRun,
} from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { PerformanceLabService } from "./PerformanceLabService";

// RFC-0014 5.6: the medians of three runs, compared across the change.
const database = await vi.hoisted(async () => {
  const { createOpportunityTestDatabase } =
    await import("@/server/features/opportunities/repositories/opportunityRepositoryTestDb");
  return createOpportunityTestDatabase("performance-lab-test-");
});
const mocks = vi.hoisted(() => ({ runLabChecks: vi.fn() }));
vi.mock("cloudflare:workers", () => ({
  env: {
    DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1",
    AUDIT_ENGINE: { runLabChecks: mocks.runLabChecks },
  },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
vi.mock("@/server/lib/runtime-env", () => ({
  isHostedServerAuthMode: async () => false,
}));
vi.mock("@/server/features/projects/repositories/ProjectRepository", () => ({
  ProjectRepository: {
    getProjectForOrganization: async (projectId: string, orgId: string) =>
      projectId === orgId ? { id: projectId } : null,
  },
}));
beforeAll(() => database.prepare());
afterAll(() => database.close());

const lab = (lcpMs: number) => ({ lcpMs, cls: 0.02, tbtMs: 250, score: 60 });

it("stores the medians and compares the checks before and after the change", async () => {
  const input = await setupRun(database.client, "performance-lab-test-");
  const item = await finishRun(input, [
    candidate({
      identityKey: "blog-lcp",
      type: "performance_issue",
      query: null,
      performance: {
        template: "/blog",
        metric: "lcp",
        formFactor: "phone",
        p75Value: 3_000,
        threshold: 2_500,
        scope: "url",
        target: "https://example.com/blog",
        collectionEnd: "2026-10-17",
        labValue: null,
        causeIds: "",
      },
    }),
  ]);
  const projectId = input.run.projectId;
  const context = {
    organizationId: projectId,
    userId: "owner",
    userEmail: "owner@example.com",
    role: "owner",
  };
  const scope = { projectId, opportunityId: item.id };
  mocks.runLabChecks.mockResolvedValue({
    runs: [lab(3_600), lab(3_400), lab(3_500)],
    refused: null,
  });
  expect(await PerformanceLabService.run(context, scope)).toMatchObject({
    ok: true,
  });
  await database.client.execute({
    sql: "INSERT INTO opportunity_decisions (id, project_id, opportunity_id, evidence_run_id, actor_user_id, decision, from_status, to_status, note, created_at) VALUES (?, ?, ?, ?, 'owner', 'implemented', 'in_progress', 'implemented', '', ?)",
    args: [
      crypto.randomUUID(),
      projectId,
      item.id,
      input.run.id,
      new Date().toISOString(),
    ],
  });
  mocks.runLabChecks.mockResolvedValue({
    runs: [lab(2_900), lab(3_100), lab(3_000)],
    refused: null,
  });
  await PerformanceLabService.run(context, scope);
  const state = await PerformanceLabService.state(context, scope);
  expect(state.estimateUsd).toBeCloseTo(0.015);
  expect(state.comparison).toMatchObject({
    before: { lcpMs: 3_500, runs: 3 },
    after: { lcpMs: 3_000, runs: 3 },
  });
  expect(mocks.runLabChecks).toHaveBeenCalledWith(
    expect.objectContaining({ url: "https://example.com/blog" }),
  );
});
