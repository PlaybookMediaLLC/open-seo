import { AppError } from "@/server/lib/errors";
import type {
  MetadataProposal,
  PublishingMutationResult,
} from "@/types/schemas/publishing";
import type { PrepareCopyInput } from "@/types/schemas/copyText";
import { applyCopyEdits } from "./copyChange";
import { locateCopy, pagesSharing } from "./copyLocator";
import { locateMetadataFile } from "./fileLocator";
import { proposalFingerprint } from "./proposalFingerprint";
import { proposableOpportunity } from "./proposalEligibility";
import {
  authorizePublishing,
  connectedGithub,
  publishingFailure,
  withPublishingClaim,
  type PublishingContext,
} from "./publishingAccess";
import { validateTarget } from "./publishingTarget";
import { PublishingRepository } from "./repositories/PublishingRepository";

// RFC-0012 5.4: a reviewed page text change. Each picked text must resolve
// to one source node; the proposal binds every edit and the page file.
const READ_ONLY = { metadata: "read", contents: "read" } as const;
const MAX_REQUESTS = 200;

async function prepare(
  context: PublishingContext,
  input: PrepareCopyInput,
): Promise<PublishingMutationResult> {
  await authorizePublishing(context, input.projectId, true);
  try {
    return await withPublishingClaim(
      context,
      input.projectId,
      async (claimToken, signal) => {
        const opportunity = await proposableOpportunity(input);
        const connection = await PublishingRepository.getConnection(
          input.projectId,
        );
        if (!connection) throw new AppError("NOT_FOUND");
        if (input.filePath)
          validateTarget(
            input.filePath,
            opportunity.url,
            connection.rootDirectory,
          );
        const client = await connectedGithub(
          connection,
          signal,
          READ_ONLY,
          MAX_REQUESTS,
        );
        const repository = await client.getRepository();
        if (
          repository.id !== connection.repositoryId ||
          repository.archived ||
          !repository.canPush
        )
          throw new AppError("CONFLICT");
        const base = await client.getRef(connection.baseBranch);
        if (!base) throw new AppError("NOT_FOUND");
        const located = input.filePath
          ? { status: "found" as const, filePath: input.filePath }
          : await locateMetadataFile(
              client.request,
              connection,
              opportunity.url,
            );
        if (located.status !== "found")
          throw new AppError("VALIDATION_ERROR", located.message);
        const pageFile = located.filePath;
        const page = await client.readFile(pageFile, base.sha);
        const sources = new Map([[pageFile, page]]);
        const shared = new Set<string>();
        const wanted = [];
        const filesRead = new Set<string>();
        for (const edit of input.edits) {
          const found = await locateCopy({
            reader: client,
            rootDirectory: connection.rootDirectory,
            pageFile,
            sha: base.sha,
            text: edit.text,
          });
          for (const path of found.filesRead) filesRead.add(path);
          if (found.status !== "found")
            throw new AppError(
              "VALIDATION_ERROR",
              `"${edit.text}": ${found.message}`,
            );
          sources.set(found.file.path, found.file);
          wanted.push({
            filePath: found.file.path,
            beforeText: edit.text,
            afterText: edit.newText,
          });
          const sharing = await pagesSharing({
            reader: client,
            rootDirectory: connection.rootDirectory,
            sha: base.sha,
            pageFile,
            modulePath: found.file.path,
            exportName: found.node.exportName,
          });
          for (const path of sharing.pages) shared.add(path);
        }
        if (shared.size && !input.confirmSharedPages)
          throw new AppError(
            "VALIDATION_ERROR",
            `These pages use the same text and change too: ${[...shared].join(", ")}. Confirm that they change too.`,
          );
        const { files, textEdits } = await applyCopyEdits(sources, wanted);
        const sharedNote = shared.size
          ? `The text also shows on: ${[...shared].join(", ")}. `
          : "";
        const proposal: MetadataProposal = {
          id: crypto.randomUUID(),
          projectId: input.projectId,
          opportunityId: opportunity.id,
          connectionId: connection.id,
          evidenceRunId: opportunity.evidenceRunId,
          opportunityVersion: opportunity.version,
          targetUrl: opportunity.url,
          filePath: pageFile,
          baseSha: base.sha,
          beforeBlobSha: page.blobSha,
          afterBlobSha:
            files.find((file) => file.path === pageFile)?.blobSha ??
            page.blobSha,
          descriptionBefore: "",
          descriptionAfter: "",
          beforeSnippet: "",
          afterSnippet: "",
          metadataSource: "literal_object",
          helperPath: null,
          helperBlobSha: null,
          titleBefore: null,
          titleAfter: null,
          titleBeforeSnippet: null,
          titleAfterSnippet: null,
          canonicalBefore: null,
          canonicalAfter: null,
          canonicalBeforeSnippet: null,
          canonicalAfterSnippet: null,
          robotsBefore: null,
          robotsAfter: null,
          robotsBeforeSnippet: null,
          robotsAfterSnippet: null,
          adapterId: "app_router_metadata",
          fingerprintVersion: 6,
          changeKind: "copy_text",
          revertsProposalId: null,
          draftId: input.draftId ?? null,
          changeHash: "",
          reason: opportunity.explanation,
          expectedEffect:
            "Clearer page text may help visitors act. Conversions, traffic and revenue are not guaranteed.",
          risk: `${sharedNote}The new text may be inaccurate or less clear. Check every claim. Only the listed text nodes change. A pull request may trigger repository CI.`,
          verificationPlan:
            "Review the exact diff and every claim. Run the repository build and tests in CI, then check the text on the target URL after your authorized deployment. Compare later GA4 conversions without assuming causation.",
          validationSummary: `${textEdits.length} text node${textEdits.length === 1 ? "" : "s"} in ${files.length} file${files.length === 1 ? "" : "s"} replaced, and each edited file parsed again. Relay read ${filesRead.size} files from the page file. Full repository build and CI were not run.`,
          createdBy: context.userId,
          createdAt: new Date().toISOString(),
        };
        proposal.changeHash = await proposalFingerprint(proposal, textEdits);
        signal.throwIfAborted();
        if (
          !(await PublishingRepository.saveProposal({
            proposal,
            textEdits,
            claimToken,
            organizationId: context.organizationId,
            audit: {
              organizationId: context.organizationId,
              projectId: proposal.projectId,
              actor: context,
              action: "proposal.prepared",
              targetType: "proposal",
              targetId: proposal.id,
              summary: `Prepared a page text change for ${proposal.targetUrl}`,
            },
          }))
        )
          throw new AppError("CONFLICT");
        return {
          ok: true,
          message:
            "Page text proposal prepared. Review the exact change before authorizing a pull request. Nothing was written to GitHub.",
          proposalId: proposal.id,
        };
      },
    );
  } catch (error) {
    return { ok: false, message: publishingFailure(error) };
  }
}

export const CopyProposalService = { prepare };
