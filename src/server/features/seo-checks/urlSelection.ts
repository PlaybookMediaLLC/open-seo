import { sortBy } from "remeda";
import type { CI_URL_REASONS } from "@/db/seo-checks.schema";
import { sha256Hex } from "@/server/lib/audit/ids";

// RFC-0010 5.3: at most 100 URLs per run, each with the reason it was
// chosen. The first reason wins when a path qualifies twice.
type Reason = (typeof CI_URL_REASONS)[number];
const MAX_URLS = 100;
const DYNAMIC_MATCHES = 5;
const TOP_TRAFFIC = 30;
const SAMPLE = 10;

const ROUTE_FILE =
  /^(?:src\/)?(app|pages)\/(.*?)(?:\/)?(page|layout|index)?\.(tsx|ts|jsx|js|mdx)$/;

/**
 * App Router and Pages Router files to URL path patterns. Route groups,
 * parallel routes and private folders drop out; dynamic segments become
 * wildcards. Other frameworks' files map to nothing.
 */
export function routePatterns(changedFiles: string[]) {
  const patterns = new Map<string, string>();
  for (const file of changedFiles) {
    const match = file.match(ROUTE_FILE);
    if (!match) continue;
    const [, router, rest = "", leaf] = match;
    if (router === "app" && leaf !== "page" && leaf !== "layout") continue;
    const segments = rest
      .split("/")
      .filter(Boolean)
      .filter(
        (segment) =>
          !/^\(.*\)$/.test(segment) &&
          !segment.startsWith("@") &&
          !segment.startsWith("_"),
      );
    if (router === "pages" && (segments[0] === "api" || rest.startsWith("_")))
      continue;
    const pattern = `/${segments
      .map((segment) => (/^\[.*\]$/.test(segment) ? "*" : segment))
      .join("/")}`;
    if (!patterns.has(pattern)) patterns.set(pattern, file);
  }
  return [...patterns];
}

const rank = (role: string) => (role === "money" ? 0 : role === "hub" ? 1 : 2);

const pathOf = (url: string) => {
  try {
    return new URL(url).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return null;
  }
};

/** A pattern's concrete paths: itself, or up to 5 sitemap matches. */
function expand(pattern: string, sitemapPaths: string[]) {
  if (!pattern.includes("*")) return [pattern];
  const regex = new RegExp(
    `^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", "[^/]+")}$`,
  );
  return sitemapPaths
    .filter((path) => regex.test(path))
    .slice(0, DYNAMIC_MATCHES);
}

export async function selectUrls(input: {
  changedFiles: string[];
  keyPages: Array<{ url: string; role: string }>;
  topPages: Array<{ url: string; clicks: number }>;
  sitemapUrls: string[];
  headSha: string;
}) {
  const sitemapPaths = input.sitemapUrls.flatMap((url) => pathOf(url) ?? []);
  const chosen = new Map<string, { reason: Reason; file?: string }>();
  const add = (paths: string[], reason: Reason, file?: string) => {
    for (const path of paths)
      if (chosen.size < MAX_URLS && !chosen.has(path))
        chosen.set(path, { reason, file });
  };
  for (const [pattern, file] of routePatterns(input.changedFiles))
    add(expand(pattern, sitemapPaths), "changed_file", file);
  add(
    sortBy(input.keyPages, (page) => rank(page.role)).flatMap(
      (page) => pathOf(page.url) ?? [],
    ),
    "key_page",
  );
  add(
    sortBy(input.topPages, [(page) => page.clicks, "desc"])
      .slice(0, TOP_TRAFFIC)
      .flatMap((page) => pathOf(page.url) ?? []),
    "top_traffic",
  );
  // The head SHA seeds the sample, so a re-run checks the same pages.
  const seeded = await Promise.all(
    sitemapPaths.map(async (path) => ({
      path,
      key: await sha256Hex(`${input.headSha}:${path}`),
    })),
  );
  add(
    sortBy(seeded, (entry) => entry.key)
      .filter((entry) => !chosen.has(entry.path))
      .slice(0, SAMPLE)
      .map((entry) => entry.path),
    "sitemap_sample",
  );
  return [...chosen].map(([path, entry]) => ({ path, ...entry }));
}
