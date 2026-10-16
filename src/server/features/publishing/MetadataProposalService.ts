import { z } from "zod";
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
import type { GithubClient } from "./githubClient";
import { metadataHelperCandidates } from "./metadataHelper";
import { readTitleTemplate } from "./layoutTitle";
import {
  metadataHelperImport,
  prepareMetadataChange,
  validateMetadataTarget,
} from "./nextMetadata";
import { gitBlobHash, proposalFingerprint } from "./proposalFingerprint";
import {
  authorizePublishing,
  connectedGithub,
  publishingFailure,
  withPublishingClaim,
  type PublishingContext,
} from "./publishingAccess";
import { PublishingConnectionService } from "./PublishingConnectionService";
import { PublishingRepository } from "./repositories/PublishingRepository";

const manifestSchema = z.object({
  dependencies: z.record(z.string(), z.unknown()).optional(),
  devDependencies: z.record(z.string(), z.unknown()).optional(),
});

function verifyNextManifest(source: string) {
  let version: unknown;
  try {
    const manifest = manifestSchema.parse(JSON.parse(source));
    version = manifest.dependencies?.next ?? manifest.devDependencies?.next;
  } catch {
    throw new AppError("VALIDATION_ERROR");
  }
  const parts =
    typeof version === "string"
      ? /^[~^]?(\d+)\.(\d+)\.\d+(?:-[a-zA-Z0-9.-]+)?$/.exec(version)
      : null;
  if (
    !parts ||
    !(
      Number(parts[1]) > 13 ||
      (Number(parts[1]) === 13 && Number(parts[2]) >= 2)
    )
  )
    throw new AppError("VALIDATION_ERROR");
}

// Tries each candidate in order. A missing file in a folder that was already
// read costs no extra GitHub request.
async function readMetadataHelper(
  client: GithubClient,
  sha: string,
  candidates: string[],
) {
  for (const path of candidates) {
    try {
      const file = await client.readFile(path, sha);
      if ((await gitBlobHash(file.source)) !== file.blobSha)
        throw new AppError("CONFLICT");
      return { path, ...file };
    } catch (error) {
      if (!(error instanceof AppError && error.code === "NOT_FOUND"))
        throw error;
    }
  }
  throw new AppError(
    "VALIDATION_ERROR",
    "Relay could not find the metadata helper module in the repository.",
  );
}

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
        const connection = await PublishingRepository.getConnection(
          input.projectId,
        );
        if (!connection) throw new AppError("NOT_FOUND");
        validateMetadataTarget({
          path: input.filePath,
          url: opportunity.url,
          rootDirectory: connection.rootDirectory,
        });
        const client = await connectedGithub(connection, signal);
        const repository = await client.getRepository();
        if (
          repository.id !== connection.repositoryId ||
          repository.archived ||
          !repository.canPush
        )
          throw new AppError("CONFLICT");
        const base = await client.getRef(connection.baseBranch);
        if (!base) throw new AppError("NOT_FOUND");
        const rootPrefix = connection.rootDirectory
          ? `${connection.rootDirectory}/`
          : "";
        const manifest = await client.readFile(
          `${rootPrefix}package.json`,
          base.sha,
        );
        verifyNextManifest(manifest.source);
        const file = await client.readFile(input.filePath, base.sha);
        if ((await gitBlobHash(file.source)) !== file.blobSha)
          throw new AppError("CONFLICT");
        const helperImport = metadataHelperImport(file.source, input.filePath);
        const helper = helperImport
          ? await readMetadataHelper(
              client,
              base.sha,
              metadataHelperCandidates({
                specifier: helperImport.specifier,
                pagePath: input.filePath,
                rootDirectory: connection.rootDirectory,
                tsconfig: helperImport.specifier.startsWith(".")
                  ? undefined
                  : (
                      await client.readFile(
                        `${rootPrefix}tsconfig.json`,
                        base.sha,
                      )
                    ).source,
              }),
            )
          : undefined;
        const patch = prepareMetadataChange({
          source: file.source,
          path: input.filePath,
          url: opportunity.url,
          newDescription: input.newDescription,
          newTitle: input.newTitle,
          titleTemplate:
            input.newTitle === undefined
              ? null
              : await readTitleTemplate(
                  client,
                  base.sha,
                  input.filePath,
                  connection.rootDirectory,
                ),
          rootDirectory: connection.rootDirectory,
          helper,
        });
        const changed = [
          patch.afterTitle !== null && "title",
          patch.afterDescription !== patch.beforeDescription && "description",
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
          fingerprintVersion: 2,
          changeHash: "",
          reason: opportunity.explanation,
          expectedEffect:
            "A clearer search snippet may help relevant visitors choose this page. Search engines may rewrite titles and descriptions. Traffic, rankings and revenue are not guaranteed.",
          risk: `${patch.helperNote ? `${patch.helperNote} ` : ""}The supplied copy may be inaccurate or less compelling. Check every claim. Only the ${changed} literal${changed.includes(" and ") ? "s change" : " changes"}. Rewrites and custom routing are not verified. A pull request may trigger repository CI.`,
          verificationPlan:
            "Review the exact diff and product claims. Run the repository build and tests in CI, then verify the rendered description on the target URL after your authorized deployment. Compare subsequent Search Console observations without assuming causation.",
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
