import { reviewAudit } from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { expect } from "vitest";
import { shiftGa4Date } from "@/server/features/ga4/services/Ga4Dates";
import { ExperimentRepository } from "./ExperimentRepository";
import { PublishingRepository } from "../../publishing/repositories/PublishingRepository";
import {
  attempt,
  fixture,
} from "../../publishing/repositories/publishingTestFixtures";
import type { createExperimentTestDatabase } from "./experimentTestDb";
import type {
  GrowthExperiment,
  MeasurementDay,
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
  // RFC-0009: register() writes this audit event with the experiment.
  const audit = { ...reviewAudit, action: "experiment.registered" } as const;
  return { ...input, executionId: begin.execution.id, audit };
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
    deploymentBasis: null,
    otherChanges: false,
    seasonalRisk: false,
    baselineStart: null,
    baselineEnd: null,
    observationStart: null,
    observationEnd: null,
    baselineRunId: null,
    ga4PropertyId: null,
    autoRefresh: true,
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
    ga4Error: null,
    window: "primary",
  };
}

type Input = Awaited<ReturnType<typeof succeededExecution>>;
export const mergedAt = new Date(Date.now() - 40 * 86_400_000).toISOString();
export const deployedAt = new Date(Date.now() - 39 * 86_400_000).toISOString();
export const windows = {
  baselineStart: "2026-08-01",
  baselineEnd: "2026-08-28",
  observationStart: "2026-09-05",
  observationEnd: "2026-10-02",
};

export async function registered(database: TestDatabase) {
  const input = await succeededExecution(database);
  const experiment = newExperiment(input);
  expect(await ExperimentRepository.register({ ...input, experiment })).toBe(
    true,
  );
  return { input, experiment };
}

export function scope(input: Input, experiment: GrowthExperiment) {
  return {
    projectId: input.projectId,
    experimentId: experiment.id,
    claimToken: input.claimToken,
    organizationId: input.organizationId,
  };
}

export function merged(
  input: Input,
  experiment: GrowthExperiment,
  sha = "merge",
) {
  return ExperimentRepository.recordPullStatus({
    ...scope(input, experiment),
    connectionId: input.connection.id,
    state: "merged",
    checkedAt: new Date().toISOString(),
    mergedAt,
    mergeCommitSha: sha,
  });
}

export function confirm(
  input: Input,
  experiment: GrowthExperiment,
  at = deployedAt,
) {
  return ExperimentRepository.confirmDeployment({
    ...scope(input, experiment),
    deployedAt: at,
    confirmedBy: "reviewer",
    note: "Verified live",
    basis: "human",
    confirmedAt: new Date().toISOString(),
    otherChanges: false,
    seasonalRisk: false,
    ...windows,
  });
}

export async function deployed(database: TestDatabase) {
  const { input, experiment } = await registered(database);
  expect(await merged(input, experiment)).toBe(true);
  expect(await confirm(input, experiment)).toBe(true);
  return { input, experiment };
}

export function days(run: MeasurementRun, period: MeasurementDay["period"]) {
  const start =
    period === "baseline" ? windows.baselineStart : windows.observationStart;
  return Array.from({ length: 28 }, (_, index) => ({
    id: crypto.randomUUID(),
    projectId: run.projectId,
    experimentId: run.experimentId,
    runId: run.id,
    period,
    date: shiftGa4Date(start, index),
    clicks: 5,
    impressions: 50,
    ctr: 0.1,
    position: 10,
  }));
}

export function completed(run: MeasurementRun): MeasurementRun {
  return {
    ...run,
    status: "completed",
    finishedAt: new Date().toISOString(),
    observationThrough: windows.observationEnd,
    windowComplete: true,
    outcome: "inconclusive",
    explanation: "Done",
  };
}

export async function status(
  database: TestDatabase,
  table: string,
  id: string,
) {
  return (
    await database.client.execute({
      sql: `SELECT status FROM ${table} WHERE id = ?`,
      args: [id],
    })
  ).rows[0]?.status;
}
