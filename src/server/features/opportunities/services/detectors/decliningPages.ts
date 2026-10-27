import type {
  OpportunityCandidate,
  OpportunityDiagnosis,
  OpportunityMetrics,
} from "@/types/schemas/opportunities";
import { scoreCandidate, type ScoringContext } from "./scoreCandidate";
import { bounded, metrics, usableRow, type DetectionInput } from "./shared";

const MIN_PREVIOUS_CLICKS = 30;
const MIN_LOST_CLICKS = 20;
const MIN_LOST_SHARE = 0.3;
const SEASONAL_SHARE = 0.7;
const SEASONAL_CONFIDENCE_FACTOR = 0.6;
const RANKING_DROP_POSITIONS = 2;
const CTR_DROP_MAX_IMPRESSION_CHANGE = 0.15;
const CTR_DROP_SHARE = 0.3;
const DEMAND_DROP_SHARE = 0.3;
const DEMAND_DROP_MAX_POSITION_CHANGE = 1;

const DIAGNOSIS_TEXT: Record<OpportunityDiagnosis, string> = {
  seasonal:
    "The same page lost a similar number of clicks over the same weeks last year, so this decline may be seasonal.",
  ranking_drop: "The page's average position became worse by 2 or more.",
  ctr_drop:
    "Impressions stayed about the same, but the click-through rate fell by 30% or more.",
  demand_drop:
    "Impressions fell by 30% or more while the position stayed about the same, so search demand may have dropped.",
  mixed:
    "More than one cause matches: a ranking drop, a click-through-rate drop or a demand drop.",
  unknown: "No single cause matches the Search Console numbers.",
};

function diagnose(
  current: OpportunityMetrics,
  previous: OpportunityMetrics,
  yearAgo: OpportunityMetrics | null,
  yearAgoPrevious: OpportunityMetrics | null,
): OpportunityDiagnosis {
  const loss = previous.clicks - current.clicks;
  if (
    yearAgo &&
    yearAgoPrevious &&
    yearAgoPrevious.clicks - yearAgo.clicks >= SEASONAL_SHARE * loss
  )
    return "seasonal";
  const impressionChange =
    (current.impressions - previous.impressions) / previous.impressions;
  const positionChange = current.position - previous.position;
  const matches = [
    positionChange >= RANKING_DROP_POSITIONS && "ranking_drop",
    Math.abs(impressionChange) < CTR_DROP_MAX_IMPRESSION_CHANGE &&
      (previous.ctr - current.ctr) / previous.ctr >= CTR_DROP_SHARE &&
      "ctr_drop",
    -impressionChange >= DEMAND_DROP_SHARE &&
      Math.abs(positionChange) < DEMAND_DROP_MAX_POSITION_CHANGE &&
      "demand_drop",
  ].filter((match): match is OpportunityDiagnosis => Boolean(match));
  return matches.length > 1 ? "mixed" : (matches[0] ?? "unknown");
}

function pageRows(rows: DetectionInput["currentPages"]) {
  return new Map(
    rows
      .filter((row) => usableRow(row, 0))
      .map((row) => [row.keys[0], metrics(row)]),
  );
}

/** The same URL lost 20+ clicks and 30%+ of 30+ previous clicks. */
export function decliningPages(
  input: DetectionInput,
  context: ScoringContext,
): OpportunityCandidate[] {
  const previousPages = pageRows(input.previousPages);
  const yearAgoPages = pageRows(input.yearAgoPages);
  const yearAgoPreviousPages = pageRows(input.yearAgoPreviousPages);
  const candidates: OpportunityCandidate[] = [];
  for (const [url, current] of pageRows(input.currentPages)) {
    const previous = previousPages.get(url);
    if (!previous || previous.clicks < MIN_PREVIOUS_CLICKS) continue;
    const loss = previous.clicks - current.clicks;
    if (loss < MIN_LOST_CLICKS || loss / previous.clicks < MIN_LOST_SHARE)
      continue;
    const yearAgo = yearAgoPages.get(url) ?? null;
    const yearAgoPrevious = yearAgoPreviousPages.get(url) ?? null;
    const diagnosis = diagnose(current, previous, yearAgo, yearAgoPrevious);
    const periods = [
      ["current", current],
      ["previous", previous],
      ["year_ago", yearAgo],
      ["year_ago_previous", yearAgoPrevious],
    ] as const;
    candidates.push({
      type: "declining_page",
      url,
      query: null,
      title: "Review declining organic clicks",
      explanation: `Observed clicks fell from ${previous.clicks} to ${current.clicks} (${loss} fewer) for the same page across the compared periods. ${DIAGNOSIS_TEXT[diagnosis]}`,
      recommendedAction:
        "Review page changes, query mix, indexing and the SERP before proposing a recovery action.",
      searchIntent: "Unverified; review query and SERP",
      diagnosis,
      ...scoreCandidate(context, {
        type: "declining_page",
        url,
        query: null,
        position: current.position,
        demandImpressions: current.impressions,
        visibilityScore: bounded(loss / previous.clicks),
        visibilityRule: "the observed click-loss fraction",
        confidenceFactor:
          diagnosis === "seasonal" ? SEASONAL_CONFIDENCE_FACTOR : undefined,
        uncertainty:
          "The diagnosis is a rule of thumb from Search Console totals. SERP layout and page changes are not verified.",
      }),
      evidence: periods.flatMap(([period, values]) =>
        values ? [{ period, url: "", query: "", metrics: values }] : [],
      ),
      urls: [],
    });
  }
  return candidates;
}
