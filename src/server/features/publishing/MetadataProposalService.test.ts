import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrepareProposalInput } from "@/types/schemas/publishing";
import { MetadataProposalService } from "./MetadataProposalService";
import { gitBlobHash, proposalFingerprint } from "./proposalFingerprint";
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
  connection: vi.fn(),
  detail: vi.fn(),
  gsc: vi.fn(),
  list: vi.fn(),
  save: vi.fn<typeof PublishingRepository.saveProposal>(),
  client: vi.fn(),
  repository: vi.fn(),
  ref: vi.fn(),
  readFile: vi.fn(),
  createRef: vi.fn(),
  updateFile: vi.fn(),
  createPullRequest: vi.fn(),
  replaceConnection: vi.fn(),
  disconnect: vi.fn(),
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
vi.mock("@/server/features/gsc/services/GscService", () => ({
  GscService: { getConnection: mocks.gsc },
}));
vi.mock("./repositories/PublishingRepository", () => ({
  PublishingRepository: {
    getConnection: mocks.connection,
    listProposals: mocks.list,
    saveProposal: mocks.save,
    replaceConnection: mocks.replaceConnection,
    disconnect: mocks.disconnect,
  },
}));
vi.mock("./githubClient", () => ({ createGithubClient: mocks.client }));
let fixture: Awaited<ReturnType<typeof makePublishingFixture>>;
let input: PrepareProposalInput;
beforeEach(async () => {
  fixture = await makePublishingFixture();
  input = {
    projectId: fixture.connection.projectId,
    opportunityId: fixture.proposal.opportunityId,
    expectedOpportunityVersion: fixture.proposal.opportunityVersion,
    filePath: fixture.proposal.filePath,
    newDescription: fixture.proposal.descriptionAfter,
  };
  mocks.project.mockResolvedValue({ id: input.projectId });
  mocks.env.mockResolvedValue(publishingTestSecret);
  mocks.claim.mockResolvedValue("claim-1");
  mocks.finish.mockResolvedValue(undefined);
  mocks.connection.mockResolvedValue(fixture.connection);
  mocks.detail.mockResolvedValue(fixture.detail);
  mocks.gsc.mockResolvedValue({ siteUrl: fixture.detail.opportunity.siteUrl });
  mocks.list.mockResolvedValue([]);
  mocks.save.mockResolvedValue(true);
  mocks.repository.mockResolvedValue(fixture.repository);
  mocks.ref.mockResolvedValue({ sha: fixture.proposal.baseSha });
  mocks.readFile.mockImplementation(async (path: string) =>
    path === "package.json"
      ? {
          source: '{"dependencies":{"next":"^15.4.0"}}',
          blobSha: "b".repeat(40),
        }
      : { source: fixture.source, blobSha: fixture.proposal.beforeBlobSha },
  );
  mocks.client.mockReturnValue({
    getRepository: mocks.repository,
    getRef: mocks.ref,
    readFile: mocks.readFile,
    createRef: mocks.createRef,
    updateFile: mocks.updateFile,
    createPullRequest: mocks.createPullRequest,
  });
  mocks.replaceConnection.mockResolvedValue(true);
  mocks.disconnect.mockResolvedValue(true);
});

function expectNoRemoteWrites() {
  expect(mocks.createRef).not.toHaveBeenCalled();
  expect(mocks.updateFile).not.toHaveBeenCalled();
  expect(mocks.createPullRequest).not.toHaveBeenCalled();
}

describe("MetadataProposalService", () => {
  it.each(["get", "prepare"] as const)(
    "authorizes project ownership before %s reads",
    async (method) => {
      mocks.project.mockResolvedValue(null);
      const result =
        method === "get"
          ? MetadataProposalService.get(
              fixture.context,
              input.projectId,
              input.opportunityId,
            )
          : MetadataProposalService.prepare(fixture.context, input);
      await expect(result).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(mocks.project).toHaveBeenCalledWith(
        input.projectId,
        fixture.context.organizationId,
      );
      expect(mocks.detail).not.toHaveBeenCalled();
      expect(mocks.list).not.toHaveBeenCalled();
      expect(mocks.connection).not.toHaveBeenCalled();
      expect(mocks.claim).not.toHaveBeenCalled();
      expect(mocks.client).not.toHaveBeenCalled();
    },
  );

  it("does not list proposals for an opportunity outside the project", async () => {
    mocks.detail.mockResolvedValue(null);
    await expect(
      MetadataProposalService.get(
        fixture.context,
        input.projectId,
        "foreign-opportunity",
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.detail).toHaveBeenCalledWith(
      input.projectId,
      "foreign-opportunity",
    );
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("permits scoped member reads but not preparation", async () => {
    const context = { ...fixture.context, role: "member" };
    expect(
      await MetadataProposalService.get(
        context,
        input.projectId,
        input.opportunityId,
      ),
    ).toMatchObject({ canManage: false, proposals: [] });
    expect(mocks.list).toHaveBeenCalledWith(
      input.projectId,
      input.opportunityId,
    );
    await expect(
      MetadataProposalService.prepare(context, input),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("stores a verified, evidence-bound proposal without any remote write or token exposure", async () => {
    const result = await MetadataProposalService.prepare(
      fixture.context,
      input,
    );
    expect(result.ok).toBe(true);
    expect(mocks.save).toHaveBeenCalledTimes(1);
    const saved = mocks.save.mock.calls[0][0];
    expect(saved).toMatchObject({
      organizationId: fixture.context.organizationId,
      claimToken: "claim-1",
      proposal: {
        id: result.proposalId,
        projectId: input.projectId,
        opportunityId: input.opportunityId,
        evidenceRunId: fixture.detail.opportunity.evidenceRunId,
        opportunityVersion: input.expectedOpportunityVersion,
        baseSha: fixture.proposal.baseSha,
        beforeBlobSha: fixture.proposal.beforeBlobSha,
        descriptionBefore: "Old pricing description",
        descriptionAfter: input.newDescription,
        beforeSnippet: fixture.proposal.beforeSnippet,
        afterSnippet: fixture.proposal.afterSnippet,
      },
    });
    expect(saved.proposal.afterBlobSha).toBe(
      await gitBlobHash(fixture.afterSource),
    );
    expect(saved.proposal.changeHash).toBe(
      await proposalFingerprint(saved.proposal),
    );
    expect(saved.proposal.risk).toContain("routing are not verified");
    expect(mocks.readFile.mock.calls).toEqual([
      ["package.json", fixture.proposal.baseSha],
      [input.filePath, fixture.proposal.baseSha],
    ]);
    expect(JSON.stringify([result, saved])).not.toContain(publishingTestToken);
    expect(JSON.stringify([result, saved])).not.toContain(
      fixture.connection.encryptedToken!,
    );
    expectNoRemoteWrites();
    expect(mocks.finish).toHaveBeenCalledWith(
      `publishing:${input.projectId}`,
      "claim-1",
      0,
    );
  });

  it.each(["version", "property", "evidence-age", "status", "stale-approval"])(
    "rejects stale %s before reaching GitHub",
    async (reason) => {
      if (reason === "version") input.expectedOpportunityVersion++;
      if (reason === "property")
        mocks.gsc.mockResolvedValue({ siteUrl: "https://other.example/" });
      if (reason === "evidence-age")
        fixture.detail.opportunity.lastDetectedAt = new Date(
          Date.now() - 15 * 86_400_000,
        ).toISOString();
      if (reason === "status") fixture.detail.opportunity.status = "reviewed";
      if (reason === "stale-approval")
        fixture.detail.decisions[0].evidenceRunId = "old-evidence";
      expect(
        await MetadataProposalService.prepare(fixture.context, input),
      ).toMatchObject({ ok: false });
      expect(mocks.client).not.toHaveBeenCalled();
      expect(mocks.save).not.toHaveBeenCalled();
    },
  );

  it("fails before provider calls when the encryption secret is missing", async () => {
    mocks.env.mockResolvedValue(undefined);
    const result = await MetadataProposalService.prepare(
      fixture.context,
      input,
    );
    expect(result.ok).toBe(false);
    expect(result.message).toContain("BETTER_AUTH_SECRET");
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("does not read or replace proposals when another operation owns the claim", async () => {
    mocks.claim.mockResolvedValue(null);
    expect(
      await MetadataProposalService.prepare(fixture.context, input),
    ).toMatchObject({ ok: false });
    expect(mocks.detail).not.toHaveBeenCalled();
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.finish).not.toHaveBeenCalled();
  });

  it.each(["invalid-source", "invalid-manifest", "blob-mismatch"])(
    "preserves existing proposals on %s",
    async (failure) => {
      const invalidSource =
        "export const metadata = { title: 'No description' };";
      const invalidHash = await gitBlobHash(invalidSource);
      mocks.readFile.mockImplementation(async (path: string) => {
        if (path === "package.json")
          return {
            source:
              failure === "invalid-manifest"
                ? '{"dependencies":{"next":"12.3.0"}}'
                : '{"dependencies":{"next":"15.4.0"}}',
            blobSha: "b".repeat(40),
          };
        return failure === "invalid-source"
          ? { source: invalidSource, blobSha: invalidHash }
          : { source: fixture.source, blobSha: "c".repeat(40) };
      });
      const result = await MetadataProposalService.prepare(
        fixture.context,
        input,
      );
      expect(result.ok).toBe(false);
      expect(result.message).toContain(
        failure === "blob-mismatch" ? "changed" : "not supported",
      );
      expect(mocks.save).not.toHaveBeenCalled();
      expect(mocks.replaceConnection).not.toHaveBeenCalled();
      expect(mocks.disconnect).not.toHaveBeenCalled();
      expectNoRemoteWrites();
    },
  );

  it("reads the configured package manifest and page at the same immutable commit", async () => {
    fixture.connection.rootDirectory = "apps/site";
    input.filePath = `apps/site/${input.filePath}`;
    mocks.readFile.mockImplementation(async (path: string) =>
      path === "apps/site/package.json"
        ? {
            source: '{"dependencies":{"next":"15.4.0"}}',
            blobSha: "b".repeat(40),
          }
        : { source: fixture.source, blobSha: fixture.proposal.beforeBlobSha },
    );
    expect(
      await MetadataProposalService.prepare(fixture.context, input),
    ).toMatchObject({ ok: true });
    expect(mocks.readFile.mock.calls).toEqual([
      ["apps/site/package.json", fixture.proposal.baseSha],
      [input.filePath, fixture.proposal.baseSha],
    ]);
  });

  it.each([{ id: "456" }, { archived: true }, { canPush: false }])(
    "rejects changed repository identity or permissions: %j",
    async (change) => {
      mocks.repository.mockResolvedValue({ ...fixture.repository, ...change });
      expect(
        await MetadataProposalService.prepare(fixture.context, input),
      ).toMatchObject({ ok: false });
      expect(mocks.readFile).not.toHaveBeenCalled();
      expect(mocks.save).not.toHaveBeenCalled();
      expectNoRemoteWrites();
    },
  );

  it("reports CAS loss without a false success or fallback credential mutation", async () => {
    mocks.save.mockResolvedValue(false);
    expect(
      await MetadataProposalService.prepare(fixture.context, input),
    ).toMatchObject({ ok: false });
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.replaceConnection).not.toHaveBeenCalled();
    expect(mocks.disconnect).not.toHaveBeenCalled();
    expectNoRemoteWrites();
  });

  it("sanitizes provider failures and leaves saved data untouched", async () => {
    mocks.readFile.mockRejectedValue(
      new Error(`Secret provider detail ${publishingTestToken}`),
    );
    const result = await MetadataProposalService.prepare(
      fixture.context,
      input,
    );
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain(publishingTestToken);
    expect(result.message).not.toContain("Secret provider detail");
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.replaceConnection).not.toHaveBeenCalled();
    expect(mocks.disconnect).not.toHaveBeenCalled();
    expectNoRemoteWrites();
  });
});
