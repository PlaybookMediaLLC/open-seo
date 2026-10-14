import { PublishingRepository } from "../../publishing/repositories/PublishingRepository";
import {
  attempt,
  fixture,
} from "../../publishing/repositories/publishingTestFixtures";
import type { createExperimentTestDatabase } from "./experimentTestDb";
import type {
  GrowthExperiment,
  MeasurementRun,
} from "@/types/schemas/experiments";

type TestDatabase = ReturnType<typeof createExperimentTestDatabase>;

// A project whose approved proposal already produced a succeeded pull request.
export async function succeededExecution(database: TestDatabase) {
  const input = await fixture(database);
  if (!(await PublishingRepository.saveProposal(input)))
    throw new Error("Fixture proposal rejected");
  const begin = attempt(input);
  if (!(await PublishingRepository.beginExecution(begin)))
    throw new Error("Fixture execution rejected");
  const progress = {
    projectId: input.projectId,
    executionId: begin.execution.id,
    organizationId: input.organizationId,
    requestCount: 3,
    message: "Checkpoint",
  };
  await PublishingRepository.checkpoint({
    ...progress,
    phase: "file_committed",
    commitSha: "commit",
  });
  if (
    !(await PublishingRepository.checkpoint({
      ...progress,
      phase: "pull_request_created",
      pullRequestNumber: 42,
      pullRequestUrl: "https://github.com/owner/site/pull/42",
    }))
  )
    throw new Error("Fixture pull request rejected");
  return { ...input, executionId: begin.execution.id };
}

export function newExperiment(
  input: Awaited<ReturnType<typeof succeededExecution>>,
): GrowthExperiment {
  return {
    id: crypto.randomUUID(),
    projectId: input.projectId,
    opportunityId: input.proposal.opportunityId,
    proposalId: input.proposal.id,
    executionId: input.executionId,
    siteUrl: input.siteUrl,
    targetUrl: input.proposal.targetUrl,
    createdBy: "reviewer",
    createdAt: new Date().toISOString(),
    pullRequestState: "unknown",
    pullRequestCheckedAt: null,
    mergedAt: null,
    mergeCommitSha: null,
    deployedAt: null,
    deploymentConfirmedBy: null,
    deploymentNote: null,
    deploymentConfirmedAt: null,
    otherChanges: false,
    seasonalRisk: false,
    baselineStart: null,
    baselineEnd: null,
    observationStart: null,
    observationEnd: null,
    baselineRunId: null,
  };
}

export function runningMeasurement(
  experiment: GrowthExperiment,
  claimToken: string,
  includesBaseline = true,
): MeasurementRun {
  return {
    id: claimToken,
    projectId: experiment.projectId,
    experimentId: experiment.id,
    status: "running",
    requestedBy: "reviewer",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    requestCount: 1,
    includesBaseline,
    observationThrough: null,
    outcome: "inconclusive",
    explanation: "Measurement has not completed.",
    overlappingChanges: false,
    windowComplete: false,
    error: null,
  };
}
