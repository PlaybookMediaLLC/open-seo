import { sort } from "remeda";

// RFC-0010 5.5 to 5.8: compare a preview page with production. Pure, so
// each rule has a positive and a negative test.

export type PageFacts = {
  title: string;
  description: string;
  canonical: string | null;
  robots: string | null;
  h1s: string[];
  internalLinks: string[];
  ogTitle: string | null;
  ogImage: string | null;
  hreflang: string[];
  words: number;
  jsonLd: Array<{ parses: boolean; types: string[] }>;
};

export type Snapshot = {
  /** The first response's status; null when the request failed. */
  status: number | null;
  redirected: boolean;
  robotsHeader: string | null;
  page: PageFacts | null;
};

export type Finding = {
  path: string;
  rule: string;
  severity: "blocking" | "warning";
  before: string | null;
  after: string | null;
  message: string;
};

type Context = {
  path: string;
  baseOrigin: string;
  previewOrigin: string;
  /** 5.5: platforms add noindex to previews, so the header is opt-in. */
  checkRobotsHeader: boolean;
};

const clip = (value: string | null | undefined) =>
  value ? value.slice(0, 300) : null;
const squash = (value: string | null | undefined) =>
  (value ?? "").replace(/\s+/g, " ").trim();
const noindex = (value: string | null | undefined) =>
  /(^|[\s,])(noindex|none)($|[\s,])/i.test(value ?? "");

/** 5.5: the preview origin becomes production's; only the path counts. */
function normalizeUrl(value: string | null, context: Context) {
  if (!value) return null;
  try {
    const url = new URL(value, context.previewOrigin);
    const origin =
      url.origin === context.previewOrigin ? context.baseOrigin : url.origin;
    return `${origin}${url.pathname.replace(/\/+$/, "") || "/"}`;
  } catch {
    return value;
  }
}

export function comparePage(
  base: Snapshot,
  preview: Snapshot,
  context: Context,
): Finding[] {
  const findings: Finding[] = [];
  const add = (
    rule: string,
    severity: Finding["severity"],
    message: string,
    before: string | null = null,
    after: string | null = null,
  ) =>
    findings.push({
      path: context.path,
      rule,
      severity,
      before: clip(before),
      after: clip(after),
      message,
    });
  if (base.status !== 200) return findings;
  if (preview.redirected)
    add("newly-redirected", "blocking", "The page now redirects.", "200");
  else if (preview.status !== null && preview.status >= 400)
    add(
      "status-regressed",
      "blocking",
      `The page now answers ${preview.status}.`,
      "200",
      String(preview.status),
    );
  const before = base.page;
  const after = preview.page;
  if (!before || !after) return findings;

  const previewNoindex =
    noindex(after.robots) ||
    (context.checkRobotsHeader && noindex(preview.robotsHeader));
  if (previewNoindex && !noindex(before.robots))
    add(
      "newly-noindex",
      "blocking",
      "The page now tells search engines not to index it.",
      before.robots,
      after.robots ?? preview.robotsHeader,
    );
  const canonicalBefore = normalizeUrl(before.canonical, context);
  const canonicalAfter = normalizeUrl(after.canonical, context);
  if (canonicalBefore && canonicalBefore !== canonicalAfter)
    add(
      "canonical-changed",
      "blocking",
      canonicalAfter
        ? "The canonical URL changed."
        : "The canonical tag was removed.",
      canonicalBefore,
      canonicalAfter,
    );
  const titleBefore = squash(before.title);
  const titleAfter = squash(after.title);
  if (titleBefore && !titleAfter)
    add("title-removed", "blocking", "The title was removed.", titleBefore);
  else if (titleBefore && titleAfter !== titleBefore)
    add(
      "title-changed",
      "warning",
      lengthNote("The title changed", titleAfter, 10, 60),
      titleBefore,
      titleAfter,
    );
  const descriptionBefore = squash(before.description);
  const descriptionAfter = squash(after.description);
  if (descriptionBefore && !descriptionAfter)
    add(
      "description-removed",
      "blocking",
      "The meta description was removed.",
      descriptionBefore,
    );
  else if (descriptionBefore && descriptionAfter !== descriptionBefore)
    add(
      "description-changed",
      "warning",
      lengthNote("The meta description changed", descriptionAfter, 70, 160),
      descriptionBefore,
      descriptionAfter,
    );

  const parsedBefore = before.jsonLd.filter((block) => block.parses);
  const parsedAfter = after.jsonLd.filter((block) => block.parses);
  const typesAfter = new Set(parsedAfter.flatMap((block) => block.types));
  const lostType = parsedBefore
    .flatMap((block) => block.types)
    .find((type) => !typesAfter.has(type));
  if (parsedAfter.length < parsedBefore.length || lostType)
    add(
      "json-ld-invalid",
      "blocking",
      lostType
        ? `Structured data of type ${lostType} disappeared or no longer parses.`
        : "A structured data block no longer parses.",
      `${parsedBefore.length} valid blocks`,
      `${parsedAfter.length} valid blocks`,
    );

  const h1Before = squash(before.h1s[0]);
  const h1After = squash(after.h1s[0]);
  if (h1Before !== h1After)
    add("h1-changed", "warning", "The H1 changed.", h1Before, h1After);
  if (after.h1s.length > 1 && before.h1s.length <= 1)
    add("multiple-h1", "warning", "The page now has more than one H1.");
  if (
    before.internalLinks.length >= 5 &&
    after.internalLinks.length <= before.internalLinks.length * 0.7
  )
    add(
      "internal-links-dropped",
      "warning",
      "Internal links on the page fell by 30% or more.",
      String(before.internalLinks.length),
      String(after.internalLinks.length),
    );
  const hreflang = (tags: string[]) =>
    sort([...new Set(tags)], (a, b) => a.localeCompare(b)).join(", ");
  if (hreflang(before.hreflang) !== hreflang(after.hreflang))
    add(
      "hreflang-changed",
      "warning",
      "The hreflang set changed.",
      hreflang(before.hreflang),
      hreflang(after.hreflang),
    );
  if ((before.ogTitle && !after.ogTitle) || (before.ogImage && !after.ogImage))
    add(
      "og-removed",
      "warning",
      "og:title or og:image was removed.",
      before.ogTitle ?? before.ogImage,
    );
  if (before.words >= 50 && after.words <= before.words * 0.5)
    add(
      "content-shrunk",
      "warning",
      "Visible text fell by 50% or more. This can mean client-only rendering.",
      `${before.words} words`,
      `${after.words} words`,
    );
  return findings;
}

function lengthNote(lead: string, text: string, min: number, max: number) {
  return text.length < min || text.length > max
    ? `${lead}. The new text has ${text.length} characters, outside ${min} to ${max}.`
    : `${lead}.`;
}

/** 5.6: the site-level rules on robots.txt and the sitemap. */
export function compareSite(input: {
  paths: string[];
  baseAllows: (path: string) => boolean;
  previewAllows: (path: string) => boolean;
  baseSitemapCount: number;
  previewSitemapCount: number;
}): Finding[] {
  const findings: Finding[] = input.paths
    .filter((path) => input.baseAllows(path) && !input.previewAllows(path))
    .map((path) => ({
      path,
      rule: "robots-txt-blocks",
      severity: "blocking",
      before: "allowed",
      after: "disallowed",
      message: "The preview robots.txt blocks Googlebot from this page.",
    }));
  if (
    input.baseSitemapCount > 0 &&
    input.previewSitemapCount < input.baseSitemapCount * 0.9
  )
    findings.push({
      path: "/sitemap.xml",
      rule: "sitemap-shrunk",
      severity: "blocking",
      before: `${input.baseSitemapCount} URLs`,
      after: `${input.previewSitemapCount} URLs`,
      message:
        input.previewSitemapCount === 0
          ? "The preview has no sitemap."
          : "The preview sitemap lists fewer than 90% of production's URLs.",
    });
  return findings;
}

type PageTraffic = {
  clicks: number;
  impressions: number;
  role: string | null;
};

/**
 * 5.7 and 5.8: findings on high-traffic pages can rise to blocking; ignore
 * rules drop findings by rule and path pattern.
 */
export function weigh(
  findings: Finding[],
  traffic: (path: string) => PageTraffic | undefined,
  options: {
    raiseOnHighTraffic: boolean;
    ignores: Array<{ rule: string; pathPattern: string }>;
  },
): Finding[] {
  const ignored = (finding: Finding) =>
    options.ignores.some(
      (ignore) =>
        ignore.rule === finding.rule &&
        new RegExp(
          `^${ignore.pathPattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*")}$`,
        ).test(finding.path),
    );
  return findings
    .filter((finding) => !ignored(finding))
    .map((finding) => {
      const page = traffic(finding.path);
      const high = (page?.impressions ?? 0) >= 1000 || page?.role === "money";
      return high &&
        options.raiseOnHighTraffic &&
        (finding.rule === "internal-links-dropped" ||
          finding.rule === "content-shrunk")
        ? { ...finding, severity: "blocking" as const }
        : finding;
    });
}
