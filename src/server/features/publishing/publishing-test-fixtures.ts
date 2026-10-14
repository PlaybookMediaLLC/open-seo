import { symmetricEncrypt } from "better-auth/crypto";
import type {
  ExecuteProposalInput,
  MetadataProposal,
  PublishingConnectionRecord,
} from "@/types/schemas/publishing";
import { opportunityDetail } from "../opportunities/services/opportunityTestFixtures";
import type { GithubRepository, GithubPullRequest } from "./githubClient";
import { prepareMetadataDescription } from "./nextMetadata";
import { gitBlobHash, proposalFingerprint } from "./proposalFingerprint";

export const publishingTestSecret =
  "publishing-test-encryption-secret-at-least-32-characters";
export const publishingTestToken =
  "github_pat_test_token_for_publishing_only_123456789";

export async function makePublishingFixture() {
  const context = { organizationId: "org-1", userId: "user-1", role: "owner" };
  const detail = opportunityDetail("approved");
  detail.decisions.push({
    id: "decision-1",
    opportunityId: detail.opportunity.id,
    evidenceRunId: detail.opportunity.evidenceRunId,
    actorUserId: context.userId,
    decision: "approved",
    fromStatus: "reviewed",
    toStatus: "approved",
    note: "",
    createdAt: new Date().toISOString(),
  });
  const source =
    "export const metadata = { description: 'Old pricing description' };\n";
  const filePath = "app/pricing/page.tsx";
  const patch = prepareMetadataDescription({
    source,
    path: filePath,
    url: detail.opportunity.url,
    newDescription: "Explore our pricing and choose a plan.",
  });
  const connection: PublishingConnectionRecord = {
    id: "connection-1",
    projectId: detail.opportunity.projectId,
    repositoryId: "123",
    owner: "example",
    repository: "website",
    baseBranch: "main",
    rootDirectory: "",
    encryptedToken: await symmetricEncrypt({
      key: publishingTestSecret,
      data: publishingTestToken,
    }),
    createdBy: context.userId,
    createdAt: new Date().toISOString(),
    revokedAt: null,
  };
  const proposal: MetadataProposal = {
    id: "proposal-1",
    projectId: connection.projectId,
    opportunityId: detail.opportunity.id,
    connectionId: connection.id,
    evidenceRunId: detail.opportunity.evidenceRunId,
    opportunityVersion: detail.opportunity.version,
    targetUrl: detail.opportunity.url,
    filePath,
    baseSha: "a".repeat(40),
    beforeBlobSha: await gitBlobHash(source),
    afterBlobSha: await gitBlobHash(patch.afterSource),
    descriptionBefore: patch.beforeDescription,
    descriptionAfter: patch.afterDescription,
    beforeSnippet: patch.beforeSnippet,
    afterSnippet: patch.afterSnippet,
    changeHash: "",
    reason: detail.opportunity.explanation,
    expectedEffect: "Clearer search snippet, without guaranteed results.",
    risk: "Copy requires human review.",
    verificationPlan: "Review diff and run CI.",
    validationSummary: patch.validationSummary,
    createdBy: context.userId,
    createdAt: new Date().toISOString(),
  };
  proposal.changeHash = await proposalFingerprint(proposal);
  const repository: GithubRepository = {
    id: connection.repositoryId,
    fullName: `${connection.owner}/${connection.repository}`,
    defaultBranch: connection.baseBranch,
    private: true,
    canPush: true,
    archived: false,
  };
  const pullRequest: GithubPullRequest = {
    number: 7,
    url: `https://github.com/${connection.owner}/${connection.repository}/pull/7`,
    state: "open",
    merged: false,
    mergedAt: null,
    mergeCommitSha: null,
    headSha: "b".repeat(40),
    body: `<!-- OpenSEO proposal:${proposal.id} change:${proposal.changeHash} -->`,
    baseRef: connection.baseBranch,
    headRef: `growth/${proposal.id}`,
    repositoryId: connection.repositoryId,
  };
  const executeInput: ExecuteProposalInput = {
    projectId: proposal.projectId,
    proposalId: proposal.id,
    changeHash: proposal.changeHash,
    authorizePullRequest: true,
    note: "I reviewed this exact description.",
  };
  return {
    repository,
    pullRequest,
    executeInput,
    context,
    connection,
    proposal,
    source,
    afterSource: patch.afterSource,
    detail,
  };
}
