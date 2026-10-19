import type { Finding, PageFacts } from "./seoRules";

// RFC-0015 5.3: the links and assets pack, beyond broken new links. Only
// what the pull request adds is reported.
const MAX_PER_RULE = 5;
const GROWTH = 1.25;
const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;
/** The subresources whose size counts toward the page's weight. */
export const WEIGHED = new Set(["image", "script", "style"]);

/** Subresources on the preview that production does not load. */
function newAssets(base: PageFacts | null, preview: PageFacts | null) {
  const known = new Set((base?.assets ?? []).map((asset) => asset.url));
  return (preview?.assets ?? []).filter((asset) => !known.has(asset.url));
}

/** A new http: subresource on an https: page blocks: browsers refuse it. */
export function mixedContent(
  base: PageFacts | null,
  preview: PageFacts | null,
  context: { path: string; previewOrigin: string },
): Finding[] {
  if (!context.previewOrigin.startsWith("https:")) return [];
  return newAssets(base, preview)
    .filter((asset) => asset.url.startsWith("http:"))
    .slice(0, MAX_PER_RULE)
    .map((asset) => ({
      path: context.path,
      rule: "mixed-content",
      pack: "links",
      severity: "blocking",
      before: null,
      after: asset.url,
      message: `The page loads a ${asset.kind} over http:, which browsers block on an https: page.`,
    }));
}

/** New images over the budget, and a page that grew by 25% or more. */
export function assetWeight(
  base: PageFacts | null,
  preview: PageFacts | null,
  sizes: Map<string, number | null>,
  context: { path: string; imageMaxKb: number },
): Finding[] {
  const findings: Finding[] = [];
  for (const asset of newAssets(base, preview)) {
    const size = sizes.get(asset.url);
    if (asset.kind !== "image" || !size || size <= context.imageMaxKb * 1024)
      continue;
    if (findings.length >= MAX_PER_RULE) break;
    findings.push({
      path: context.path,
      rule: "image-too-large",
      pack: "links",
      severity: "warning",
      before: null,
      after: `${asset.url} (${kb(size)})`,
      message: `A new image is larger than ${context.imageMaxKb} KB.`,
    });
  }
  // The weight compares only when every subresource of both pages has a
  // measured size, so a skipped request cannot look like a growth.
  const weight = (page: PageFacts | null) => {
    if (!page?.bytes) return null;
    let total = page.bytes;
    for (const asset of page.assets ?? []) {
      if (!WEIGHED.has(asset.kind)) continue;
      if (!sizes.has(asset.url)) return null;
      total += sizes.get(asset.url) ?? 0;
    }
    return total;
  };
  const before = weight(base);
  const after = weight(preview);
  if (before && after && after >= before * GROWTH)
    findings.push({
      path: context.path,
      rule: "page-weight-grew",
      pack: "links",
      severity: "warning",
      before: kb(before),
      after: kb(after),
      message: `The page's transfer size grew by ${Math.round((after / before - 1) * 100)}%.`,
    });
  return findings;
}
