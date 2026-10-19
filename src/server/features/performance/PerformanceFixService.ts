import { z } from "zod";
import { saveAttributeProposal } from "@/server/features/publishing/attributeProposal";
import {
  editTag,
  locateElement,
  tagAttributes,
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
import { OpportunityRepository } from "@/server/features/opportunities/repositories/OpportunityRepository";
import { AppError } from "@/server/lib/errors";
import { FIELD_DATA_LIMITS } from "@/shared/performance";
import type { PerformanceFixInput } from "@/types/schemas/performance";
import type { PublishingMutationResult } from "@/types/schemas/publishing";
import { isListedScript, priorityProp } from "./fixRules";
import { IMAGE_HEADER_BYTES, imageSize } from "./imageSize";
import { reportItems } from "./performanceSignals";

// RFC-0014 5.5 phase 2: three fixes in code, each one attribute change on
// one element, through the RFC-0013 jsx_attribute change kind.
const READ_ONLY = { metadata: "read", contents: "read" } as const;
const MAX_REQUESTS = 200;
const LAYOUTS = ["app", "src/app"].flatMap((directory) =>
  ["tsx", "jsx", "js"].map((extension) => `${directory}/layout.${extension}`),
);
const CAUSES: Record<PerformanceFixInput["fix"], string[]> = {
  lcp_priority: ["lcp_lazy_image", "lcp_not_prioritized"],
  image_size: ["unsized_images"],
  script_strategy: ["third_party_scripts"],
};
const manifestSchema = z.object({
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
});
const LCP_AUDITS = [
  "lcp-lazy-loaded",
  "prioritize-lcp-image",
  "lcp-discovery-insight",
];
const VERIFY =
  "Review the exact diff. Run the repository build and tests in CI. Lab: after your authorized deployment, run Lighthouse on the page and compare the metric. Field: check the field result 4 weeks after you mark the item implemented.";

/** The image URL or the src in a Lighthouse item. */
function itemImage(item: Record<string, unknown>) {
  if (typeof item.url === "string") return item.url;
  const node = item.node;
  const snippet: unknown =
    node && typeof node === "object" ? Reflect.get(node, "snippet") : null;
  return typeof snippet === "string"
    ? (/\ssrc="([^"]+)"/.exec(snippet)?.[1] ?? null)
    : null;
}

function single(
  found: Awaited<ReturnType<typeof locateElement>>["found"],
  what: string,
) {
  if (found.length === 1) return found[0];
  throw new AppError(
    "VALIDATION_ERROR",
    found.length
      ? `${found.length} elements match: ${found.map((item) => `${item.file.path}:${item.line}`).join(", ")}. Relay changes one element only; fix it by hand.`
      : `Relay did not find ${what} in the page file or the files it imports. Fix it by hand.`,
  );
}

async function prepare(
  context: PublishingContext,
  input: PerformanceFixInput,
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
        const evidence = detail?.performanceEvidence.find(
          (row) => row.runId === opportunity.evidenceRunId,
        );
        if (opportunity.type !== "performance_issue" || !evidence)
          throw new AppError(
            "VALIDATION_ERROR",
            "Only performance issues have this fix.",
          );
        if (evidence.scope !== "url")
          throw new AppError(
            "VALIDATION_ERROR",
            "A site-wide item has no single page to change. Fix it by hand.",
          );
        const causes = new Set(evidence.causeIds.split(" "));
        if (!CAUSES[input.fix].some((cause) => causes.has(cause)))
          throw new AppError(
            "VALIDATION_ERROR",
            "The Lighthouse report does not name the cause that this fix solves.",
          );
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
        const rooted = (path: string) => [root, path].filter(Boolean).join("/");
        const located = await locateMetadataFile(
          client.request,
          connection,
          evidence.target,
        );
        if (located.status !== "found")
          throw new AppError("VALIDATION_ERROR", located.message);
        const pageFile = located.filePath;
        const find = (target: ElementTarget, file = pageFile) =>
          locateElement({
            reader: client,
            rootDirectory: root,
            pageFile: file,
            sha: base.sha,
            target,
          }).then((result) => result.found);
        const items = await reportItems(input.projectId, evidence.target);
        let match: Awaited<ReturnType<typeof find>>[number];
        let afterTag: string;
        let change: string;
        let risk: string;
        if (input.fix === "lcp_priority") {
          const src = LCP_AUDITS.flatMap((key) => items.get(key) ?? [])
            .map(itemImage)
            .find(Boolean);
          if (!src)
            throw new AppError(
              "VALIDATION_ERROR",
              "The Lighthouse report does not name the LCP image.",
            );
          const manifest = manifestSchema.safeParse(
            JSON.parse(
              (await client.readFile(rooted("package.json"), base.sha)).source,
            ),
          );
          const prop = priorityProp(
            manifest.data?.dependencies?.next ??
              manifest.data?.devDependencies?.next,
          );
          if (!prop)
            throw new AppError(
              "VALIDATION_ERROR",
              "package.json does not pin Next.js 13 or later, so Relay cannot pick the priority prop. Fix it by hand.",
            );
          match = single(await find({ kind: "image", src }), "the LCP image");
          let tag = match.file.source.slice(
            match.element.start,
            match.element.end,
          );
          if (!tag.startsWith("<Image"))
            throw new AppError(
              "VALIDATION_ERROR",
              "Relay adds the priority hint to next/image elements only. Fix this <img> by hand.",
            );
          if (tagAttributes(tag).get("loading") === "lazy")
            tag = editTag(tag, "loading", null);
          afterTag = editTag(tag, prop, true);
          change = `the ${prop} and loading attributes`;
          risk =
            "The browser loads this image earlier, which can delay other requests on the page.";
        } else if (input.fix === "image_size") {
          const sources = (items.get("unsized-images") ?? [])
            .map(itemImage)
            .filter((src): src is string => Boolean(src));
          const candidates = await Promise.all(
            sources.map((src) => find({ kind: "image", src })),
          );
          const found = candidates.find((list) => list.length === 1);
          match = single(found ?? candidates[0] ?? [], "an unsized image");
          const tag = match.file.source.slice(
            match.element.start,
            match.element.end,
          );
          const attributes = tagAttributes(tag);
          const src = attributes.get("src");
          if (
            !tag.startsWith("<img") ||
            attributes.has("fill") ||
            typeof src !== "string" ||
            !src.startsWith("/")
          )
            throw new AppError(
              "VALIDATION_ERROR",
              "Relay sizes <img> elements with a file in public/ only. Fix this image by hand.",
            );
          const size = imageSize(
            await client.readFileHead(
              rooted(`public${new URL(src, "https://site.invalid").pathname}`),
              base.sha,
              IMAGE_HEADER_BYTES,
            ),
          );
          if (!size)
            throw new AppError(
              "VALIDATION_ERROR",
              "The image file is not a PNG, JPEG, WebP or AVIF file that Relay can read. Fix it by hand.",
            );
          afterTag = editTag(
            editTag(tag, "width", String(size.width)),
            "height",
            String(size.height),
          );
          change = "the width and height attributes";
          risk = `The size comes from the image file (${size.width} × ${size.height}). Check that CSS still scales the image as before.`;
        } else {
          const target: ElementTarget = {
            kind: "where",
            tags: ["Script"],
            test: (attributes) => {
              const src = attributes.get("src");
              return (
                typeof src === "string" &&
                isListedScript(src) &&
                attributes.get("strategy") !== "lazyOnload"
              );
            },
          };
          const layouts = await Promise.all(
            LAYOUTS.map((path) => find(target, rooted(path)).catch(() => [])),
          );
          match = single(
            [...(await find(target)), ...layouts.flat()],
            "a next/script element that loads a listed host",
          );
          afterTag = editTag(
            match.file.source.slice(match.element.start, match.element.end),
            "strategy",
            "lazyOnload",
          );
          change = "the strategy attribute";
          risk =
            "The script loads after the page is idle, so analytics or chat may start later and miss very short visits.";
        }
        const proposalId = await saveAttributeProposal({
          context,
          claimToken,
          signal,
          opportunity,
          connection,
          client,
          baseSha: base.sha,
          pageFile,
          targetUrl: evidence.target,
          found: match,
          afterTag,
          draftId: null,
          layout: LAYOUTS.some((path) => match.file.path === rooted(path)),
          change,
          expectedEffect: `A better ${evidence.metric.toUpperCase()} on ${evidence.target}. ${FIELD_DATA_LIMITS}`,
          risk,
          verificationPlan: VERIFY,
          summary: `Prepared a performance fix (${input.fix}) for ${evidence.target}`,
        });
        return {
          ok: true,
          message:
            "Performance fix prepared. Review the exact change before authorizing a pull request. Nothing was written to GitHub.",
          proposalId,
        };
      },
    );
  } catch (error) {
    return { ok: false, message: publishingFailure(error) };
  }
}

export const PerformanceFixService = { prepare };
