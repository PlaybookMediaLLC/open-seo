import { sort } from "remeda";
import { priorityFor } from "@/server/features/opportunities/services/detectors/scoreCandidate";
import {
  bounded,
  metrics,
} from "@/server/features/opportunities/services/detectors/shared";
import type { GscSearchAnalyticsRow } from "@/server/lib/gscClient";
import type { OpportunityCandidate } from "@/types/schemas/opportunities";

// RFC-0017 5.3: three docs detectors over 28 days of data.
const MIN_SEARCHES = 20;
const MIN_IMPRESSIONS = 500;
const MAX_POSITION = 10;
const LOW_CTR_SHARE = 0.5;
// The docs median CTR at a position needs 3 docs pages there with 100+
// impressions each.
const CURVE_MIN_IMPRESSIONS = 100;
const CURVE_MIN_PAGES = 3;
const MIN_VIEWS = 500;
const STALE_DAYS = 365;
/** Commit dates are read for this many of the most-viewed docs pages. */
export const COMMIT_READS = 50;
const CONFIDENCE = 0.5;
const NEUTRAL = 0.5;
const DAY_MS = 86_400_000;

const STOP_WORDS = new Set(
  "a an and are can do does for from how i in is it my of on or the to what when where which with you your".split(
    " ",
  ),
);
/**
 * ponytail: plural, -ing and -ed endings, then a final e, so "keys" is "key"
 * and "rotating" is "rotate". Use a real stemmer if matches miss.
 */
const stem = (word: string) =>
  word.length <= 3
    ? word
    : word
        .replace(/(?<=s|x|z|ch|sh)es$|(?<!s)s$/, "")
        .replace(/(?:ing|ed)$/, "")
        .replace(/e$/, "");
const tokensOf = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((word) => word && !STOP_WORDS.has(word))
      .map(stem),
  );
const pathKey = (path: string) => path.replace(/\/+$/, "") || "/";
const percent = (value: number) => `${Math.round(value * 1000) / 10}%`;
function median(values: number[]) {
  const sorted = sort(values, (a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export type DocsPage = {
  filePath: string;
  urlPath: string;
  title: string | null;
  headings: string[];
};

/** Indexed docs pages with 500 or more views, most viewed first. */
export function viewedDocsPages(
  pages: DocsPage[],
  views: Array<{ path: string; views: number }>,
) {
  const byPath = new Map(pages.map((page) => [pathKey(page.urlPath), page]));
  const totals = new Map<DocsPage, number>();
  for (const row of views) {
    const page = byPath.get(pathKey(row.path));
    if (page) totals.set(page, (totals.get(page) ?? 0) + row.views);
  }
  return sort(
    [...totals].filter(([, count]) => count >= MIN_VIEWS),
    ([, a], [, b]) => b - a,
  )
    .slice(0, COMMIT_READS)
    .map(([page, count]) => ({ page, views: count }));
}

function candidate(
  type: Extract<OpportunityCandidate["type"], `docs_${string}`>,
  url: string,
  query: string | null,
  facts: {
    title: string;
    explanation: string;
    recommendedAction: string;
    demand: number;
    demandRule: string;
    visibility: number;
    visibilityRule: string;
    effortHours: number;
    evidence?: OpportunityCandidate["evidence"];
  },
): OpportunityCandidate {
  const scores = {
    commercialScore: NEUTRAL,
    demandScore: bounded(Math.log10(1 + facts.demand) / 4),
    visibilityScore: bounded(facts.visibility),
    difficultyScore: NEUTRAL,
    effortScore: bounded(1 / facts.effortHours),
  };
  const priority = priorityFor(CONFIDENCE, scores);
  return {
    type,
    url,
    query,
    title: facts.title,
    explanation: facts.explanation,
    recommendedAction: facts.recommendedAction,
    searchIntent: "Not applicable; docs evidence",
    confidence: CONFIDENCE,
    effortHours: facts.effortHours,
    priority,
    ...scores,
    scoreExplanation: `Priority = round(100 × confidence ${CONFIDENCE} × (0.30 × commercial ${NEUTRAL} + 0.25 × demand ${scores.demandScore} + 0.20 × visibility ${scores.visibilityScore} + 0.15 × (1 - difficulty ${NEUTRAL}) + 0.10 × inverse effort ${scores.effortScore})) = ${priority}. Commercial and difficulty are a neutral ${NEUTRAL}, because a docs page has no page role or ranking target. Demand = ${facts.demandRule}. Visibility = ${facts.visibilityRule}. Effort is an estimate of ${facts.effortHours} hours.`,
    uncertainty:
      "GA4 and Search Console report samples and rounded numbers. Product changes and launches also move docs searches and traffic. Priority is a review heuristic.",
    diagnosis: null,
    evidence: facts.evidence ?? [],
    urls: [],
    ga4: [],
  };
}

export function detectDocsProblems(input: {
  /** The docs home URL, such as "https://example.com/docs/". */
  docsRoot: string;
  pages: DocsPage[];
  /** Null without GA4. */
  searches: Array<{ term: string; searches: number }> | null;
  gscPages: GscSearchAnalyticsRow[];
  /** The most-viewed docs pages, with the date of their last commit. */
  viewed: Array<{ page: DocsPage; views: number; lastChanged: string | null }>;
  now: Date;
}): OpportunityCandidate[] {
  const found: OpportunityCandidate[] = [];
  const docsPath = pathKey(new URL(input.docsRoot).pathname);
  const docsUrl = (page: DocsPage) =>
    new URL(page.urlPath, input.docsRoot).href;

  // docs_search_gap: the same words count once, under the most-searched term.
  const texts = input.pages
    .flatMap((page) => [page.title ?? "", ...page.headings])
    .map(tokensOf);
  const terms = new Map<string, { term: string; top: number; total: number }>();
  for (const row of input.searches ?? []) {
    const tokens = tokensOf(row.term);
    if (
      !tokens.size ||
      texts.some((text) => [...tokens].every((token) => text.has(token)))
    )
      continue;
    const key = sort([...tokens], (a, b) => a.localeCompare(b)).join(" ");
    const group = terms.get(key) ?? { term: row.term, top: 0, total: 0 };
    if (row.searches > group.top)
      Object.assign(group, { term: row.term, top: row.searches });
    group.total += row.searches;
    terms.set(key, group);
  }
  for (const { term, total } of terms.values())
    if (total >= MIN_SEARCHES)
      found.push(
        candidate("docs_search_gap", input.docsRoot, term, {
          title: `Answer "${term}" in the docs`,
          explanation: `Visitors searched the site for "${term}" ${total} times in the last 28 days. No docs title or heading contains its words.`,
          recommendedAction:
            "Check what people want when they search this term. Add a section to the best docs page, or a new page, from verified sources only.",
          demand: total,
          demandRule: `min(1, log10(1 + ${total} searches) / 4)`,
          visibility: 1,
          visibilityRule: "1, because no docs title or heading matches",
          effortHours: 2,
        }),
      );

  // docs_page_underperforming: below page one, or a low CTR for its position.
  const docsRows = input.gscPages.flatMap((row) => {
    const url = row.keys?.[0] ?? "";
    const path = URL.parse(url)?.pathname;
    return path !== undefined &&
      (docsPath === "/" ||
        pathKey(path) === docsPath ||
        path.startsWith(`${docsPath}/`))
      ? [{ ...row, url }]
      : [];
  });
  const byPosition = new Map<number, number[]>();
  for (const row of docsRows)
    if (row.impressions >= CURVE_MIN_IMPRESSIONS) {
      const position = Math.round(row.position);
      byPosition.set(position, [...(byPosition.get(position) ?? []), row.ctr]);
    }
  for (const row of docsRows) {
    if (row.impressions < MIN_IMPRESSIONS) continue;
    const position = Math.round(row.position * 10) / 10;
    const evidence = [
      { period: "current" as const, url: "", query: "", metrics: metrics(row) },
    ];
    const peers = byPosition.get(Math.round(row.position)) ?? [];
    const ctrMedian = peers.length >= CURVE_MIN_PAGES ? median(peers) : null;
    if (row.position > MAX_POSITION)
      found.push(
        candidate("docs_page_underperforming", row.url, null, {
          title: "Improve a docs page that ranks below page one",
          explanation: `The page had ${row.impressions} Search Console impressions in the last 28 days at an average position of ${position}.`,
          recommendedAction:
            "Check which searches show the page. Make its title and headings answer them, from verified sources only.",
          demand: row.impressions,
          demandRule: `min(1, log10(1 + ${row.impressions} impressions) / 4)`,
          visibility: (row.position - MAX_POSITION) / MAX_POSITION,
          visibilityRule: `min(1, (position ${position} - 10) / 10)`,
          effortHours: 1,
          evidence,
        }),
      );
    else if (ctrMedian && row.ctr <= LOW_CTR_SHARE * ctrMedian)
      found.push(
        candidate("docs_page_underperforming", row.url, null, {
          title: "Improve the title of a docs page that few searchers click",
          explanation: `The page had ${row.impressions} impressions at position ${position} and a click-through rate of ${percent(row.ctr)}. Docs pages at that position get a median of ${percent(ctrMedian)}.`,
          recommendedAction:
            "Rewrite the page title and description so they match the searches that show the page.",
          demand: row.impressions,
          demandRule: `min(1, log10(1 + ${row.impressions} impressions) / 4)`,
          visibility: 1 - row.ctr / ctrMedian,
          visibilityRule: `1 - page CTR ${percent(row.ctr)} / docs median ${percent(ctrMedian)}`,
          effortHours: 1,
          evidence,
        }),
      );
  }

  // docs_stale_page: popular, and unchanged for 12 months or more.
  for (const { page, views, lastChanged } of input.viewed) {
    if (!lastChanged) continue;
    const days = Math.floor(
      (input.now.getTime() - Date.parse(lastChanged)) / DAY_MS,
    );
    if (views < MIN_VIEWS || days < STALE_DAYS) continue;
    found.push(
      candidate("docs_stale_page", docsUrl(page), null, {
        title: "Review a popular docs page that has not changed in a year",
        explanation: `The page had ${views} views in the last 28 days. Its file ${page.filePath} last changed on ${lastChanged.slice(0, 10)}, ${days} days ago.`,
        recommendedAction:
          "Check the page against the current product and the changelog. Fix what changed, from verified sources only.",
        demand: views,
        demandRule: `min(1, log10(1 + ${views} views) / 4)`,
        visibility: days / (2 * STALE_DAYS),
        visibilityRule: `min(1, ${days} days since the last change / ${2 * STALE_DAYS})`,
        effortHours: 2,
      }),
    );
  }
  return sort(found, (a, b) => b.priority - a.priority).slice(0, 50);
}
