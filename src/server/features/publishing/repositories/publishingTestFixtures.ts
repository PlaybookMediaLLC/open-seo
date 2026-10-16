import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  dataRefreshClaims,
  opportunities,
  opportunityRuns,
  opportunityDecisions,
} from "@/db/schema";
import type {
  MetadataProposal,
  ProposalApproval,
  ProposalExecution,
  PublishingConnectionRecord,
} from "@/types/schemas/publishing";
import { opportunityRun } from "../../opportunities/services/opportunityTestFixtures";
import type { createPublishingTestDatabase } from "./publishingTestDb";
import { PublishingRepository as repo } from "./PublishingRepository";

type TestDatabase = ReturnType<typeof createPublishingTestDatabase>;

export async function fixture(database: TestDatabase) {
  const { client } = database;
  const projectId = crypto.randomUUID();
  const claimToken = crypto.randomUUID();
  const now = new Date().toISOString();
  const scope = { projectId, claimToken, organizationId: projectId };
  await client.execute({
    sql: "INSERT INTO organization (id, name, slug, created_at) VALUES (?, 'test', ?, CURRENT_TIMESTAMP)",
    args: [projectId, `${database.slugPrefix}${projectId}`],
  });
  await client.execute({
    sql: "INSERT INTO projects (id, organization_id, name) VALUES (?, ?, 'test')",
    args: [projectId, projectId],
  });
  await client.execute({
    sql: "INSERT INTO gsc_connections (id, project_id, site_url, organization_id, connected_by_user_id) VALUES (?, ?, 'sc-domain:example.com', ?, 'test')",
    args: [projectId, projectId, projectId],
  });
  await db.insert(dataRefreshClaims).values({
    key: `publishing:${projectId}`,
    organizationId: projectId,
    token: claimToken,
    nextAttemptAt: Date.now() + 180_000,
  });
  const run = opportunityRun({
    id: crypto.randomUUID(),
    projectId,
    siteUrl: "sc-domain:example.com",
  });
  await db.insert(opportunityRuns).values(run);
  const opportunityId = crypto.randomUUID();
  await db.insert(opportunities).values({
    id: opportunityId,
    projectId,
    siteUrl: run.siteUrl,
    identityKey: opportunityId,
    type: "striking_distance",
    url: "https://example.com/page",
    query: null,
    title: "Improve page",
    explanation: "Low CTR",
    recommendedAction: "Review metadata",
    searchIntent: "commercial",
    confidence: 0.8,
    effortHours: 1,
    priority: 70,
    commercialScore: 70,
    demandScore: 70,
    visibilityScore: 70,
    difficultyScore: 70,
    effortScore: 70,
    scoreExplanation: "High impressions",
    uncertainty: "No conversions",
    status: "approved",
    ownerUserId: "reviewer",
    evidenceRunId: run.id,
    firstDetectedAt: now,
    lastDetectedAt: now,
    version: 2,
  });
  await db.insert(opportunityDecisions).values({
    id: crypto.randomUUID(),
    projectId,
    opportunityId,
    evidenceRunId: run.id,
    actorUserId: "reviewer",
    decision: "approved",
    fromStatus: "discovered",
    toStatus: "approved",
    note: "Reviewed evidence",
    createdAt: now,
  });
  const connection: PublishingConnectionRecord = {
    id: crypto.randomUUID(),
    projectId,
    repositoryId: "123",
    owner: "owner",
    repository: "site",
    baseBranch: "main",
    rootDirectory: "",
    productionEnvironment: "Production",
    encryptedToken: "encrypted-secret",
    createdBy: "reviewer",
    createdAt: now,
    revokedAt: null,
  };
  const proposal: MetadataProposal = {
    id: crypto.randomUUID(),
    projectId,
    opportunityId,
    connectionId: connection.id,
    evidenceRunId: run.id,
    opportunityVersion: 2,
    targetUrl: "https://example.com/page",
    filePath: "app/page.tsx",
    baseSha: "base",
    beforeBlobSha: "before",
    afterBlobSha: "after",
    descriptionBefore: "Old description",
    descriptionAfter: "New description",
    beforeSnippet: "old",
    afterSnippet: "new",
    metadataSource: "literal_object",
    helperPath: null,
    helperBlobSha: null,
    titleBefore: null,
    titleAfter: null,
    titleBeforeSnippet: null,
    titleAfterSnippet: null,
    revertsProposalId: null,
    fingerprintVersion: 1,
    changeHash: "a".repeat(64),
    reason: "Low CTR",
    expectedEffect: "Clearer snippet",
    risk: "Low",
    verificationPlan: "Review diff",
    validationSummary: "Passed",
    createdBy: "reviewer",
    createdAt: now,
  };
  if (!(await repo.replaceConnection({ ...scope, connection })))
    throw new Error("Fixture connection rejected");
  return { ...scope, connection, proposal, siteUrl: run.siteUrl };
}

export function attempt(input: Awaited<ReturnType<typeof fixture>>) {
  const { projectId, proposal, claimToken } = input;
  const approval: ProposalApproval = {
    id: crypto.randomUUID(),
    projectId,
    proposalId: proposal.id,
    actorUserId: "reviewer",
    changeHash: proposal.changeHash,
    note: "Approved",
    createdAt: new Date().toISOString(),
  };
  const execution: ProposalExecution = {
    id: claimToken,
    projectId,
    proposalId: proposal.id,
    approvalId: approval.id,
    status: "running",
    phase: "validating",
    branchName: `openseo/${proposal.id}`,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    requestCount: 0,
    commitSha: null,
    pullRequestNumber: null,
    pullRequestUrl: null,
    error: null,
  };
  return {
    execution,
    approval,
    organizationId: input.organizationId,
    siteUrl: input.siteUrl,
  };
}

export async function nextClaim<T extends Awaited<ReturnType<typeof fixture>>>(
  input: T,
) {
  const claimToken = crypto.randomUUID();
  await db
    .update(dataRefreshClaims)
    .set({ token: claimToken, nextAttemptAt: Date.now() + 180_000 })
    .where(eq(dataRefreshClaims.key, `publishing:${input.projectId}`));
  return { ...input, claimToken };
}
