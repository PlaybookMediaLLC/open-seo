import type { MetadataProposal } from "@/types/schemas/publishing";
import { AppError } from "@/server/lib/errors";
import { applyCopyEdits } from "./copyChange";
import { pagesSharing } from "./copyLocator";
import type { locateElement } from "./elementLocator";
import type { proposableOpportunity } from "./proposalEligibility";
import { proposalFingerprint } from "./proposalFingerprint";
import type { connectedGithub, PublishingContext } from "./publishingAccess";
import { PublishingRepository } from "./repositories/PublishingRepository";

type Found = Awaited<ReturnType<typeof locateElement>>["found"][number];

/**
 * RFC-0013 and RFC-0014: saves a proposal that changes the opening tag of
 * one JSX element, for a person to review. Nothing is written to GitHub.
 */
export async function saveAttributeProposal(input: {
  context: PublishingContext;
  claimToken: string;
  signal: AbortSignal;
  opportunity: Awaited<ReturnType<typeof proposableOpportunity>>;
  connection: Awaited<
    ReturnType<typeof PublishingRepository.getConnection>
  > & {};
  client: Awaited<ReturnType<typeof connectedGithub>>;
  baseSha: string;
  pageFile: string;
  targetUrl: string;
  found: Found;
  afterTag: string;
  draftId: string | null;
  /** The element is in the root layout, which renders on every page. */
  layout?: boolean;
  /** What changes, such as "the alt attribute". */
  change: string;
  expectedEffect: string;
  risk: string;
  verificationPlan: string;
  summary: string;
}) {
  const { context, opportunity, connection, client, found } = input;
  const { file, element } = found;
  const { files, textEdits } = await applyCopyEdits(
    new Map([[file.path, file]]),
    [
      {
        filePath: file.path,
        beforeText: file.source.slice(element.start, element.end),
        afterText: input.afterTag,
        nodeKind: "jsx_attribute",
      },
    ],
  );
  const shared =
    file.path === input.pageFile || input.layout
      ? []
      : (
          await pagesSharing({
            reader: client,
            rootDirectory: connection.rootDirectory,
            sha: input.baseSha,
            pageFile: input.pageFile,
            modulePath: file.path,
            exportName: null,
          })
        ).pages;
  const page = await client.readFile(input.pageFile, input.baseSha);
  const proposal: MetadataProposal = {
    id: crypto.randomUUID(),
    projectId: connection.projectId,
    opportunityId: opportunity.id,
    connectionId: connection.id,
    evidenceRunId: opportunity.evidenceRunId,
    opportunityVersion: opportunity.version,
    targetUrl: input.targetUrl,
    filePath: input.pageFile,
    baseSha: input.baseSha,
    beforeBlobSha: page.blobSha,
    afterBlobSha:
      files.find((item) => item.path === input.pageFile)?.blobSha ??
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
    changeKind: "jsx_attribute",
    revertsProposalId: null,
    draftId: input.draftId,
    changeHash: "",
    reason: opportunity.explanation,
    expectedEffect: input.expectedEffect,
    risk: `${input.layout ? "The root layout renders on every page, so the change applies to the whole site. " : shared.length ? `The component also renders on: ${shared.join(", ")}. ` : ""}Only ${input.change} of one element changes. ${input.risk} A pull request may trigger repository CI.`,
    verificationPlan: input.verificationPlan,
    validationSummary: `One element in ${file.path} matched, and the file parsed again after the change to ${input.change}. Full repository build and CI were not run.`,
    createdBy: context.userId,
    createdAt: new Date().toISOString(),
  };
  proposal.changeHash = await proposalFingerprint(proposal, textEdits);
  input.signal.throwIfAborted();
  if (
    !(await PublishingRepository.saveProposal({
      proposal,
      textEdits,
      claimToken: input.claimToken,
      organizationId: context.organizationId,
      audit: {
        organizationId: context.organizationId,
        projectId: proposal.projectId,
        actor: context,
        action: "proposal.prepared",
        targetType: "proposal",
        targetId: proposal.id,
        summary: input.summary,
      },
    }))
  )
    throw new AppError("CONFLICT");
  return proposal.id;
}
