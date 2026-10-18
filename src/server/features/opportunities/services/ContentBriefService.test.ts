import type * as Ai from "ai";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { OpportunityRepository as repo } from "../repositories/OpportunityRepository";
import {
  candidate,
  setupRun,
} from "../repositories/opportunityRepositoryTestSupport";
import type { BriefOutput } from "./contentBriefOutput";
import { ContentBriefService as service } from "./ContentBriefService";

const PREFIX = "content-brief-test-";
const database = await vi.hoisted(async () => {
  const { createOpportunityTestDatabase } =
    await import("../repositories/opportunityRepositoryTestDb");
  return createOpportunityTestDatabase("content-brief-test-");
});
const { client } = database;
const mocks = vi.hoisted(() => ({
  generate:
    vi.fn<
      (options: {
        system: string;
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
// The test projects table is minimal; tenancy here is organization = project.
vi.mock("@/server/features/projects/repositories/ProjectRepository", () => ({
  ProjectRepository: {
    getProjectForOrganization: async (projectId: string, orgId: string) =>
      projectId === orgId ? { id: projectId } : null,
  },
}));
vi.mock(
  "@/server/features/project-context/repositories/ProjectContextRepository",
  () => ({
    ProjectContextRepository: {
      listSections: async () => [
        {
          key: "business_overview",
          content: "We sell widgets to small shops.",
        },
      ],
    },
  }),
);
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
vi.mock("@/server/lib/openrouter", () => ({ buildChatAgentModel: () => ({}) }));
beforeAll(() => database.prepare());
afterAll(() => database.close());

const good: BriefOutput = {
  title: "Widgets for small shops",
  audience: "Owners of small shops who buy widgets.",
  searchIntent: "Commercial: compare widget options.",
  primaryKeyword: "widgets",
  secondaryKeywords: ["Widget pricing"],
  outline: [
    { heading: "What a widget does", points: ["Explain the main use."] },
    { heading: "Choosing widgets", points: ["Compare sizes."] },
    { heading: "Why small shops buy from us", points: ["Use the overview."] },
  ],
  writerMustSupply: ["A current price for each widget size."],
};
function answers(...outputs: BriefOutput[]) {
  for (const output of outputs)
    mocks.generate.mockImplementationOnce(async (options) => {
      await options.onStepFinish({
        providerMetadata: { openrouter: { usage: { cost: 0.002 } } },
      });
      return { output, response: { modelId: "test-model" } };
    });
}

async function approvedPage(role = "owner") {
  const first = await setupRun(client, PREFIX);
  const { projectId } = first.run;
  const metrics = { clicks: 5, impressions: 400, ctr: 0.0125, position: 9 };
  await repo.completeRun({
    ...first,
    candidates: [
      candidate({
        evidence: [
          { period: "current", url: "", query: "widget pricing", metrics },
        ],
      }),
    ],
  });
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
  await client.execute({
    sql: "UPDATE opportunities SET status = 'approved' WHERE id = ?",
    args: [opportunity.id],
  });
  return {
    context: {
      organizationId: projectId,
      userId: "reviewer",
      userEmail: "reviewer@example.com",
      role,
    },
    request: {
      projectId,
      opportunityId: opportunity.id,
      expectedOpportunityVersion: opportunity.version,
    },
  };
}

it("writes a brief from the page's queries that lists the facts the writer must supply", async () => {
  const { context, request } = await approvedPage();
  answers(good);
  const brief = await service.create(context, request);
  expect(mocks.generate.mock.calls[0]?.[0].system).toContain(
    "writerMustSupply must list at least one fact",
  );
  expect(brief.status).toBe("generated");
  expect(brief.outlineMarkdown).toContain(
    "## Facts the writer must supply\n\n- A current price for each widget size.",
  );
  expect(brief.keywords).toEqual([
    { keyword: "widgets", role: "primary", searchVolume: null },
    { keyword: "Widget pricing", role: "secondary", searchVolume: null },
  ]);
  expect(await service.list(context, request)).toMatchObject([
    { id: brief.id, outlineMarkdown: brief.outlineMarkdown },
  ]);
});

it("retries once, then stores a brief with an invented number or keyword as rejected and hides it", async () => {
  const { context, request } = await approvedPage();
  answers(
    { ...good, title: "Save 40% on widgets" },
    { ...good, secondaryKeywords: ["cheap gadgets"] },
  );
  const brief = await service.create(context, request);
  expect(mocks.generate).toHaveBeenCalledTimes(2);
  expect(brief).toMatchObject({
    status: "rejected_by_validation",
    outlineMarkdown: "",
    keywords: [],
  });
});

it("lets only a member who manages integrations create a brief", async () => {
  const { context, request } = await approvedPage("member");
  await expect(service.create(context, request)).rejects.toThrow(
    "Your organization role does not allow this action.",
  );
  expect(mocks.generate).not.toHaveBeenCalled();
});
