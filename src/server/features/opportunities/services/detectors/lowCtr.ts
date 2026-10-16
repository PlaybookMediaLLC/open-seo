import { sort } from "remeda";
import type { GscSearchAnalyticsRow } from "@/server/lib/gscClient";
import type {
  OpportunityCandidate,
  OpportunityMetrics,
} from "@/types/schemas/opportunities";
import { scoreCandidate, type ScoringContext } from "./scoreCandidate";
import {
  bounded,
  compareText,
  metrics,
  totals,
  urlJoinKey,
  type DetectionInput,
} from "./shared";

const CURVE_MIN_ROWS = 5;
const CURVE_MIN_IMPRESSIONS = 100;
const MIN_PAGE_IMPRESSIONS = 500;
const MAX_OBSERVED_SHARE = 0.6;
const MIN_MISSING_CLICKS = 20;
const EVIDENCE_QUERIES = 5;

function median(values: number[]): number {
  const sorted = sort(values, (a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * The site's own click-through curve: the median CTR at each rounded position
 * from 1 to 10 that has enough rows with 100+ impressions. No external benchmark.
 */
function clickThroughCurve(rows: GscSearchAnalyticsRow[]): Map<number, number> {
  const byPosition = new Map<number, number[]>();
  for (const row of rows) {
    const position = Math.round(row.position);
    if (position < 1 || position > 10) continue;
    if (row.impressions < CURVE_MIN_IMPRESSIONS) continue;
    const ctrs = byPosition.get(position) ?? [];
    ctrs.push(row.ctr);
    byPosition.set(position, ctrs);
  }
  const curve = new Map<number, number>();
  for (const [position, ctrs] of byPosition)
    if (ctrs.length >= CURVE_MIN_ROWS) curve.set(position, median(ctrs));
  return curve;
}

/** A page gets 60% or less of the clicks the site's own curve predicts. */
export function lowCtr(
  nonBrandedQueryPages: GscSearchAnalyticsRow[],
  pageMetrics: Map<string, OpportunityMetrics>,
  context: ScoringContext,
  serpChecks: DetectionInput["serpChecks"],
): OpportunityCandidate[] {
  const curve = clickThroughCurve(nonBrandedQueryPages);
  const pages = new Map<string, GscSearchAnalyticsRow[]>();
  for (const row of nonBrandedQueryPages) {
    if (!curve.has(Math.round(row.position))) continue;
    const rows = pages.get(row.keys![1]) ?? [];
    rows.push(row);
    pages.set(row.keys![1], rows);
  }
  const candidates: OpportunityCandidate[] = [];
  for (const [url, rows] of pages) {
    const sum = totals(rows.map(metrics));
    const expected = rows.reduce(
      (total, row) =>
        total + row.impressions * curve.get(Math.round(row.position))!,
      0,
    );
    if (
      sum.impressions < MIN_PAGE_IMPRESSIONS ||
      sum.clicks / expected > MAX_OBSERVED_SHARE ||
      expected - sum.clicks < MIN_MISSING_CLICKS
    )
      continue;
    const topQueries = sort(
      rows,
      (a, b) =>
        b.impressions - a.impressions || compareText(a.keys![0], b.keys![0]),
    ).slice(0, EVIDENCE_QUERIES);
    candidates.push({
      type: "low_ctr",
      url,
      query: null,
      title: "Review a page with low click-through",
      explanation: `This page got ${sum.clicks} clicks from ${sum.impressions} non-branded impressions in positions 1 to 10. Pages on this site at the same positions got about ${Math.round(expected)} clicks.`,
      recommendedAction:
        "Check the live search results. Then rewrite the title and description for the main queries.",
      searchIntent: "Unverified; review query and SERP",
      diagnosis: null,
      ...scoreCandidate(context, {
        type: "low_ctr",
        url,
        query: null,
        position: sum.position,
        demandImpressions: sum.impressions,
        visibilityScore: bounded((expected - sum.clicks) / expected),
        visibilityRule: `(expected clicks ${Math.round(expected)} - observed clicks ${sum.clicks}) / expected clicks`,
        confidenceDelta: serpChecks.get(urlJoinKey(url) ?? ""),
        uncertainty:
          "Ads, AI answers, featured snippets and other results can lower clicks. Positions are averages.",
      }),
      evidence: [
        {
          period: "current",
          url: "",
          query: "",
          metrics: pageMetrics.get(url) ?? sum,
        },
        ...topQueries.map((row) => ({
          period: "current" as const,
          url: "",
          query: row.keys![0],
          metrics: metrics(row),
        })),
      ],
      urls: [],
    });
  }
  return candidates;
}
