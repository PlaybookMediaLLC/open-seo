import { GscService } from "@/server/features/gsc/services/GscService";
import { OpportunityRepository } from "@/server/features/opportunities/repositories/OpportunityRepository";
import { AppError } from "@/server/lib/errors";
import {
  executeProposalInputSchema,
  type ExecuteProposalInput,
  type ExecutionPhase,
  type ProposalExecution,
  type PublishingMutationResult,
} from "@/types/schemas/publishing";
import { prepareMetadataDescription } from "./nextMetadata";
import { gitBlobHash, proposalFingerprint } from "./proposalFingerprint";
import {
  authorizePublishing,
  connectedGithub,
  publishingFailure,
  withPublishingClaim,
  type PublishingContext,
} from "./publishingAccess";
import { publishProposal } from "./publishProposal";
import { PublishingRepository } from "./repositories/PublishingRepository";

async function execute(
  context: PublishingContext,
  raw: ExecuteProposalInput,
): Promise<PublishingMutationResult> {
  await authorizePublishing(context, raw.projectId, true);
  const input = executeProposalInputSchema.parse(raw);
  try {
    return await withPublishingClaim(
      context,
      input.projectId,
      async (claimToken, signal) => {
        const history = await PublishingRepository.getProposal(
          input.projectId,
          input.proposalId,
        );
        if (!history) throw new AppError("NOT_FOUND");
        const { proposal } = history;
        if (
          input.changeHash !== proposal.changeHash ||
          (await proposalFingerprint(proposal)) !== proposal.changeHash
        )
          throw new AppError("CONFLICT");
        const succeeded = history.executions.find(
          (execution) => execution.status === "succeeded",
        );
        if (succeeded)
          return {
            ok: true,
            message:
              "This proposal already has a recorded pull request. No GitHub request was made.",
            executionId: succeeded.id,
          };
        const connection = await PublishingRepository.getConnectionById(
          input.projectId,
          proposal.connectionId,
        );
        if (!connection || connection.revokedAt || !connection.encryptedToken)
          throw new AppError("CONFLICT");
        const detail = await OpportunityRepository.getDetail(
          input.projectId,
          proposal.opportunityId,
        );
        const gsc = await GscService.getConnection(input.projectId);
        if (
          !detail ||
          gsc?.siteUrl !== detail.opportunity.siteUrl ||
          detail.opportunity.evidenceRunId !== proposal.evidenceRunId ||
          Date.now() - Date.parse(detail.opportunity.lastDetectedAt) >
            14 * 86_400_000
        )
          throw new AppError("CONFLICT");
        const client = await connectedGithub(connection, signal);
        const now = new Date().toISOString();
        const execution: ProposalExecution = {
          id: claimToken,
          projectId: input.projectId,
          proposalId: proposal.id,
          approvalId: crypto.randomUUID(),
          status: "running",
          phase: "validating",
          branchName: `growth/${proposal.id}`,
          startedAt: now,
          finishedAt: null,
          requestCount: 0,
          commitSha: null,
          pullRequestNumber: null,
          pullRequestUrl: null,
          error: null,
        };
        const started = await PublishingRepository.beginExecution({
          execution,
          organizationId: context.organizationId,
          siteUrl: gsc.siteUrl,
          approval: {
            id: execution.approvalId,
            projectId: input.projectId,
            proposalId: proposal.id,
            actorUserId: context.userId,
            changeHash: input.changeHash,
            note: input.note,
            createdAt: now,
          },
        });
        if (!started) throw new AppError("CONFLICT");
        const checkpoint = async (
          phase: ExecutionPhase,
          message: string,
          values: {
            commitSha?: string;
            pullRequestNumber?: number;
            pullRequestUrl?: string;
          } = {},
        ) => {
          signal.throwIfAborted();
          if (
            !(await PublishingRepository.checkpoint({
              projectId: input.projectId,
              executionId: execution.id,
              organizationId: context.organizationId,
              phase,
              requestCount: client.requestCount,
              message,
              ...values,
            }))
          )
            throw new AppError("CONFLICT");
        };
        try {
          const repository = await client.getRepository();
          if (
            repository.id !== connection.repositoryId ||
            repository.archived ||
            !repository.canPush
          )
            throw new AppError("CONFLICT");
          const before = await client.readFile(
            proposal.filePath,
            proposal.baseSha,
          );
          if (
            before.blobSha !== proposal.beforeBlobSha ||
            (await gitBlobHash(before.source)) !== proposal.beforeBlobSha
          )
            throw new AppError("CONFLICT");
          const patch = prepareMetadataDescription({
            source: before.source,
            path: proposal.filePath,
            url: proposal.targetUrl,
            newDescription: proposal.descriptionAfter,
            rootDirectory: connection.rootDirectory,
          });
          if (
            patch.beforeDescription !== proposal.descriptionBefore ||
            patch.beforeSnippet !== proposal.beforeSnippet ||
            patch.afterSnippet !== proposal.afterSnippet ||
            (await gitBlobHash(patch.afterSource)) !== proposal.afterBlobSha
          )
            throw new AppError("CONFLICT");
          await publishProposal(
            client,
            proposal,
            connection,
            patch.afterSource,
            checkpoint,
          );
          return {
            ok: true,
            message:
              "The exact-change pull request is recorded. Review and merge it in GitHub when ready. No auto-merge or deployment was requested.",
            executionId: execution.id,
          };
        } catch (error) {
          const message = publishingFailure(error);
          // Persist sanitized failure even after provider cancellation, but never
          // overwrite a successful result or a successor's claim.
          await PublishingRepository.checkpoint({
            projectId: input.projectId,
            executionId: execution.id,
            organizationId: context.organizationId,
            phase: "failed",
            requestCount: client.requestCount,
            message,
          }).catch(() => false);
          return { ok: false, message, executionId: execution.id };
        }
      },
    );
  } catch (error) {
    return { ok: false, message: publishingFailure(error) };
  }
}

export const MetadataExecutionService = { execute };
