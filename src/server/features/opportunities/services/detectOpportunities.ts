import { sort } from "remeda";
import { buildStrikingDistanceRows } from "@/server/features/gsc/searchPerformanceReport";
import type { GscSearchAnalyticsRow } from "@/server/lib/gscClient";
import type {
  OpportunityCandidate,
  OpportunityMetrics,
} from "@/types/schemas/opportunities";

type DetectionInput = {
  queryPages: GscSearchAnalyticsRow[];
  currentPages: GscSearchAnalyticsRow[];
  previousPages: GscSearchAnalyticsRow[];
  keyPages: Array<{ url: string; role: string }>;
  truncated: boolean;
};

function usableRow(row: GscSearchAnalyticsRow, pageIndex: number): boolean {
  if (
    ![row.clicks, row.impressions, row.ctr, row.position].every(
      (value) => Number.isFinite(value) && value >= 0,
    ) ||
    !Number.isInteger(row.clicks) ||
    !Number.isInteger(row.impressions) ||
    row.clicks > row.impressions ||
    row.ctr > 1
  )
    return false;
  const page = row.keys?.[pageIndex];
  if (!page || page !== page.trim()) return false;
  if (pageIndex === 1 && !row.keys?.[0]?.trim()) return false;
  try {
    const url = new URL(page);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function metrics(row: GscSearchAnalyticsRow): OpportunityMetrics {
  return {
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  };
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function bounded(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 10_000) / 10_000;
}

/** Pure evidence shaping. No collection, writes, or inferred search intent. */
export function detectOpportunities(
  input: DetectionInput,
): OpportunityCandidate[] {
  const candidates: OpportunityCandidate[] = [];
  const roles = new Map(input.keyPages.map((page) => [page.url, page.role]));
  function candidate(
    type: OpportunityCandidate["type"],
    url: string,
    query: string | null,
    current: OpportunityMetrics,
    previous: OpportunityMetrics | null,
  ): OpportunityCandidate {
    const decline = type === "declining_page";
    const role = roles.get(url);
    const commercialScore =
      role === "money"
        ? 1
        : role === "hub"
          ? 0.7
          : role === "spoke" || role === "other"
            ? 0.5
            : 0.25;
    const demandScore = bounded(Math.log10(1 + current.impressions) / 5);
    const lostClicks = previous ? previous.clicks - current.clicks : 0;
    const visibilityScore = bounded(
      previous ? lostClicks / previous.clicks : (current.position - 4) / 16,
    );
    // Existing average position is only a difficulty proxy, not keyword difficulty.
    const difficultyScore = bounded((current.position - 1) / 19);
    const effortHours = decline ? 4 : 2;
    const effortScore = 1 / effortHours;
    const confidence = decline
      ? input.truncated
        ? 0.35
        : 0.5
      : input.truncated
        ? 0.45
        : 0.65;
    const priority = Math.round(
      100 *
        confidence *
        (0.3 * commercialScore +
          0.25 * demandScore +
          0.2 * visibilityScore +
          0.15 * (1 - difficultyScore) +
          0.1 * effortScore),
    );
    return {
      type,
      url,
      query,
      title: decline
        ? "Review declining organic clicks"
        : "Review a striking-distance query",
      explanation: decline
        ? `Observed clicks fell from ${previous!.clicks} to ${current.clicks} (${lostClicks} fewer) for the same page across the compared periods.`
        : `The best observed page for this query ranks at average position ${current.position}, with ${current.impressions} impressions.`,
      recommendedAction: decline
        ? "Review page changes, query mix, indexing and the SERP before proposing a recovery action."
        : "Review query relevance, the SERP, page content and internal links before proposing an improvement.",
      searchIntent: "Unverified; review query and SERP",
      confidence,
      effortHours,
      priority,
      commercialScore,
      demandScore,
      visibilityScore,
      difficultyScore,
      effortScore,
      scoreExplanation: `Priority = round(100 × confidence ${confidence} × (0.30 × commercial ${commercialScore} + 0.25 × demand ${demandScore} + 0.20 × visibility ${visibilityScore} + 0.15 × (1 - difficulty ${difficultyScore}) + 0.10 × inverse effort ${effortScore})) = ${priority}. Commercial uses the saved page role (${role ?? "unknown"}). Demand = min(1, log10(1 + impressions) / 5). Visibility is ${decline ? "the observed click-loss fraction" : "(position - 4) / 16"}, clamped to [0,1]. Difficulty = (position - 1) / 19, clamped to [0,1], an existing-rank proxy. Effort is an estimate of ${effortHours} hours.`,
      uncertainty: `Brand, SERP, seasonality and underlying demand changes are not verified. Priority is a review heuristic, not a traffic or revenue forecast.${input.truncated ? " Source rows are truncated, so coverage and confidence are limited." : " Bounded source rows may omit queries or pages."}`,
      current,
      previous,
    };
  }

  // Stable ordering makes equal-position/equal-impression best-page ties independent
  // of provider row order. Apply the demand threshold after best-page selection.
  const queryPages = sort(
    input.queryPages.filter((row) => usableRow(row, 1)),
    (a, b) =>
      compareText(a.keys![1], b.keys![1]) ||
      compareText(a.keys![0], b.keys![0]),
  );
  const bestRows = buildStrikingDistanceRows(queryPages, queryPages.length);
  for (const row of bestRows) {
    if (row.impressions < 100) continue;
    const source = queryPages.find(
      (entry) => entry.keys![0] === row.query && entry.keys![1] === row.page,
    )!;
    candidates.push(
      candidate(
        "striking_distance",
        row.page,
        row.query,
        metrics(source),
        null,
      ),
    );
  }

  const previousPages = new Map(
    input.previousPages
      .filter((row) => usableRow(row, 0))
      .map((row) => [row.keys![0], row]),
  );
  for (const current of input.currentPages.filter((row) => usableRow(row, 0))) {
    const url = current.keys![0];
    const previous = previousPages.get(url);
    if (!previous || previous.clicks < 30) continue;
    const loss = previous.clicks - current.clicks;
    if (loss < 20 || loss / previous.clicks < 0.3) continue;
    candidates.push(
      candidate(
        "declining_page",
        url,
        null,
        metrics(current),
        metrics(previous),
      ),
    );
  }

  return sort(
    candidates,
    (a, b) =>
      b.priority - a.priority ||
      compareText(a.url, b.url) ||
      compareText(a.query ?? "", b.query ?? "") ||
      compareText(a.type, b.type),
  ).slice(0, 50);
}
