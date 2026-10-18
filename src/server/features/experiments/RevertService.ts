import { OpportunityRepository } from "@/server/features/opportunities/repositories/OpportunityRepository";
import {
  gitBlobHash,
  proposalFingerprint,
} from "@/server/features/publishing/proposalFingerprint";
import {
  authorizePublishing,
  connectedGithub,
  publishingFailure,
  withPublishingClaim,
  type PublishingContext,
} from "@/server/features/publishing/publishingAccess";
import { parseRobotsText } from "@/server/features/publishing/indexingMetadata";
import { prepareChangeAt } from "@/server/features/publishing/publishingTarget";
import { PublishingRepository } from "@/server/features/publishing/repositories/PublishingRepository";
import { AppError } from "@/server/lib/errors";
import {
  experimentInputSchema,
  type ExperimentInput,
} from "@/types/schemas/experiments";
import {
  confirmRevertInputSchema,
  type ConfirmRevertInput,
  type MetadataProposal,
  type PublishingMutationResult,
} from "@/types/schemas/publishing";
import { ExperimentRepository } from "./repositories/ExperimentRepository";

const PAGE_CHANGED =
  "The page changed after this proposal. Prepare a new proposal instead.";

// Prepares the exact inverse of a merged change as a new proposal. It uses the
// same exact-change approval and execution path (RFC-0005 5.6).
async function prepare(
  context: PublishingContext,
  raw: ExperimentInput,
): Promise<PublishingMutationResult> {
  await authorizePublishing(context, raw.projectId, true);
  const input = experimentInputSchema.parse(raw);
  try {
    return await withPublishingClaim(
      context,
      input.projectId,
      async (claimToken, signal) => {
        const detail = await ExperimentRepository.get(
          input.projectId,
          input.experimentId,
        );
        if (!detail) throw new AppError("NOT_FOUND");
        const original = detail.publishing.proposal;
        if (
          detail.experiment.pullRequestState !== "merged" ||
          original.revertsProposalId
        )
          return {
            ok: false,
            message:
              "Only a merged change can be reverted. Refresh the pull request status first.",
          };
        const opportunity = (
          await OpportunityRepository.getDetail(
            input.projectId,
            original.opportunityId,
          )
        )?.opportunity;
        if (!opportunity) throw new AppError("NOT_FOUND");
        if (!["in_progress", "implemented"].includes(opportunity.status))
          return {
            ok: false,
            message: "This opportunity is not in a state that can be reverted.",
          };
        const connection = await PublishingRepository.getConnection(
          input.projectId,
        );
        if (
          !connection ||
          connection.repositoryId !== detail.publishing.connection.repositoryId
        )
          throw new AppError("CONFLICT");
        const client = await connectedGithub(connection, signal, {
          metadata: "read",
          contents: "read",
        });
        const repository = await client.getRepository();
        if (
          repository.id !== connection.repositoryId ||
          repository.archived ||
          !repository.canPush
        )
          throw new AppError("CONFLICT");
        const head = await client.getRef(connection.baseBranch);
        if (!head) throw new AppError("NOT_FOUND");
        const descriptionChanged =
          original.descriptionAfter !== original.descriptionBefore;
        const titleChanged = original.titleAfter !== null;
        // Read the file as it is now, at the head of the base branch.
        let change: Awaited<ReturnType<typeof prepareChangeAt>>;
        try {
          change = await prepareChangeAt(client, connection, {
            filePath: original.filePath,
            url: original.targetUrl,
            sha: head.sha,
            newDescription: descriptionChanged
              ? original.descriptionBefore
              : undefined,
            newTitle: titleChanged
              ? (original.titleBefore ?? undefined)
              : undefined,
            newCanonical:
              original.canonicalAfter === null
                ? undefined
                : (original.canonicalBefore ?? undefined),
            newRobots: original.robotsBefore
              ? parseRobotsText(original.robotsBefore)
              : undefined,
            restore: true,
          });
        } catch (error) {
          if (error instanceof AppError && error.code === "VALIDATION_ERROR")
            return { ok: false, message: PAGE_CHANGED };
          throw error;
        }
        const { adapterId, file, helper, patch } = change;
        // The page must still show what the original proposal shipped.
        if (
          (descriptionChanged &&
            patch.beforeDescription !== original.descriptionAfter) ||
          (titleChanged && patch.beforeTitle !== original.titleAfter) ||
          patch.canonicalBefore !== original.canonicalAfter ||
          patch.robotsBefore !== original.robotsAfter
        )
          return { ok: false, message: PAGE_CHANGED };
        const outcome = detail.latestRun
          ? ` Result: ${detail.latestRun.outcome}. ${detail.latestRun.explanation}`
          : "";
        const proposal: MetadataProposal = {
          id: crypto.randomUUID(),
          projectId: input.projectId,
          opportunityId: original.opportunityId,
          connectionId: connection.id,
          evidenceRunId: opportunity.evidenceRunId,
          opportunityVersion: opportunity.version,
          targetUrl: original.targetUrl,
          filePath: original.filePath,
          baseSha: head.sha,
          beforeBlobSha: file.blobSha,
          afterBlobSha: await gitBlobHash(patch.afterSource),
          descriptionBefore: patch.beforeDescription,
          descriptionAfter: patch.afterDescription,
          beforeSnippet: patch.beforeSnippet,
          afterSnippet: patch.afterSnippet,
          metadataSource: helper ? "helper_call" : "literal_object",
          helperPath: helper?.path ?? null,
          helperBlobSha: helper?.blobSha ?? null,
          titleBefore: patch.beforeTitle,
          titleAfter: patch.afterTitle,
          titleBeforeSnippet: patch.titleBeforeSnippet,
          titleAfterSnippet: patch.titleAfterSnippet,
          canonicalBefore: patch.canonicalBefore,
          canonicalAfter: patch.canonicalAfter,
          canonicalBeforeSnippet: patch.canonicalBeforeSnippet,
          canonicalAfterSnippet: patch.canonicalAfterSnippet,
          robotsBefore: patch.robotsBefore,
          robotsAfter: patch.robotsAfter,
          robotsBeforeSnippet: patch.robotsBeforeSnippet,
          robotsAfterSnippet: patch.robotsAfterSnippet,
          adapterId,
          fingerprintVersion: 5,
          revertsProposalId: original.id,
          draftId: null,
          changeHash: "",
          reason: `Revert of the change from proposal ${original.id}.${outcome}`,
          expectedEffect:
            "Restores the earlier text. Search engines may take weeks to show it again.",
          risk: `${patch.helperNote ? `${patch.helperNote} ` : ""}Only the reverted literals change, back to their earlier values. A pull request may trigger repository CI.`,
          verificationPlan:
            "Check that the diff is the exact inverse of the original change. Run the repository checks. After the merge and the deployment, confirm the revert on this proposal.",
          validationSummary: `${patch.validationSummary} The page still showed the text that the original proposal shipped.`,
          createdBy: context.userId,
          createdAt: new Date().toISOString(),
        };
        proposal.changeHash = await proposalFingerprint(proposal);
        signal.throwIfAborted();
        if (
          !(await PublishingRepository.saveProposal({
            proposal,
            claimToken,
            organizationId: context.organizationId,
            audit: {
              organizationId: context.organizationId,
              projectId: proposal.projectId,
              actor: context,
              action: "proposal.revert_prepared",
              targetType: "proposal",
              targetId: proposal.id,
              summary: `Prepared a revert for ${proposal.targetUrl}`,
            },
          }))
        )
          throw new AppError("CONFLICT");
        return {
          ok: true,
          message:
            "Revert proposal prepared. Review and approve it on the opportunity page. Nothing was written to GitHub.",
          proposalId: proposal.id,
        };
      },
    );
  } catch (error) {
    return { ok: false, message: publishingFailure(error) };
  }
}

// After the revert pull request merges and ships, the opportunity becomes
// "reverted". GitHub must show the merge with the exact reverted file.
async function confirmDeployed(
  context: PublishingContext,
  raw: ConfirmRevertInput,
): Promise<PublishingMutationResult> {
  await authorizePublishing(context, raw.projectId, true);
  const input = confirmRevertInputSchema.parse(raw);
  const deployedAt = new Date(input.deployedAt).toISOString();
  try {
    return await withPublishingClaim(
      context,
      input.projectId,
      async (claimToken, signal) => {
        const history = await PublishingRepository.getProposal(
          input.projectId,
          input.proposalId,
        );
        const execution = history?.executions.find(
          (row) => row.status === "succeeded",
        );
        if (
          !history?.proposal.revertsProposalId ||
          !execution?.pullRequestNumber ||
          !execution.commitSha
        )
          throw new AppError("NOT_FOUND");
        const { proposal } = history;
        const connection = await PublishingRepository.getConnection(
          input.projectId,
        );
        if (
          !connection ||
          connection.repositoryId !== history.connection.repositoryId
        )
          throw new AppError("CONFLICT");
        const client = await connectedGithub(connection, signal, {
          metadata: "read",
          contents: "read",
          pull_requests: "read",
        });
        const pull = await client.getPullRequest(execution.pullRequestNumber);
        if (
          pull.repositoryId !== connection.repositoryId ||
          pull.headSha !== execution.commitSha ||
          !pull.merged ||
          !pull.mergedAt ||
          !pull.mergeCommitSha
        )
          return {
            ok: false,
            message: "GitHub does not show the revert pull request as merged.",
          };
        const merged = await client.readFile(
          proposal.filePath,
          pull.mergeCommitSha,
        );
        if (merged.blobSha !== proposal.afterBlobSha)
          throw new AppError("CONFLICT");
        const age = Date.now() - Date.parse(deployedAt);
        if (
          age < 0 ||
          age > 90 * 86_400_000 ||
          deployedAt < new Date(pull.mergedAt).toISOString()
        )
          return {
            ok: false,
            message:
              "Use the actual production deployment time, after the merge and within the past 90 days.",
          };
        const opportunity = (
          await OpportunityRepository.getDetail(
            input.projectId,
            proposal.opportunityId,
          )
        )?.opportunity;
        if (
          !opportunity ||
          !["in_progress", "implemented"].includes(opportunity.status)
        )
          throw new AppError("CONFLICT");
        if (
          !(await PublishingRepository.markReverted({
            projectId: input.projectId,
            claimToken,
            organizationId: context.organizationId,
            opportunityId: opportunity.id,
            revertProposalId: proposal.id,
            expectedVersion: opportunity.version,
            fromStatus: opportunity.status,
            actorUserId: context.userId,
            note: `Revert deployed at ${deployedAt}. ${input.note}`,
          }))
        )
          throw new AppError("CONFLICT");
        return {
          ok: true,
          message: "The revert is recorded. The opportunity is now reverted.",
        };
      },
    );
  } catch (error) {
    return { ok: false, message: publishingFailure(error) };
  }
}

export const RevertService = { prepare, confirmDeployed };
