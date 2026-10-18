import { OpportunityRepository } from "@/server/features/opportunities/repositories/OpportunityRepository";
import { applyCopyEdits } from "@/server/features/publishing/copyChange";
import { pagesSharing } from "@/server/features/publishing/copyLocator";
import {
  locateElement,
  withAttribute,
  type ElementTarget,
} from "@/server/features/publishing/elementLocator";
import { locateMetadataFile } from "@/server/features/publishing/fileLocator";
import { proposalFingerprint } from "@/server/features/publishing/proposalFingerprint";
import { proposableOpportunity } from "@/server/features/publishing/proposalEligibility";
import {
  authorizePublishing,
  connectedGithub,
  publishingFailure,
  withPublishingClaim,
  type PublishingContext,
} from "@/server/features/publishing/publishingAccess";
import { PublishingRepository } from "@/server/features/publishing/repositories/PublishingRepository";
import { AppError } from "@/server/lib/errors";
import { ACCESSIBILITY_LIMITS } from "@/shared/accessibility";
import type { AccessibilityFixInput } from "@/types/schemas/accessibility";
import type {
  MetadataProposal,
  PublishingMutationResult,
} from "@/types/schemas/publishing";
import { altTextProblems, snippetSrc } from "./altText";

// RFC-0013 5.4 phase 1: alt text and the page language, fixed in code by a
// reviewed pull request. Every value comes from the person who approves.
const READ_ONLY = { metadata: "read", contents: "read" } as const;
const MAX_REQUESTS = 200;
const LANG_RULES = new Set(["html-has-lang", "html-lang-valid"]);
const LAYOUTS = ["app", "src/app"].flatMap((directory) =>
  ["tsx", "jsx", "js"].map((extension) => `${directory}/layout.${extension}`),
);

function checkedValue(fix: AccessibilityFixInput["fix"]) {
  if (fix.kind === "lang") return fix.language;
  if (fix.decorative) return "";
  const text = (fix.text ?? "").trim();
  if (!text)
    throw new AppError(
      "VALIDATION_ERROR",
      'Describe the image, or mark it as decorative to set alt="".',
    );
  const [problem] = altTextProblems(text);
  if (problem) throw new AppError("VALIDATION_ERROR", problem);
  return text;
}

async function prepare(
  context: PublishingContext,
  input: AccessibilityFixInput,
): Promise<PublishingMutationResult> {
  await authorizePublishing(context, input.projectId, true);
  try {
    return await withPublishingClaim(
      context,
      input.projectId,
      async (claimToken, signal) => {
        const opportunity = await proposableOpportunity(input);
        const detail = await OpportunityRepository.getDetail(
          input.projectId,
          opportunity.id,
        );
        const evidence = detail?.accessibilityEvidence.find(
          (row) => row.runId === opportunity.evidenceRunId,
        );
        if (opportunity.type !== "accessibility_issue" || !evidence)
          throw new AppError(
            "VALIDATION_ERROR",
            "Only accessibility issues have this fix.",
          );
        const lang = input.fix.kind === "lang";
        if (
          lang
            ? !LANG_RULES.has(evidence.ruleId)
            : evidence.ruleId !== "image-alt"
        )
          throw new AppError(
            "VALIDATION_ERROR",
            `Relay fixes alt text and the page language in code. Fix ${evidence.ruleId} by hand.`,
          );
        const value = checkedValue(input.fix);
        const connection = await PublishingRepository.getConnection(
          input.projectId,
        );
        if (!connection) throw new AppError("NOT_FOUND");
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
        const root = connection.rootDirectory;
        let pageFile: string;
        let target: ElementTarget;
        if (lang) {
          // The root layout renders <html> for every App Router page.
          const layout = await (async () => {
            for (const path of LAYOUTS.map((item) =>
              [root, item].filter(Boolean).join("/"),
            ))
              try {
                await client.readFile(path, base.sha);
                return path;
              } catch {
                continue;
              }
            return null;
          })();
          if (!layout)
            throw new AppError(
              "VALIDATION_ERROR",
              "No App Router root layout was found. Set lang on <html> by hand.",
            );
          pageFile = layout;
          target = { kind: "html" };
        } else {
          const src = snippetSrc(evidence.exampleSnippet);
          if (!src)
            throw new AppError(
              "VALIDATION_ERROR",
              "The stored element has no image src. Fix it by hand.",
            );
          const located = await locateMetadataFile(
            client.request,
            connection,
            evidence.exampleUrl,
          );
          if (located.status !== "found")
            throw new AppError("VALIDATION_ERROR", located.message);
          pageFile = located.filePath;
          target = { kind: "image", src };
        }
        const { found } = await locateElement({
          reader: client,
          rootDirectory: root,
          pageFile,
          sha: base.sha,
          target,
        });
        if (found.length !== 1)
          throw new AppError(
            "VALIDATION_ERROR",
            found.length
              ? `${found.length} elements match: ${found.map((item) => `${item.file.path}:${item.line}`).join(", ")}. Relay changes one element only; fix it by hand.`
              : "Relay did not find the element in the page file or the files it imports. Fix it by hand.",
          );
        const [{ file, element }] = found;
        const name = lang ? "lang" : "alt";
        const { files, textEdits } = await applyCopyEdits(
          new Map([[file.path, file]]),
          [
            {
              filePath: file.path,
              beforeText: file.source.slice(element.start, element.end),
              afterText: withAttribute(file, element, name, value),
              nodeKind: "jsx_attribute",
            },
          ],
        );
        const shared =
          file.path === pageFile
            ? []
            : (
                await pagesSharing({
                  reader: client,
                  rootDirectory: root,
                  sha: base.sha,
                  pageFile,
                  modulePath: file.path,
                  exportName: null,
                })
              ).pages;
        const page = await client.readFile(pageFile, base.sha);
        const proposal: MetadataProposal = {
          id: crypto.randomUUID(),
          projectId: input.projectId,
          opportunityId: opportunity.id,
          connectionId: connection.id,
          evidenceRunId: opportunity.evidenceRunId,
          opportunityVersion: opportunity.version,
          targetUrl: evidence.exampleUrl,
          filePath: pageFile,
          baseSha: base.sha,
          beforeBlobSha: page.blobSha,
          afterBlobSha:
            files.find((item) => item.path === pageFile)?.blobSha ??
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
          draftId: input.fix.kind === "alt" ? (input.draftId ?? null) : null,
          changeHash: "",
          reason: opportunity.explanation,
          expectedEffect: lang
            ? "Screen readers read the pages with the right language. Run a new audit after the change deploys to check it."
            : "Screen readers describe the image, or skip it when it is decorative. Run a new audit after the change deploys to check it.",
          risk: `${shared.length ? `The component also renders on: ${shared.join(", ")}. ` : ""}Only the ${name} attribute of one element changes. ${ACCESSIBILITY_LIMITS} A pull request may trigger repository CI.`,
          verificationPlan:
            "Review the exact diff. Run the repository build and tests in CI. After your authorized deployment, Relay checks the affected pages again with axe-core.",
          validationSummary: `One element in ${file.path} matched, and the file parsed again with the new ${name} attribute. Full repository build and CI were not run.`,
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
              summary: `Prepared an accessibility fix (${name}) for ${proposal.targetUrl}`,
            },
          }))
        )
          throw new AppError("CONFLICT");
        return {
          ok: true,
          message:
            "Accessibility fix prepared. Review the exact change before authorizing a pull request. Nothing was written to GitHub.",
          proposalId: proposal.id,
        };
      },
    );
  } catch (error) {
    return { ok: false, message: publishingFailure(error) };
  }
}

export const AccessibilityFixService = { prepare };
