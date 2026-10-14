import { OpportunityRepository } from "@/server/features/opportunities/repositories/OpportunityRepository";
import { AppError } from "@/server/lib/errors";
import {
  recoverPublishingInputSchema,
  type RecoverPublishingInput,
  type PublishingMutationResult,
} from "@/types/schemas/publishing";
import {
  authorizePublishing,
  connectedGithub,
  publishingFailure,
  withPublishingClaim,
  type PublishingContext,
} from "./publishingAccess";
import { PublishingRepository } from "./repositories/PublishingRepository";

async function recover(
  context: PublishingContext,
  raw: RecoverPublishingInput,
): Promise<PublishingMutationResult> {
  await authorizePublishing(context, raw.projectId, true);
  const input = recoverPublishingInputSchema.parse(raw);
  try {
    return await withPublishingClaim(
      context,
      input.projectId,
      async (claimToken, signal) => {
        const detail = await OpportunityRepository.getDetail(
          input.projectId,
          input.opportunityId,
        );
        if (
          !detail ||
          detail.opportunity.status !== "failed" ||
          detail.opportunity.version !== input.expectedVersion
        )
          throw new AppError("CONFLICT");
        const history = await PublishingRepository.getLatestExecution(
          input.projectId,
          input.opportunityId,
        );
        const execution = history?.executions[0];
        if (!history || !execution || execution.status !== "failed")
          throw new AppError("CONFLICT");
        const connection = await PublishingRepository.getConnection(
          input.projectId,
        );
        if (
          !connection ||
          connection.repositoryId !== history.connection.repositoryId ||
          connection.owner.toLowerCase() !==
            history.connection.owner.toLowerCase() ||
          connection.repository.toLowerCase() !==
            history.connection.repository.toLowerCase() ||
          connection.baseBranch !== history.connection.baseBranch
        ) {
          return {
            ok: false,
            message:
              "Reconnect the failed attempt's original repository and base branch before recovery. Its remote work must be checked before preparing a replacement.",
          };
        }
        const client = await connectedGithub(connection, signal);
        if ((await client.getRepository()).id !== connection.repositoryId)
          throw new AppError("CONFLICT");
        const pull = await client.findPullRequest({
          headBranch: execution.branchName,
          baseBranch: connection.baseBranch,
        });
        if (pull && (pull.state === "open" || pull.merged)) {
          return {
            ok: false,
            message:
              "The failed attempt already has an open or merged pull request. Retry the exact proposal to reconcile its history. If abandoning an unmerged change, close its pull request in GitHub before re-reviewing.",
          };
        }
        signal.throwIfAborted();
        const saved = await PublishingRepository.recoverOpportunity({
          projectId: input.projectId,
          opportunityId: input.opportunityId,
          expectedVersion: input.expectedVersion,
          executionId: execution.id,
          actorUserId: context.userId,
          organizationId: context.organizationId,
          claimToken,
        });
        if (!saved) throw new AppError("CONFLICT");
        return {
          ok: true,
          message:
            "Failed attempt re-reviewed after checking GitHub. Approve the current evidence again, then prepare a fresh proposal. History is preserved, and any old proposal branch remains unchanged.",
        };
      },
    );
  } catch (error) {
    return { ok: false, message: publishingFailure(error) };
  }
}

export const PublishingRecoveryService = { recover };
