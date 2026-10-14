import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import type { GithubClient } from "./githubClient";
import type { PublishingRepository } from "./repositories/PublishingRepository";
import { MetadataExecutionService } from "./MetadataExecutionService";
import { proposalFingerprint } from "./proposalFingerprint";
import {
  makePublishingFixture,
  publishingTestSecret,
  publishingTestToken,
} from "./publishing-test-fixtures";

const mocks = vi.hoisted(() => ({
  project: vi.fn(),
  claim: vi.fn(),
  finish: vi.fn(),
  history: vi.fn(),
  connection: vi.fn(),
  detail: vi.fn(),
  gsc: vi.fn(),
  env: vi.fn(),
  client: vi.fn(),
  begin: vi.fn<typeof PublishingRepository.beginExecution>(),
  checkpoint: vi.fn<typeof PublishingRepository.checkpoint>(),
}));
vi.mock("@/server/features/projects/repositories/ProjectRepository", () => ({
  ProjectRepository: { getProjectForOrganization: mocks.project },
}));
vi.mock(
  "@/server/features/dashboard/repositories/DataRefreshClaimRepository",
  () => ({
    DataRefreshClaimRepository: { claim: mocks.claim, finish: mocks.finish },
  }),
);
vi.mock(
  "@/server/features/opportunities/repositories/OpportunityRepository",
  () => ({ OpportunityRepository: { getDetail: mocks.detail } }),
);
vi.mock("@/server/features/gsc/services/GscService", () => ({
  GscService: { getConnection: mocks.gsc },
}));
vi.mock("./repositories/PublishingRepository", () => ({
  PublishingRepository: {
    getProposal: mocks.history,
    getConnectionById: mocks.connection,
    beginExecution: mocks.begin,
    checkpoint: mocks.checkpoint,
  },
}));
vi.mock("@/server/lib/runtime-env", () => ({ getOptionalEnvValue: mocks.env }));
vi.mock("./githubClient", () => ({ createGithubClient: mocks.client }));

let fixture: Awaited<ReturnType<typeof makePublishingFixture>>;
let github: {
  [K in keyof GithubClient]: GithubClient[K] extends (
    ...args: never[]
  ) => unknown
    ? Mock<GithubClient[K]>
    : GithubClient[K];
};
let branchSha: string | null;
const headSha = "b".repeat(40);
const network = vi.fn();
function execute() {
  return MetadataExecutionService.execute(
    fixture.context,
    fixture.executeInput,
  );
}
function expectNoRemoteWrites() {
  expect(github.createRef).not.toHaveBeenCalled();
  expect(github.updateFile).not.toHaveBeenCalled();
  expect(github.createPullRequest).not.toHaveBeenCalled();
}

beforeEach(async () => {
  fixture = await makePublishingFixture();
  branchSha = null;
  const { proposal, connection, detail, source } = fixture;
  github = {
    requestCount: 9,
    getRepository: vi
      .fn<GithubClient["getRepository"]>()
      .mockResolvedValue(fixture.repository),
    readFile: vi
      .fn<GithubClient["readFile"]>()
      .mockResolvedValue({ source, blobSha: proposal.beforeBlobSha }),
    getRef: vi
      .fn<GithubClient["getRef"]>()
      .mockImplementation(async (branch) =>
        branch === connection.baseBranch
          ? { sha: proposal.baseSha }
          : branchSha
            ? { sha: branchSha }
            : null,
      ),
    createRef: vi
      .fn<GithubClient["createRef"]>()
      .mockImplementation(async () => {
        branchSha = proposal.baseSha;
        return { sha: branchSha };
      }),
    updateFile: vi
      .fn<GithubClient["updateFile"]>()
      .mockImplementation(async () => {
        branchSha = headSha;
        return { commitSha: headSha, blobSha: proposal.afterBlobSha };
      }),
    getCommit: vi.fn<GithubClient["getCommit"]>().mockResolvedValue({
      sha: headSha,
      treeSha: "c".repeat(40),
      parents: [proposal.baseSha],
    }),
    verifySingleFileCommit: vi
      .fn<GithubClient["verifySingleFileCommit"]>()
      .mockResolvedValue(true),
    findPullRequest: vi
      .fn<GithubClient["findPullRequest"]>()
      .mockResolvedValue(null),
    getPullRequest: vi
      .fn<GithubClient["getPullRequest"]>()
      .mockImplementation(async () => fixture.pullRequest),
    createPullRequest: vi
      .fn<GithubClient["createPullRequest"]>()
      .mockImplementation(async () => fixture.pullRequest),
  };
  mocks.project.mockResolvedValue({ id: proposal.projectId });
  mocks.claim.mockResolvedValue("execution-1");
  mocks.finish.mockResolvedValue(undefined);
  mocks.history.mockResolvedValue({
    proposal,
    connection,
    executions: [],
    approvals: [],
    events: [],
  });
  mocks.connection.mockResolvedValue(connection);
  mocks.detail.mockResolvedValue(detail);
  mocks.gsc.mockResolvedValue({ siteUrl: detail.opportunity.siteUrl });
  mocks.env.mockResolvedValue(publishingTestSecret);
  mocks.client.mockReturnValue(github);
  mocks.begin.mockResolvedValue(true);
  mocks.checkpoint.mockResolvedValue(true);
  network.mockImplementation(() => {
    throw new Error("Unexpected network request");
  });
  vi.stubGlobal("fetch", network);
});
afterEach(() => {
  expect(network).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

describe("MetadataExecutionService authorization and exact approval", () => {
  it.each(["foreign-project", "member"])(
    "rejects %s before claims, approvals or GitHub access",
    async (scenario) => {
      if (scenario === "foreign-project") mocks.project.mockResolvedValue(null);
      else fixture.context.role = "member";
      await expect(execute()).rejects.toMatchObject({
        code: scenario === "member" ? "FORBIDDEN" : "NOT_FOUND",
      });
      expect(mocks.claim).not.toHaveBeenCalled();
      expect(mocks.begin).not.toHaveBeenCalled();
      expect(mocks.client).not.toHaveBeenCalled();
    },
  );

  it("persists exact human approval before the first remote request", async () => {
    let approved = false;
    mocks.begin.mockImplementation(
      async ({ approval, execution, organizationId, siteUrl }) => {
        expect(approval).toMatchObject({
          projectId: fixture.proposal.projectId,
          proposalId: fixture.proposal.id,
          actorUserId: fixture.context.userId,
          changeHash: fixture.proposal.changeHash,
          note: fixture.executeInput.note,
          id: execution.approvalId,
        });
        expect(organizationId).toBe(fixture.context.organizationId);
        expect(siteUrl).toBe(fixture.detail.opportunity.siteUrl);
        for (const method of Object.values(github))
          if (typeof method === "function")
            expect(method).not.toHaveBeenCalled();
        approved = true;
        return true;
      },
    );
    github.getRepository.mockImplementationOnce(async () => {
      expect(approved).toBe(true);
      return fixture.repository;
    });
    await expect(execute()).resolves.toMatchObject({
      ok: true,
      executionId: "execution-1",
    });
    expect(mocks.client).toHaveBeenCalledWith(
      expect.objectContaining({
        token: publishingTestToken,
        owner: "example",
        repository: "website",
      }),
    );
  });

  it("does no remote work when the atomic approval gate loses", async () => {
    mocks.begin.mockResolvedValue(false);
    await expect(execute()).resolves.toMatchObject({ ok: false });
    for (const method of Object.values(github))
      if (typeof method === "function") expect(method).not.toHaveBeenCalled();
    expect(mocks.checkpoint).not.toHaveBeenCalled();
  });

  it.each([
    "hash",
    "tampered-proposal",
    "stale-evidence",
    "replaced-evidence",
    "revoked-connection",
    "changed-property",
    "invalid-encryption",
  ])(
    "fails closed for %s before approval or remote requests",
    async (scenario) => {
      if (scenario === "hash") fixture.executeInput.changeHash = "0".repeat(64);
      if (scenario === "tampered-proposal")
        fixture.proposal.descriptionAfter = "Unreviewed copy";
      if (scenario === "stale-evidence")
        fixture.detail.opportunity.lastDetectedAt = new Date(
          Date.now() - 15 * 86_400_000,
        ).toISOString();
      if (scenario === "replaced-evidence")
        fixture.detail.opportunity.evidenceRunId = "new-evidence";
      if (scenario === "revoked-connection")
        fixture.connection.revokedAt = new Date().toISOString();
      if (scenario === "changed-property")
        mocks.gsc.mockResolvedValue({ siteUrl: "https://other.example/" });
      if (scenario === "invalid-encryption")
        fixture.connection.encryptedToken = "corrupted-ciphertext";
      await expect(execute()).resolves.toMatchObject({ ok: false });
      expect(mocks.begin).not.toHaveBeenCalled();
      expect(mocks.client).not.toHaveBeenCalled();
    },
  );

  it.each(["source-content", "source-blob", "snippet"])(
    "refuses %s drift before any remote write",
    async (scenario) => {
      if (scenario === "source-content")
        github.readFile.mockResolvedValue({
          source: fixture.source + "// changed",
          blobSha: fixture.proposal.beforeBlobSha,
        });
      if (scenario === "source-blob")
        github.readFile.mockResolvedValue({
          source: fixture.source,
          blobSha: "c".repeat(40),
        });
      if (scenario === "snippet") {
        fixture.proposal.afterSnippet = "tampered snippet";
        fixture.proposal.changeHash = await proposalFingerprint(
          fixture.proposal,
        );
        fixture.executeInput.changeHash = fixture.proposal.changeHash;
      }
      await expect(execute()).resolves.toMatchObject({ ok: false });
      expect(mocks.begin).toHaveBeenCalledOnce();
      expectNoRemoteWrites();
      expect(mocks.checkpoint).toHaveBeenCalledWith(
        expect.objectContaining({ phase: "failed" }),
      );
    },
  );

  it("records branch, exact file commit and verified PR checkpoints in order", async () => {
    await expect(execute()).resolves.toMatchObject({ ok: true });
    expect(github.updateFile).toHaveBeenCalledWith(
      expect.objectContaining({
        branch: `growth/${fixture.proposal.id}`,
        path: fixture.proposal.filePath,
        source: fixture.afterSource,
        blobSha: fixture.proposal.beforeBlobSha,
      }),
    );
    expect(mocks.checkpoint.mock.calls.map(([value]) => value.phase)).toEqual([
      "branch_created",
      "file_committed",
      "pull_request_created",
    ]);
    expect(mocks.checkpoint).toHaveBeenLastCalledWith(
      expect.objectContaining({
        projectId: fixture.proposal.projectId,
        organizationId: fixture.context.organizationId,
        executionId: "execution-1",
        requestCount: 9,
        commitSha: headSha,
        pullRequestNumber: 7,
        pullRequestUrl: fixture.pullRequest.url,
      }),
    );
  });
});

describe("MetadataExecutionService interruption recovery", () => {
  it("recovers the existing exact PR without writes even after the base advances", async () => {
    github.findPullRequest.mockResolvedValue(fixture.pullRequest);
    github.getRef.mockResolvedValue({ sha: "d".repeat(40) });
    await expect(execute()).resolves.toMatchObject({ ok: true });
    expectNoRemoteWrites();
    expect(github.getRef).not.toHaveBeenCalled();
    expect(mocks.checkpoint.mock.calls.map(([value]) => value.phase)).toEqual([
      "pull_request_created",
    ]);
  });

  it("recovers an existing verified one-file commit without writing the file again", async () => {
    branchSha = headSha;
    await expect(execute()).resolves.toMatchObject({ ok: true });
    expect(github.createRef).not.toHaveBeenCalled();
    expect(github.updateFile).not.toHaveBeenCalled();
    expect(github.verifySingleFileCommit).toHaveBeenCalledWith({
      baseSha: fixture.proposal.baseSha,
      headSha,
      path: fixture.proposal.filePath,
      blobSha: fixture.proposal.afterBlobSha,
    });
    expect(github.createPullRequest).toHaveBeenCalledOnce();
  });

  it.each([
    "unknown-branch",
    "extra-diff",
    "parent-mismatch",
    "blob-mismatch",
    "base-advanced",
  ])("stops unsafe %s without opening a PR", async (scenario) => {
    if (scenario === "unknown-branch") {
      branchSha = "d".repeat(40);
      github.verifySingleFileCommit.mockResolvedValue(false);
    }
    if (scenario === "extra-diff")
      github.verifySingleFileCommit.mockResolvedValue(false);
    if (scenario === "parent-mismatch")
      github.getCommit.mockResolvedValue({
        sha: headSha,
        treeSha: "c".repeat(40),
        parents: ["d".repeat(40)],
      });
    if (scenario === "blob-mismatch")
      github.updateFile.mockResolvedValue({
        commitSha: headSha,
        blobSha: "d".repeat(40),
      });
    if (scenario === "base-advanced")
      github.getRef.mockResolvedValue({ sha: "d".repeat(40) });
    await expect(execute()).resolves.toMatchObject({ ok: false });
    expect(github.createPullRequest).not.toHaveBeenCalled();
    if (scenario === "unknown-branch" || scenario === "base-advanced")
      expectNoRemoteWrites();
  });

  it.each(["branch_created", "file_committed"] as const)(
    "stops the next remote write when %s checkpoint loses its claim",
    async (phase) => {
      mocks.checkpoint.mockImplementation(
        async (value) => value.phase !== phase,
      );
      await expect(execute()).resolves.toMatchObject({ ok: false });
      if (phase === "branch_created")
        expect(github.updateFile).not.toHaveBeenCalled();
      expect(github.createPullRequest).not.toHaveBeenCalled();
    },
  );

  it("sanitizes an unknown provider failure before returning or recording it", async () => {
    github.updateFile.mockRejectedValue(
      new Error(`Bearer ${publishingTestToken} private provider body`),
    );
    const result = await execute();
    expect(result.ok).toBe(false);
    expect(result.message).toContain("GitHub work could not finish");
    expect(JSON.stringify([result, mocks.checkpoint.mock.calls])).not.toContain(
      publishingTestToken,
    );
    expect(JSON.stringify([result, mocks.checkpoint.mock.calls])).not.toContain(
      "private provider body",
    );
  });

  it("does not overwrite a recorded successful PR when lease release fails", async () => {
    mocks.finish.mockRejectedValue(new Error("database unavailable"));
    await expect(execute()).resolves.toMatchObject({
      ok: true,
      executionId: "execution-1",
    });
    expect(mocks.checkpoint.mock.calls.map(([value]) => value.phase)).toEqual([
      "branch_created",
      "file_committed",
      "pull_request_created",
    ]);
  });
});
