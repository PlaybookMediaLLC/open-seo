import {
  connectedGithub,
  type PublishingContext,
} from "@/server/features/publishing/publishingAccess";
import { gitBlobHash } from "@/server/features/publishing/proposalFingerprint";
import { PublishingRepository } from "@/server/features/publishing/repositories/PublishingRepository";
import { AppError } from "@/server/lib/errors";
import type {
  ExperimentDetail,
  GrowthExperiment,
} from "@/types/schemas/experiments";
import { ExperimentRepository } from "./repositories/ExperimentRepository";

export async function refreshPullStatus(
  context: PublishingContext,
  detail: ExperimentDetail,
  claimToken: string,
  signal: AbortSignal,
): Promise<GrowthExperiment> {
  const { experiment, publishing } = detail;
  const execution = publishing.executions.find(
    (row) => row.id === experiment.executionId,
  );
  const connection = await PublishingRepository.getConnection(
    experiment.projectId,
  );
  if (
    !execution ||
    execution.status !== "succeeded" ||
    !execution.pullRequestNumber ||
    !execution.commitSha ||
    !connection ||
    connection.repositoryId !== publishing.connection.repositoryId ||
    connection.baseBranch !== publishing.connection.baseBranch
  )
    throw new AppError("CONFLICT");
  const client = await connectedGithub(connection, signal, {
    metadata: "read",
    contents: "read",
    pull_requests: "read",
  });
  const repository = await client.getRepository();
  if (repository.id !== connection.repositoryId) throw new AppError("CONFLICT");
  const pull = await client.getPullRequest(execution.pullRequestNumber);
  if (
    pull.repositoryId !== repository.id ||
    pull.headSha !== execution.commitSha ||
    pull.headRef !== execution.branchName ||
    pull.baseRef !== publishing.connection.baseBranch ||
    pull.number !== execution.pullRequestNumber
  )
    throw new AppError("CONFLICT");
  if (pull.merged) {
    if (
      !pull.mergedAt ||
      !pull.mergeCommitSha ||
      pull.state !== "closed" ||
      Date.parse(pull.mergedAt) > Date.now()
    )
      throw new AppError("CONFLICT");
    const mergedFile = await client.readFile(
      publishing.proposal.filePath,
      pull.mergeCommitSha,
    );
    if (
      mergedFile.blobSha !== publishing.proposal.afterBlobSha ||
      (await gitBlobHash(mergedFile.source)) !==
        publishing.proposal.afterBlobSha
    )
      throw new AppError("CONFLICT");
  }
  const checkedAt = new Date().toISOString();
  const updated: GrowthExperiment = {
    ...experiment,
    pullRequestState: pull.merged ? "merged" : pull.state,
    pullRequestCheckedAt: checkedAt,
    mergedAt:
      pull.merged && pull.mergedAt
        ? new Date(pull.mergedAt).toISOString()
        : null,
    mergeCommitSha: pull.merged ? pull.mergeCommitSha : null,
  };
  signal.throwIfAborted();
  if (
    !(await ExperimentRepository.recordPullStatus({
      projectId: experiment.projectId,
      experimentId: experiment.id,
      claimToken,
      organizationId: context.organizationId,
      connectionId: connection.id,
      state: updated.pullRequestState,
      checkedAt,
      mergedAt: updated.mergedAt,
      mergeCommitSha: updated.mergeCommitSha,
    }))
  )
    throw new AppError("CONFLICT");
  return updated;
}
