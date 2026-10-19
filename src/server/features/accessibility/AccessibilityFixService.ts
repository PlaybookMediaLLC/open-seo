import { OpportunityRepository } from "@/server/features/opportunities/repositories/OpportunityRepository";
import { saveAttributeProposal } from "@/server/features/publishing/attributeProposal";
import {
  locateElement,
  withAttribute,
  type ElementTarget,
} from "@/server/features/publishing/elementLocator";
import { locateMetadataFile } from "@/server/features/publishing/fileLocator";
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
import { readPages } from "@/server/lib/scrape";
import { ACCESSIBILITY_LIMITS } from "@/shared/accessibility";
import type { AccessibilityFixInput } from "@/types/schemas/accessibility";
import type { PublishingMutationResult } from "@/types/schemas/publishing";
import { NAME_RULES, nameTarget, snippetAttributes } from "./accessibleName";
import { altTextProblems, snippetSrc } from "./altText";

// RFC-0013 5.4 phase 1: alt text and the page language, fixed in code by a
// reviewed pull request. Every value comes from the person who approves.
const READ_ONLY = { metadata: "read", contents: "read" } as const;
const MAX_REQUESTS = 200;
const LANG_RULES = new Set(["html-has-lang", "html-lang-valid"]);
const ATTRIBUTES = { lang: "lang", alt: "alt", name: "aria-label" } as const;
const EFFECTS = {
  lang: "Screen readers read the pages with the right language.",
  alt: "Screen readers describe the image, or skip it when it is decorative.",
  name: "Screen readers announce the name of the link, button or field.",
} as const;
const LAYOUTS = ["app", "src/app"].flatMap((directory) =>
  ["tsx", "jsx", "js"].map((extension) => `${directory}/layout.${extension}`),
);

function checkedValue(fix: AccessibilityFixInput["fix"]) {
  if (fix.kind === "lang") return fix.language;
  if (fix.kind === "name") return fix.text;
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
        const { kind } = input.fix;
        const lang = kind === "lang";
        if (
          lang
            ? !LANG_RULES.has(evidence.ruleId)
            : kind === "alt"
              ? evidence.ruleId !== "image-alt"
              : !NAME_RULES[evidence.ruleId]
        )
          throw new AppError(
            "VALIDATION_ERROR",
            `Relay fixes alt text, the page language, and link, button and field names in code. Fix ${evidence.ruleId} by hand.`,
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
          const src =
            kind === "alt" ? snippetSrc(evidence.exampleSnippet) : null;
          const element: ElementTarget | null = src
            ? { kind: "image", src }
            : nameTarget(
                evidence.ruleId,
                evidence.exampleSnippet,
                evidence.exampleSelector,
              );
          if (!element)
            throw new AppError(
              "VALIDATION_ERROR",
              "The stored element has no literal attribute that Relay can match in code. Fix it by hand.",
            );
          const located = await locateMetadataFile(
            client.request,
            connection,
            evidence.exampleUrl,
          );
          if (located.status !== "found")
            throw new AppError("VALIDATION_ERROR", located.message);
          pageFile = located.filePath;
          target = element;
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
        const [match] = found;
        const name = ATTRIBUTES[kind];
        const proposalId = await saveAttributeProposal({
          context,
          claimToken,
          signal,
          opportunity,
          connection,
          client,
          baseSha: base.sha,
          pageFile,
          targetUrl: evidence.exampleUrl,
          found: match,
          afterTag: withAttribute(match.file, match.element, name, value),
          draftId: input.fix.kind === "alt" ? (input.draftId ?? null) : null,
          change: `the ${name} attribute`,
          expectedEffect: `${EFFECTS[kind]} Run a new audit after the change deploys to check it.`,
          risk: ACCESSIBILITY_LIMITS,
          verificationPlan:
            "Review the exact diff. Run the repository build and tests in CI. After your authorized deployment, Relay checks the affected pages again with axe-core.",
          summary: `Prepared an accessibility fix (${name}) for ${evidence.exampleUrl}`,
        });
        return {
          ok: true,
          message:
            "Accessibility fix prepared. Review the exact change before authorizing a pull request. Nothing was written to GitHub.",
          proposalId,
        };
      },
    );
  } catch (error) {
    return { ok: false, message: publishingFailure(error) };
  }
}

/**
 * A starting name for a link or a field: the title of the linked page on
 * the same site, or the field's placeholder. The person edits it.
 */
async function suggestName(
  context: PublishingContext,
  input: { projectId: string; opportunityId: string },
) {
  await authorizePublishing(context, input.projectId);
  const detail = await OpportunityRepository.getDetail(
    input.projectId,
    input.opportunityId,
  );
  if (!detail) throw new AppError("NOT_FOUND");
  const evidence = detail.accessibilityEvidence.find(
    (row) => row.runId === detail.opportunity.evidenceRunId,
  );
  const attributes = evidence ? snippetAttributes(evidence.exampleSnippet) : {};
  if (evidence?.ruleId === "label" && attributes.placeholder)
    return {
      text: attributes.placeholder.slice(0, 100),
      source: "From the field's placeholder.",
    };
  if (evidence?.ruleId === "link-name" && attributes.href) {
    const url = URL.parse(attributes.href, evidence.exampleUrl);
    if (url && url.origin === new URL(evidence.exampleUrl).origin) {
      const page = (await readPages([url.href], 1)).pages[0];
      if (page?.title)
        return {
          text: page.title.slice(0, 100),
          source: `From the title of ${url.pathname}.`,
        };
    }
  }
  return {
    text: null,
    source: "Relay has no suggestion. Write what the element does.",
  };
}

export const AccessibilityFixService = { prepare, suggestName };
