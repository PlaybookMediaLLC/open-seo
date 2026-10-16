import { GscService } from "@/server/features/gsc/services/GscService";
import { OpportunityRepository } from "@/server/features/opportunities/repositories/OpportunityRepository";
import { AppError } from "@/server/lib/errors";
import {
  prepareProposalInputSchema,
  type PrepareProposalInput,
  type MetadataProposal,
  type PublishingMutationResult,
  type PublishingOpportunityState,
} from "@/types/schemas/publishing";
import { gitBlobHash, proposalFingerprint } from "./proposalFingerprint";
import {
  authorizePublishing,
  connectedGithub,
  publishingFailure,
  withPublishingClaim,
  type PublishingContext,
} from "./publishingAccess";
import { PublishingConnectionService } from "./PublishingConnectionService";
import { prepareChangeAt, validateTarget } from "./publishingTarget";
import { PublishingRepository } from "./repositories/PublishingRepository";

async function get(
  context: PublishingContext,
  projectId: string,
  opportunityId: string,
): Promise<PublishingOpportunityState> {
  const state = await PublishingConnectionService.get(context, projectId);
  if (!(await OpportunityRepository.getDetail(projectId, opportunityId)))
    throw new AppError("NOT_FOUND");
  return {
    ...state,
    proposals: await PublishingRepository.listProposals(
      projectId,
      opportunityId,
    ),
  };
}

async function prepare(
  context: PublishingContext,
  raw: PrepareProposalInput,
): Promise<PublishingMutationResult> {
  await authorizePublishing(context, raw.projectId, true);
  const input = prepareProposalInputSchema.parse(raw);
  try {
    return await withPublishingClaim(
      context,
      input.projectId,
      async (claimToken, signal) => {
        const detail = await OpportunityRepository.getDetail(
          input.projectId,
          input.opportunityId,
        );
        if (!detail) throw new AppError("NOT_FOUND");
        const opportunity = detail.opportunity;
        const gsc = await GscService.getConnection(input.projectId);
        if (
          opportunity.status !== "approved" ||
          !detail.decisions.some(
            (decision) =>
              decision.decision === "approved" &&
              decision.evidenceRunId === opportunity.evidenceRunId,
          ) ||
          opportunity.version !== input.expectedOpportunityVersion ||
          gsc?.siteUrl !== opportunity.siteUrl ||
          Date.now() - Date.parse(opportunity.lastDetectedAt) > 14 * 86_400_000
        )
          throw new AppError("CONFLICT");
        const indexing =
          input.newCanonical !== undefined || input.newRobots !== undefined;
        // Canonical and robots changes can remove a page from Google.
        if (indexing && opportunity.type !== "technical_blocker")
          throw new AppError(
            "VALIDATION_ERROR",
            "Only technical blocker opportunities can change the canonical URL or robots.",
          );
        if (indexing && input.confirmPath !== new URL(opportunity.url).pathname)
          throw new AppError(
            "VALIDATION_ERROR",
            "Type the page path exactly to confirm a canonical or robots change.",
          );
        const connection = await PublishingRepository.getConnection(
          input.projectId,
        );
        if (!connection) throw new AppError("NOT_FOUND");
        validateTarget(
          input.filePath,
          opportunity.url,
          connection.rootDirectory,
        );
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
        const base = await client.getRef(connection.baseBranch);
        if (!base) throw new AppError("NOT_FOUND");
        const { adapterId, file, helper, patch } = await prepareChangeAt(
          client,
          connection,
          {
            filePath: input.filePath,
            url: opportunity.url,
            sha: base.sha,
            newDescription: input.newDescription,
            newTitle: input.newTitle,
            newCanonical: input.newCanonical,
            newRobots: input.newRobots,
          },
        );
        const changed = [
          patch.afterTitle !== null && "title",
          patch.afterDescription !== patch.beforeDescription && "description",
          patch.canonicalAfter !== null && "canonical URL",
          patch.robotsAfter !== null && "robots",
        ]
          .filter(Boolean)
          .join(" and ");
        const proposal: MetadataProposal = {
          id: crypto.randomUUID(),
          projectId: input.projectId,
          opportunityId: opportunity.id,
          connectionId: connection.id,
          evidenceRunId: opportunity.evidenceRunId,
          opportunityVersion: opportunity.version,
          targetUrl: opportunity.url,
          filePath: input.filePath,
          baseSha: base.sha,
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
          revertsProposalId: null,
          changeHash: "",
          reason: opportunity.explanation,
          expectedEffect:
            "A clearer search snippet may help relevant visitors choose this page. Search engines may rewrite titles and descriptions. Traffic, rankings and revenue are not guaranteed.",
          risk: `${patch.helperNote ? `${patch.helperNote} ` : ""}The supplied copy may be inaccurate or less compelling. Check every claim. Only the ${changed} literal${changed.includes(" and ") ? "s change" : " changes"}. Rewrites and custom routing are not verified. A pull request may trigger repository CI.`,
          verificationPlan: `Review the exact diff and product claims. Run the repository build and tests in CI, then verify the rendered page on the target URL after your authorized deployment.${
            indexing
              ? " Then run URL Inspection in Search Console and confirm the expected canonical URL and indexing state."
              : ""
          } Compare subsequent Search Console observations without assuming causation.`,
          validationSummary: `${patch.validationSummary} Next.js dependency verified in the selected package manifest. Full repository build, routing and CI were not run.`,
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
          }))
        )
          throw new AppError("CONFLICT");
        return {
          ok: true,
          message:
            "Static proposal prepared. Review the exact change before authorizing a pull request. Nothing was written to GitHub.",
          proposalId: proposal.id,
        };
      },
    );
  } catch (error) {
    return { ok: false, message: publishingFailure(error) };
  }
}

export const MetadataProposalService = { get, prepare };
