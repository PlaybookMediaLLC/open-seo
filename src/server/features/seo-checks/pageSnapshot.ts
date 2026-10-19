import { Parser } from "htmlparser2";
import { readTextUpTo } from "@/server/lib/audit/html-response";
import { analyzeHtml } from "@/server/lib/audit/page-analyzer";
import { normalizeAndValidateStartUrl } from "@/server/lib/audit/url-policy";
import { crawlerHeadersFor, type CrawlerAccess } from "@/shared/crawler-access";
import type { PageFacts, Snapshot } from "./seoRules";
import { readSecurityHeaders } from "./securityRules";

// RFC-0010 5.4: one request per page and host. A redirect is itself a
// finding and the rules need production's 200, so hops are not followed;
// each URL costs at most 2 page requests.
const USER_AGENT =
  "RelaySEOCheck/1.0 (+https://relay.playbookmedia.io/docs/seo-checks)";
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;

const failed: Snapshot = {
  status: null,
  redirected: false,
  robotsHeader: null,
  page: null,
};

const list = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) return [value];
  const items: unknown[] = value;
  return items;
};
const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null
    ? Reflect.get(value, key)
    : undefined;

/** Top-level JSON-LD blocks: whether each parses, and its @type values. */
function jsonLdBlocks(html: string) {
  const blocks: string[] = [];
  let current: string | null = null;
  const parser = new Parser({
    onopentag(name, attributes) {
      if (name === "script" && attributes.type === "application/ld+json")
        current = "";
    },
    ontext(text) {
      if (current !== null) current += text;
    },
    onclosetag(name) {
      if (name === "script" && current !== null) {
        blocks.push(current);
        current = null;
      }
    },
  });
  parser.write(html);
  parser.end();
  return blocks.map((text) => {
    try {
      const items = list(JSON.parse(text));
      const graph = items.flatMap((item) => {
        const nested = field(item, "@graph");
        return nested === undefined ? [item] : [item, ...list(nested)];
      });
      const types = graph.flatMap((item) => {
        return list(field(item, "@type")).filter(
          (entry): entry is string => typeof entry === "string",
        );
      });
      return { parses: true, types };
    } catch {
      return { parses: false, types: [] };
    }
  });
}

const pathOf = (url: string) => {
  try {
    return new URL(url).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return null;
  }
};

/** The facts the rules compare, from raw or rendered HTML. */
export function pageFacts(
  html: string,
  url: string,
  status: number,
): PageFacts {
  const analysis = analyzeHtml(html, url, status, 0);
  return {
    title: analysis.title,
    description: analysis.metaDescription,
    canonical: analysis.canonical,
    robots: analysis.robotsMeta,
    h1s: analysis.h1s,
    internalLinks: analysis.links
      .filter((link) => link.isInternal)
      .flatMap((link) => pathOf(link.targetUrl) ?? []),
    ogTitle: analysis.ogTitle,
    ogImage: analysis.ogImage,
    hreflang: analysis.hreflangTags,
    words: analysis.wordCount,
    jsonLd: jsonLdBlocks(html),
    shell: analysis.javascriptShell === true,
  };
}

export async function fetchSnapshot(
  url: string,
  access: CrawlerAccess | null,
): Promise<Snapshot> {
  try {
    await normalizeAndValidateStartUrl(url);
    const response = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT, ...crawlerHeadersFor(url, access) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const snapshot: Snapshot = {
      status: response.status,
      redirected: response.status >= 300 && response.status < 400,
      robotsHeader: response.headers.get("x-robots-tag"),
      security: readSecurityHeaders(response.headers),
      page: null,
    };
    const html = response.headers.get("content-type")?.includes("text/html");
    if (response.status !== 200 || !html) {
      await response.body?.cancel();
      return snapshot;
    }
    const text = await readTextUpTo(response, MAX_BYTES);
    return { ...snapshot, page: pageFacts(text, url, response.status) };
  } catch {
    return failed;
  }
}

/** 5.6: the status of a link that is new on the preview. */
export async function linkStatus(url: string, access: CrawlerAccess | null) {
  try {
    await normalizeAndValidateStartUrl(url);
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT, ...crawlerHeadersFor(url, access) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return response.status;
  } catch {
    return null;
  }
}
