import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ProposalWithHistory,
  RecoverPublishingInput,
} from "@/types/schemas/publishing";
import { PublishingRecoveryService } from "./PublishingRecoveryService";
import type { createGithubClient } from "./githubClient";
import { connectionSummary } from "./publishingAccess";
import {
  makePublishingFixture,
  publishingTestSecret,
  publishingTestToken,
} from "./publishing-test-fixtures";
import type { PublishingRepository } from "./repositories/PublishingRepository";

const mocks = vi.hoisted(() => ({
  project: vi.fn(),
  env: vi.fn(),
  claim: vi.fn(),
  finish: vi.fn(),
  detail: vi.fn(),
  latest: vi.fn(),
  connection: vi.fn(),
  recover: vi.fn<typeof PublishingRepository.recoverOpportunity>(),
  client:
    vi.fn<(options: Parameters<typeof createGithubClient>[0]) => unknown>(),
  repository: vi.fn(),
  pull: vi.fn(),
  createRef: vi.fn(),
  updateFile: vi.fn(),
  createPullRequest: vi.fn(),
}));
vi.mock("@/server/features/projects/repositories/ProjectRepository", () => ({
  ProjectRepository: { getProjectForOrganization: mocks.project },
}));
vi.mock("@/server/lib/runtime-env", () => ({ getOptionalEnvValue: mocks.env }));
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
vi.mock("./repositories/PublishingRepository", () => ({
  PublishingRepository: {
    getLatestExecution: mocks.latest,
    getConnection: mocks.connection,
    recoverOpportunity: mocks.recover,
  },
}));
vi.mock("./githubClient", () => ({ createGithubClient: mocks.client }));

let fixture: Awaited<ReturnType<typeof makePublishingFixture>>;
let input: RecoverPublishingInput;
let history: ProposalWithHistory;
beforeEach(async () => {
  fixture = await makePublishingFixture();
  fixture.detail.opportunity.status = "failed";
  fixture.detail.opportunity.version += 2;
  input = {
    projectId: fixture.proposal.projectId,
    opportunityId: fixture.proposal.opportunityId,
    expectedVersion: fixture.detail.opportunity.version,
    confirmRecovery: true,
  };
  history = {
    proposal: fixture.proposal,
    connection: connectionSummary(fixture.connection),
    approvals: [],
    events: [],
    executions: [
      {
        id: "failed-execution",
        projectId: input.projectId,
        proposalId: fixture.proposal.id,
        approvalId: "approval-1",
        status: "failed",
        phase: "failed",
        branchName: `growth/${fixture.proposal.id}`,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        requestCount: 5,
        commitSha: null,
        pullRequestNumber: null,
        pullRequestUrl: null,
        error: "Interrupted GitHub request",
      },
    ],
  };
  mocks.project.mockResolvedValue({ id: input.projectId });
  mocks.env.mockResolvedValue(publishingTestSecret);
  mocks.claim.mockResolvedValue("claim-1");
  mocks.finish.mockResolvedValue(undefined);
  mocks.detail.mockResolvedValue(fixture.detail);
  mocks.latest.mockResolvedValue(history);
  mocks.connection.mockResolvedValue(fixture.connection);
  mocks.recover.mockResolvedValue(true);
  mocks.repository.mockResolvedValue(fixture.repository);
  mocks.pull.mockResolvedValue(null);
  mocks.client.mockReturnValue({
    getRepository: mocks.repository,
    findPullRequest: mocks.pull,
    createRef: mocks.createRef,
    updateFile: mocks.updateFile,
    createPullRequest: mocks.createPullRequest,
  });
});

afterEach(() => {
  expect(mocks.createRef).not.toHaveBeenCalled();
  expect(mocks.updateFile).not.toHaveBeenCalled();
  expect(mocks.createPullRequest).not.toHaveBeenCalled();
});

const recover = () => PublishingRecoveryService.recover(fixture.context, input);

describe("PublishingRecoveryService", () => {
  it("denies a foreign project before reading publishing state or claiming work", async () => {
    mocks.project.mockResolvedValue(null);
    await expect(recover()).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.project).toHaveBeenCalledWith(
      input.projectId,
      fixture.context.organizationId,
    );
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.detail).not.toHaveBeenCalled();
    expect(mocks.latest).not.toHaveBeenCalled();
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.recover).not.toHaveBeenCalled();
  });

  it("denies members before acquiring a publishing lease", async () => {
    await expect(
      PublishingRecoveryService.recover(
        { ...fixture.context, role: "member" },
        input,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.recover).not.toHaveBeenCalled();
  });

  it.each([
    "missing opportunity",
    "status",
    "version",
    "missing history",
    "missing execution",
    "running execution",
    "successful execution",
  ])("rejects %s before accessing GitHub", async (reason) => {
    if (reason === "missing opportunity") mocks.detail.mockResolvedValue(null);
    if (reason === "status") fixture.detail.opportunity.status = "in_progress";
    if (reason === "version") input.expectedVersion++;
    if (reason === "missing history") mocks.latest.mockResolvedValue(null);
    if (reason === "missing execution") history.executions = [];
    if (reason === "running execution")
      history.executions[0].status = "running";
    if (reason === "successful execution")
      history.executions[0].status = "succeeded";
    expect(await recover()).toMatchObject({ ok: false });
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.recover).not.toHaveBeenCalled();
    expect(mocks.finish).toHaveBeenCalledWith(
      `publishing:${input.projectId}`,
      "claim-1",
      0,
    );
  });

  it.each(["missing", "repositoryId", "owner", "repository", "baseBranch"])(
    "requires the original repository and base when the connection changes: %s",
    async (field) => {
      mocks.connection.mockResolvedValue(
        field === "missing"
          ? null
          : { ...fixture.connection, [field]: "other" },
      );
      const result = await recover();
      expect(result.ok).toBe(false);
      expect(result.message).toContain("original repository and base branch");
      expect(mocks.client).not.toHaveBeenCalled();
      expect(mocks.recover).not.toHaveBeenCalled();
    },
  );

  it.each([
    { role: "owner", closed: false },
    { role: "admin", closed: true },
  ])(
    "allows $role to request fenced re-review after read-only reconciliation (closed=$closed)",
    async ({ role, closed }) => {
      // A replacement credential may differ in spelling, but not repository identity.
      mocks.connection.mockResolvedValue({
        ...fixture.connection,
        id: "reconnected",
        owner: fixture.connection.owner.toUpperCase(),
        repository: fixture.connection.repository.toUpperCase(),
      });
      if (closed)
        mocks.pull.mockResolvedValue({
          ...fixture.pullRequest,
          state: "closed",
          merged: false,
        });
      const result = await PublishingRecoveryService.recover(
        { ...fixture.context, role },
        input,
      );
      expect(result.ok).toBe(true);
      expect(result.message).toContain("Approve the current evidence again");
      expect(mocks.client.mock.calls[0][0].token).toBe(publishingTestToken);
      expect(mocks.client.mock.calls[0][0].signal).toBeInstanceOf(AbortSignal);
      expect(mocks.detail).toHaveBeenCalledWith(
        input.projectId,
        input.opportunityId,
      );
      expect(mocks.latest).toHaveBeenCalledWith(
        input.projectId,
        input.opportunityId,
      );
      expect(mocks.pull).toHaveBeenCalledWith({
        headBranch: history.executions[0].branchName,
        baseBranch: fixture.connection.baseBranch,
      });
      // These fields are the tenant, optimistic-version and execution/lease fencing contract.
      expect(mocks.recover).toHaveBeenCalledExactlyOnceWith({
        projectId: input.projectId,
        opportunityId: input.opportunityId,
        expectedVersion: input.expectedVersion,
        executionId: "failed-execution",
        actorUserId: fixture.context.userId,
        organizationId: fixture.context.organizationId,
        claimToken: "claim-1",
      });
      expect(JSON.stringify(result)).not.toContain(publishingTestToken);
      expect(JSON.stringify(result)).not.toContain(
        fixture.connection.encryptedToken!,
      );
      expect(mocks.finish).toHaveBeenCalledWith(
        `publishing:${input.projectId}`,
        "claim-1",
        0,
      );
    },
  );

  it.each([
    { state: "open", merged: false },
    { state: "closed", merged: true },
  ])(
    "preserves failed history for a $state PR (merged=$merged)",
    async (pull) => {
      mocks.pull.mockResolvedValue({ ...fixture.pullRequest, ...pull });
      const result = await recover();
      expect(result.ok).toBe(false);
      expect(result.message).toContain("open or merged pull request");
      expect(mocks.recover).not.toHaveBeenCalled();
    },
  );

  it("rejects provider repository identity drift before checking PRs", async () => {
    mocks.repository.mockResolvedValue({ ...fixture.repository, id: "999" });
    expect(await recover()).toMatchObject({ ok: false });
    expect(mocks.pull).not.toHaveBeenCalled();
    expect(mocks.recover).not.toHaveBeenCalled();
  });

  it("does not reconcile or release another operation's lease", async () => {
    mocks.claim.mockResolvedValue(null);
    expect(await recover()).toMatchObject({ ok: false });
    expect(mocks.detail).not.toHaveBeenCalled();
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.recover).not.toHaveBeenCalled();
    expect(mocks.finish).not.toHaveBeenCalled();
  });

  it("fails closed when the current credential cannot be decrypted", async () => {
    mocks.connection.mockResolvedValue({
      ...fixture.connection,
      encryptedToken: "invalid-ciphertext",
    });
    const result = await recover();
    expect(result.ok).toBe(false);
    expect(result.message).toContain("BETTER_AUTH_SECRET");
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.recover).not.toHaveBeenCalled();
  });

  it("sanitizes provider errors without resetting the failed opportunity", async () => {
    mocks.pull.mockRejectedValue(
      new Error(`Provider leaked ${publishingTestToken}`),
    );
    const result = await recover();
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain(publishingTestToken);
    expect(result.message).not.toContain("Provider leaked");
    expect(mocks.recover).not.toHaveBeenCalled();
    expect(mocks.finish).toHaveBeenCalledWith(
      `publishing:${input.projectId}`,
      "claim-1",
      0,
    );
  });

  it("reports CAS loss without claiming a successful reset", async () => {
    mocks.recover.mockResolvedValue(false);
    expect(await recover()).toMatchObject({ ok: false });
    expect(mocks.recover).toHaveBeenCalledTimes(1);
    expect(mocks.finish).toHaveBeenCalledWith(
      `publishing:${input.projectId}`,
      "claim-1",
      0,
    );
  });
});
