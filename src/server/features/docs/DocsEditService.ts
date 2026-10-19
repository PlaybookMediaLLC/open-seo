import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { docsPages } from "@/db/schema";
import { siteRoot } from "@/server/features/opportunities/services/detectors/shared";
import { applyCopyEdits } from "@/server/features/publishing/copyChange";
import { READ_ONLY } from "@/server/features/publishing/draftInputs";
import { proposableOpportunity } from "@/server/features/publishing/proposalEligibility";
import { proposalFingerprint } from "@/server/features/publishing/proposalFingerprint";
import {
  authorizePublishing,
  connectedGithub,
  publishingFailure,
  withPublishingClaim,
  type PublishingContext,
} from "@/server/features/publishing/publishingAccess";
import { PublishingRepository } from "@/server/features/publishing/repositories/PublishingRepository";
import { AppError } from "@/server/lib/errors";
import type { DocsEditInput } from "@/types/schemas/docs";
import type {
  MetadataProposal,
  PublishingMutationResult,
} from "@/types/schemas/publishing";
import { planMarkdownEdit } from "./markdownEdit";

const EDIT_NAMES = {
  insert_section: "a new section",
  add_faq_item: "a list item",
  replace_paragraph: "a replaced paragraph",
} as const;

/**
 * RFC-0017 5.5: a docs edit on an approved docs opportunity, for a person to
 * review. Nothing is written to GitHub.
 */
async function prepare(
  context: PublishingContext,
  input: DocsEditInput,
): Promise<PublishingMutationResult> {
  await authorizePublishing(context, input.projectId, true);
  try {
    return await withPublishingClaim(
      context,
      input.projectId,
      async (claimToken, signal) => {
        const opportunity = await proposableOpportunity(input);
        if (!opportunity.type.startsWith("docs_"))
          throw new AppError(
            "VALIDATION_ERROR",
            "Only docs opportunities have docs edits.",
          );
        const [page] = await db
          .select()
          .from(docsPages)
          .where(
            and(
              eq(docsPages.projectId, input.projectId),
              eq(docsPages.filePath, input.filePath),
            ),
          );
        if (!page)
          throw new AppError(
            "VALIDATION_ERROR",
            "Choose a file from the docs index.",
          );
        const connection = await PublishingRepository.getConnection(
          input.projectId,
        );
        if (!connection) throw new AppError("NOT_FOUND");
        const client = await connectedGithub(connection, signal, READ_ONLY, 8);
        const repository = await client.getRepository();
        if (
          repository.id !== connection.repositoryId ||
          repository.archived ||
          !repository.canPush
        )
          throw new AppError("CONFLICT");
        const base = await client.getRef(connection.baseBranch);
        if (!base) throw new AppError("NOT_FOUND");
        const file = await client.readFile(page.filePath, base.sha);
        const span = planMarkdownEdit(file.source, page.filePath, input.edit);
        const { files, textEdits } = await applyCopyEdits(
          new Map([[page.filePath, file]]),
          [{ filePath: page.filePath, ...span, nodeKind: "markdown_block" }],
        );
        const change = EDIT_NAMES[input.edit.kind];
        const proposal: MetadataProposal = {
          id: crypto.randomUUID(),
          projectId: input.projectId,
          opportunityId: opportunity.id,
          connectionId: connection.id,
          evidenceRunId: opportunity.evidenceRunId,
          opportunityVersion: opportunity.version,
          targetUrl: new URL(page.urlPath, siteRoot(opportunity.siteUrl)).href,
          filePath: page.filePath,
          baseSha: base.sha,
          beforeBlobSha: file.blobSha,
          afterBlobSha: files[0]?.blobSha ?? file.blobSha,
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
          changeKind: "markdown",
          revertsProposalId: null,
          draftId: null,
          changeHash: "",
          reason: opportunity.explanation,
          expectedEffect:
            "The docs answer a question that searches or traffic show. Fewer searches and tickets on the topic are not guaranteed.",
          risk: `The new text may be wrong or out of date. Check every fact, command and option. Only ${change} in ${page.filePath} changes. A pull request may trigger repository CI.`,
          verificationPlan:
            "Review the exact diff and every fact. Build the docs in CI, then check the page after your authorized deployment. After 4 weeks, compare searches and traffic for the topic.",
          validationSummary: `One Markdown block in ${page.filePath} changed, and the file parsed again with its front matter and every JSX, import and HTML block byte-identical. The docs build and CI were not run.`,
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
              summary: `Prepared a docs change (${change}) for ${page.filePath}`,
            },
          }))
        )
          throw new AppError("CONFLICT");
        return {
          ok: true,
          message:
            "Docs change prepared. Review the exact change before authorizing a pull request. Nothing was written to GitHub.",
          proposalId: proposal.id,
        };
      },
    );
  } catch (error) {
    return { ok: false, message: publishingFailure(error) };
  }
}

export const DocsEditService = { prepare };
