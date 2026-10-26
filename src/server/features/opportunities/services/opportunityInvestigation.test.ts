import type * as Ai from "ai";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { OpportunityRepository as repo } from "../repositories/OpportunityRepository";
import {
  candidate,
  setupRun,
} from "../repositories/opportunityRepositoryTestSupport";
import { OpportunityInvestigationService as service } from "./opportunityInvestigation";

const PREFIX = "opportunity-investigation-test-";
const database = await vi.hoisted(async () => {
  const { createOpportunityTestDatabase } =
    await import("../repositories/opportunityRepositoryTestDb");
  return createOpportunityTestDatabase("opportunity-investigation-test-");
});
const { client } = database;
const mocks = vi.hoisted(() => ({
  performance: vi.fn(),
  inspect: vi.fn(),
  generate:
    vi.fn<
      (options: {
        prompt: string;
        onStepFinish: (step: unknown) => Promise<void>;
      }) => Promise<unknown>
    >(),
}));
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
vi.mock("@/server/features/gsc/services/GscService", () => ({
  GscService: { getPerformance: mocks.performance, inspectUrls: mocks.inspect },
}));
// The test projects table is minimal; tenancy here is organization = project.
vi.mock("@/server/features/projects/repositories/ProjectRepository", () => ({
  ProjectRepository: {
    getProjectForOrganization: async (projectId: string, orgId: string) =>
      projectId === orgId ? { id: projectId } : null,
  },
}));
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof Ai>()),
  generateText: mocks.generate,
}));
vi.mock("@/server/billing/researchHold", () => ({
  holdResearch: async () => null,
  settleResearch: vi.fn(),
}));
vi.mock("@/server/billing/subscription", () => ({
  checkUsageCreditsDepleted: async () => ({ depleted: false }),
}));
vi.mock("@/server/lib/runtime-env", () => ({
  isHostedServerAuthMode: async () => true,
  getRequiredEnvValue: async () => "test-key",
  getOptionalEnvValue: async () => undefined,
}));
vi.mock("@/server/lib/openrouter", () => ({
  buildChatAgentModel: () => ({}),
  requireOpenRouterAccess: async () => ({ apiKey: "test-key" }),
}));
beforeAll(() => database.prepare());
afterAll(() => database.close());

const URL = "https://example.com/pricing";
const rows = (pricing: number) => [
  { keys: ["pricing"], clicks: pricing },
  { keys: ["about"], clicks: 5 },
];
beforeEach(() => {
  mocks.performance.mockImplementation(async ({ startDate }) => ({
    rows: startDate === "2026-09-13" ? rows(40) : rows(100),
  }));
  mocks.inspect.mockResolvedValue({
    results: [
      {
        url: URL,
        result: {
          indexStatusResult: { verdict: "PASS", coverageState: "Indexed" },
        },
      },
    ],
  });
});

/** A project with one declining page, an audit issue and a tracked keyword. */
async function decliningPage() {
  const first = await setupRun(client, PREFIX);
  const { projectId } = first.run;
  await repo.completeRun({
    ...first,
    candidates: [
      candidate({ identityKey: "decline", type: "declining_page", url: URL }),
    ],
  });
  const audit = crypto.randomUUID();
  await client.execute({
    sql: "INSERT INTO audits (id, project_id, started_by_user_id, start_url, status, completed_at) VALUES (?, ?, 'test', ?, 'completed', '2026-10-05T00:00:00.000Z')",
    args: [audit, projectId, URL],
  });
  await client.execute({
    sql: "INSERT INTO audit_issues (id, audit_id, page_url, issue_type, severity) VALUES (?, ?, ?, 'missing_description', 'warning')",
    args: [crypto.randomUUID(), audit, `${URL}/`],
  });
  // The Postgres rank tables need full rows; SQLite covers the rank finding.
  if (database.isPostgres) return { projectId, ...(await access(projectId)) };
  const config = crypto.randomUUID();
  const rankRun = crypto.randomUUID();
  await client.execute({
    sql: "INSERT INTO rank_tracking_configs (id, project_id, domain, serp_depth) VALUES (?, ?, 'example.com', 100)",
    args: [config, projectId],
  });
  await client.execute({
    sql: "INSERT INTO rank_check_runs (id, config_id, project_id, status) VALUES (?, ?, ?, 'completed')",
    args: [rankRun, config, projectId],
  });
  for (const [position, checkedAt] of [
    [4, "2026-08-20T00:00:00.000Z"],
    [11, "2026-10-08T00:00:00.000Z"],
  ] as const)
    await client.execute({
      sql: "INSERT INTO rank_snapshots (run_id, tracking_keyword_id, keyword, device, position, checked_at) VALUES (?, 'kw', 'Pricing', 'desktop', ?, ?)",
      args: [rankRun, position, checkedAt],
    });
  return { projectId, ...(await access(projectId)) };
}

async function access(projectId: string, role = "owner") {
  const [opportunity] = (
    await repo.list({
      projectId,
      minPriority: 0,
      sort: "priority",
      includeDeferred: true,
      limit: 1,
      offset: 0,
      freshness: "all",
    })
  ).rows;
  return {
    context: {
      organizationId: projectId,
      userId: "reviewer",
      userEmail: "reviewer@example.com",
      role,
    },
    opportunityId: opportunity.id,
  };
}

it("investigates a declining page with the query mix, index state, audit and rank history", async () => {
  const { projectId, context, opportunityId } = await decliningPage();
  const investigation = await service.investigate(context, {
    projectId,
    opportunityId,
  });
  const summaries = investigation.findings.map((item) => item.summary);
  expect(summaries).toEqual(
    expect.arrayContaining([
      '"pricing" lost 60 clicks (100 → 40).',
      "Google reports the page as indexed (Indexed).",
      "The site audit of 2026-10-05 found missing description.",
    ]),
  );
  if (!database.isPostgres)
    expect(summaries).toContain(
      'Tracked keyword "pricing" (desktop) moved from position 4 to position 11.',
    );
  expect(
    await service.listInvestigations(context, { projectId, opportunityId }),
  ).toMatchObject([{ id: investigation.id }]);
});

it("keeps the other checks when URL Inspection fails", async () => {
  const { projectId, context, opportunityId } = await decliningPage();
  mocks.inspect.mockRejectedValue(new Error("quota"));
  const { findings } = await service.investigate(context, {
    projectId,
    opportunityId,
  });
  expect(findings.map((item) => item.summary)).toEqual(
    expect.arrayContaining([
      "URL Inspection was unavailable.",
      '"pricing" lost 60 clicks (100 → 40).',
    ]),
  );
});

it("lets only a member who manages integrations investigate", async () => {
  const { projectId, opportunityId } = await decliningPage();
  const { context: member } = await access(projectId, "member");
  await expect(
    service.investigate(member, { projectId, opportunityId }),
  ).rejects.toThrow("Your organization role does not allow this action.");
});

it("summarizes from the stored findings only, and rejects a number they do not state", async () => {
  const { projectId, context, opportunityId } = await decliningPage();
  const { id: investigationId } = await service.investigate(context, {
    projectId,
    opportunityId,
  });
  const answer = (summary: string) =>
    mocks.generate.mockImplementationOnce(async (options) => {
      await options.onStepFinish({
        providerMetadata: { openrouter: { usage: { cost: 0.001 } } },
      });
      return { output: { summary }, response: { modelId: "test-model" } };
    });
  answer("The page lost about 37% of its traffic.");
  answer("Traffic fell 37% after a core update.");
  await expect(
    service.summarizeInvestigation(context, { projectId, investigationId }),
  ).rejects.toThrow("Relay could not write a safe summary.");
  const prompt = mocks.generate.mock.calls[0]?.[0].prompt ?? "";
  expect(prompt).toMatch(/^<findings>\n- \[high\] "pricing" lost 60 clicks/);
  expect(prompt).not.toContain("example.com");

  answer('"pricing" lost 60 clicks (100 → 40); check the missing description.');
  const summarized = await service.summarizeInvestigation(context, {
    projectId,
    investigationId,
  });
  expect(summarized).toMatchObject({
    summary:
      '"pricing" lost 60 clicks (100 → 40); check the missing description.',
    summaryModel: "test-model",
    summaryCostUsd: 0.001,
  });
});
