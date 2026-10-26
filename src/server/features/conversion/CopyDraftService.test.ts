import type * as Ai from "ai";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { DraftOutput } from "@/server/features/publishing/draftChecks";
import { fixture } from "@/server/features/publishing/repositories/publishingTestFixtures";
import { CopyDraftService } from "./CopyDraftService";

// RFC-0012 5.5: a page copy draft runs through the dark-pattern checks, and
// a failing answer is retried with the reasons.
const database = await vi.hoisted(async () => {
  const { createPublishingTestDatabase } =
    await import("@/server/features/publishing/repositories/publishingTestDb");
  return createPublishingTestDatabase();
});
const mocks = vi.hoisted(() => ({
  generate:
    vi.fn<
      (options: {
        prompt: string;
        onStepFinish: (step: unknown) => Promise<void>;
      }) => Promise<unknown>
    >(),
  project: vi.fn(),
}));
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof Ai>()),
  generateText: mocks.generate,
}));
vi.mock("@/server/billing/researchHold", () => ({
  holdResearch: async () => null,
  settleResearch: async () => undefined,
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
vi.mock("@/server/lib/scrape", () => ({
  readPages: async () => ({
    pages: [
      {
        title: "Acquisitions",
        text: "We acquire subscription software businesses. Share your product to start a conversation.",
      },
    ],
  }),
}));
vi.mock("@/server/features/gsc/services/GscService", () => ({
  GscService: {
    getPerformance: async () => ({
      rows: [{ keys: ["sell saas business"], impressions: 100 }],
    }),
  },
}));
vi.mock(
  "@/server/features/project-context/repositories/ProjectContextRepository",
  () => ({ ProjectContextRepository: { listSections: async () => [] } }),
);
vi.mock("@/server/features/projects/repositories/ProjectRepository", () => ({
  ProjectRepository: { getProjectForOrganization: mocks.project },
}));
beforeAll(() => database.prepare());
afterAll(() => database.close());
beforeEach(() => {
  mocks.project.mockImplementation(
    async (projectId: string, organizationId: string) =>
      projectId === organizationId ? { id: projectId } : null,
  );
});

const answer = (text: string): DraftOutput => ({
  text,
  rationale: "Names the next step.",
  usedQueries: [],
  claims: [],
});
function answers(...outputs: DraftOutput[]) {
  for (const output of outputs)
    mocks.generate.mockImplementationOnce(async (options) => {
      await options.onStepFinish({
        providerMetadata: { openrouter: { usage: { cost: 0.001 } } },
      });
      return { output, response: { modelId: "test-model" } };
    });
}

it("retries a draft that adds urgency, and returns the clean one", async () => {
  const input = await fixture(database);
  answers(answer("Apply today only"), answer("Share your product"));
  const draft = await CopyDraftService.draft(
    {
      organizationId: input.organizationId,
      userId: "reviewer",
      userEmail: "reviewer@example.com",
      role: "owner",
    },
    {
      projectId: input.projectId,
      opportunityId: input.proposal.opportunityId,
      expectedOpportunityVersion: input.proposal.opportunityVersion,
      text: "Contact us",
      blockKind: "button",
    },
  );
  expect(draft).toMatchObject({
    kind: "page_copy",
    status: "generated",
    valueBefore: "Contact us",
    valueAfter: "Share your product",
  });
  expect(mocks.generate.mock.calls[1][0].prompt).toContain("today only");
});
