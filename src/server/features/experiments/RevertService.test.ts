import { beforeEach, describe, expect, it, vi } from "vitest";
import { gitBlobHash } from "@/server/features/publishing/proposalFingerprint";
import type * as PublishingAccess from "@/server/features/publishing/publishingAccess";
import type { MetadataProposal } from "@/types/schemas/publishing";
import { RevertService } from "./RevertService";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  opportunity: vi.fn(),
  connection: vi.fn(),
  save: vi.fn<(input: { proposal: MetadataProposal }) => Promise<boolean>>(),
  page: { source: "" },
}));
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("@/server/features/publishing/publishingAccess", async (actual) => ({
  ...(await actual<typeof PublishingAccess>()),
  authorizePublishing: vi.fn(),
  withPublishingClaim: (
    _context: unknown,
    _projectId: string,
    run: (claim: string, signal: AbortSignal) => unknown,
  ) => run("claim-1", new AbortController().signal),
  connectedGithub: () => ({
    getRepository: async () => ({
      id: "repo-1",
      archived: false,
      canPush: true,
    }),
    getRef: async () => ({ sha: "c".repeat(40) }),
    readFile: async (path: string) => {
      const source =
        path === "package.json"
          ? '{"dependencies":{"next":"15.4.0"}}'
          : mocks.page.source;
      return { source, blobSha: await gitBlobHash(source) };
    },
  }),
}));
vi.mock(
  "@/server/features/publishing/repositories/PublishingRepository",
  () => ({
    PublishingRepository: {
      getConnection: mocks.connection,
      saveProposal: mocks.save,
    },
  }),
);
vi.mock(
  "@/server/features/opportunities/repositories/OpportunityRepository",
  () => ({ OpportunityRepository: { getDetail: mocks.opportunity } }),
);
vi.mock("./repositories/ExperimentRepository", () => ({
  ExperimentRepository: { get: mocks.get },
}));

const context = { organizationId: "org-1", userId: "user-1", role: "owner" };
const input = { projectId: "project-1", experimentId: "experiment-1" };
const page = (description: string) =>
  `export const metadata = { description: '${description}' };\n`;

beforeEach(() => {
  mocks.page.source = page("New pricing copy");
  mocks.get.mockResolvedValue({
    experiment: { pullRequestState: "merged" },
    latestRun: null,
    publishing: {
      connection: { repositoryId: "repo-1" },
      proposal: {
        id: "proposal-1",
        opportunityId: "opportunity-1",
        filePath: "app/pricing/page.tsx",
        targetUrl: "https://example.com/pricing",
        descriptionBefore: "Old pricing copy",
        descriptionAfter: "New pricing copy",
        titleBefore: null,
        titleAfter: null,
        canonicalBefore: null,
        canonicalAfter: null,
        robotsBefore: null,
        robotsAfter: null,
        revertsProposalId: null,
      },
    },
  });
  mocks.opportunity.mockResolvedValue({
    opportunity: {
      id: "opportunity-1",
      status: "implemented",
      version: 4,
      evidenceRunId: "run-1",
    },
  });
  mocks.connection.mockResolvedValue({
    id: "connection-1",
    repositoryId: "repo-1",
    baseBranch: "main",
    rootDirectory: "",
  });
  mocks.save.mockResolvedValue(true);
});

describe("RevertService.prepare", () => {
  it("saves the exact inverse of the shipped change", async () => {
    expect(await RevertService.prepare(context, input)).toMatchObject({
      ok: true,
    });
    expect(mocks.save.mock.calls[0][0].proposal).toMatchObject({
      revertsProposalId: "proposal-1",
      fingerprintVersion: 5,
      descriptionBefore: "New pricing copy",
      descriptionAfter: "Old pricing copy",
      opportunityVersion: 4,
    });
  });

  it("refuses when the page no longer shows the approved text", async () => {
    mocks.page.source = page("Someone else changed this copy");
    expect(await RevertService.prepare(context, input)).toEqual({
      ok: false,
      message:
        "The page changed after this proposal. Prepare a new proposal instead.",
    });
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
