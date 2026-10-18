import { OpportunityRepository } from "@/server/features/opportunities/repositories/OpportunityRepository";
import { AppError } from "@/server/lib/errors";
import { locateCopy, pagesSharing } from "./copyLocator";
import { locateMetadataFile } from "./fileLocator";
import { fetchPageTexts } from "./pageTexts";
import {
  authorizePublishing,
  connectedGithub,
  withPublishingClaim,
  type PublishingContext,
} from "./publishingAccess";
import { validateTarget } from "./publishingTarget";
import { PublishingRepository } from "./repositories/PublishingRepository";

// RFC-0012 5.4: pick a text on the live page, then find the one source node
// that holds it and the other pages that would change too. Nothing is written.
const READ_ONLY = { metadata: "read", contents: "read" } as const;
// The page file search, up to 20 files with their candidates, and up to 30
// page files for the sharing check.
const MAX_REQUESTS = 200;
type Scope = { projectId: string; opportunityId: string };

async function opportunityUrl(context: PublishingContext, input: Scope) {
  await authorizePublishing(context, input.projectId);
  const detail = await OpportunityRepository.getDetail(
    input.projectId,
    input.opportunityId,
  );
  if (!detail) throw new AppError("NOT_FOUND");
  return detail.opportunity.url;
}

async function pageTexts(context: PublishingContext, input: Scope) {
  const url = await opportunityUrl(context, input);
  return { url, texts: await fetchPageTexts(url) };
}

async function locate(
  context: PublishingContext,
  input: Scope & { text: string; filePath?: string },
) {
  const url = await opportunityUrl(context, input);
  const connection = await PublishingRepository.getConnection(input.projectId);
  if (!connection)
    throw new AppError(
      "CONFLICT",
      "Connect GitHub publishing in Project settings first.",
    );
  if (input.filePath)
    validateTarget(input.filePath, url, connection.rootDirectory);
  return withPublishingClaim(context, input.projectId, async (_, signal) => {
    const client = await connectedGithub(
      connection,
      signal,
      READ_ONLY,
      MAX_REQUESTS,
    );
    const base = await client.getRef(connection.baseBranch);
    if (!base)
      throw new AppError("NOT_FOUND", "The base branch was not found.");
    const page = input.filePath
      ? { status: "found" as const, filePath: input.filePath }
      : await locateMetadataFile(client.request, connection, url);
    if (page.status !== "found")
      return { status: "not_found" as const, message: page.message };
    const located = await locateCopy({
      reader: client,
      rootDirectory: connection.rootDirectory,
      pageFile: page.filePath,
      sha: base.sha,
      text: input.text,
    });
    if (located.status !== "found")
      return { ...located, pageFile: page.filePath };
    const { file, node } = located;
    const sharing = await pagesSharing({
      reader: client,
      rootDirectory: connection.rootDirectory,
      sha: base.sha,
      pageFile: page.filePath,
      modulePath: file.path,
      exportName: node.exportName,
    });
    return {
      status: "found" as const,
      pageFile: page.filePath,
      path: file.path,
      line: node.line,
      kind: node.kind,
      text: file.source.slice(node.start, node.end),
      sharedPages: sharing.pages,
      sharingComplete: sharing.complete,
      filesRead: located.filesRead,
    };
  });
}

export const CopyLocatorService = { pageTexts, locate };
