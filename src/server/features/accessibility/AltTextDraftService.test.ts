import type * as Ai from "ai";
import { beforeEach, expect, it, vi } from "vitest";
import { opportunityDetail } from "@/server/features/opportunities/services/opportunityTestFixtures";
import type { DraftOutput } from "@/server/features/publishing/draftChecks";
import { AltTextDraftService } from "./AltTextDraftService";

// RFC-0013 5.4: an alt text draft passes the alt text rules before a person
// sees it, and a failing answer is retried with the reasons.
const mocks = vi.hoisted(() => ({
  generate:
    vi.fn<
      (options: {
        prompt?: string;
        messages?: Array<{ content: unknown[] }>;
        onStepFinish: (step: unknown) => Promise<void>;
      }) => Promise<unknown>
    >(),
  detail: vi.fn(),
  save: vi.fn(),
}));
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof Ai>()),
  generateText: mocks.generate,
}));
vi.mock("@/server/billing/researchHold", () => ({
  holdResearch: async () => null,
  settleResearch: async () => undefined,
}));
vi.mock("@/server/lib/runtime-env", () => ({
  isHostedServerAuthMode: async () => false,
  getRequiredEnvValue: async () => "test-key",
  getOptionalEnvValue: async () => undefined,
}));
vi.mock("@/server/lib/openrouter", () => ({
  buildChatAgentModel: () => ({}),
  requireOpenRouterAccess: async () => ({ apiKey: "test-key" }),
}));
vi.mock("@/server/lib/audit/url-policy", () => ({
  normalizeAndValidateStartUrl: async (url: string) => url,
}));
vi.mock("@/server/lib/scrape", () => ({
  readPages: async () => ({
    pages: [
      { title: "About us", text: "Our team plans each release together." },
    ],
  }),
}));
vi.mock("@/server/features/projects/repositories/ProjectRepository", () => ({
  ProjectRepository: { getProjectForOrganization: async () => ({ id: "p" }) },
}));
vi.mock(
  "@/server/features/dashboard/repositories/DataRefreshClaimRepository",
  () => ({
    DataRefreshClaimRepository: {
      claim: async () => "claim",
      finish: async () => undefined,
    },
  }),
);
vi.mock(
  "@/server/features/opportunities/repositories/OpportunityRepository",
  () => ({ OpportunityRepository: { getDetail: mocks.detail } }),
);
vi.mock(
  "@/server/features/publishing/repositories/ProposalDraftRepository",
  () => ({
    ProposalDraftRepository: {
      countSince: async () => ({ opportunity: 0, project: 0 }),
      save: mocks.save,
    },
  }),
);

beforeEach(() => {
  const detail = opportunityDetail("approved");
  detail.opportunity.type = "accessibility_issue";
  detail.accessibilityEvidence = [
    {
      id: "row",
      opportunityId: detail.opportunity.id,
      runId: detail.opportunity.evidenceRunId,
      auditId: "audit",
      clusterKey: "cluster",
      ruleId: "image-alt",
      impact: "critical",
      wcagTags: "wcag2a",
      pagesAffected: 1,
      exampleUrl: "https://example.com/about",
      exampleSelector: "img",
      exampleSnippet:
        '<img src="/_next/static/media/team-planning.8f3a2c1d.jpg">',
    },
  ];
  mocks.detail.mockResolvedValue(detail);
  mocks.save.mockResolvedValue(undefined);
});

function answers(...texts: string[]) {
  for (const text of texts)
    mocks.generate.mockImplementationOnce(async (options) => {
      await options.onStepFinish({
        providerMetadata: { openrouter: { usage: { cost: 0.001 } } },
      });
      const output: DraftOutput = {
        text,
        rationale: "From the file name and the page.",
        usedQueries: [],
        claims: [],
      };
      return { output, response: { modelId: "test-model" } };
    });
}

const context = {
  organizationId: "org",
  userId: "reviewer",
  userEmail: "reviewer@example.com",
  role: "owner",
};

it('retries a draft that starts with "image of", and returns the clean one', async () => {
  answers("Image of the team planning", "The team planning a release");
  const draft = await AltTextDraftService.draft(context, {
    projectId: "p",
    opportunityId: "opportunity-1",
    expectedOpportunityVersion: 1,
  });
  expect(draft).toMatchObject({
    kind: "alt_text",
    status: "generated",
    valueAfter: "The team planning a release",
  });
  expect(mocks.generate.mock.calls[0][0].prompt).toContain("team-planning.jpg");
  expect(mocks.generate.mock.calls[1][0].prompt).toContain('"image of"');
});

it("lets the model see the image from its public URL when the person allows it", async () => {
  answers("The team planning a release");
  const draft = await AltTextDraftService.draft(context, {
    projectId: "p",
    opportunityId: "opportunity-1",
    expectedOpportunityVersion: 1,
    vision: true,
  });
  expect(draft.promptVersion).toBe("alt-text-vision-v1");
  expect(mocks.generate.mock.calls[0][0].messages?.[0].content[1]).toEqual({
    type: "image",
    image: new URL(
      "https://example.com/_next/static/media/team-planning.8f3a2c1d.jpg",
    ),
  });
});
