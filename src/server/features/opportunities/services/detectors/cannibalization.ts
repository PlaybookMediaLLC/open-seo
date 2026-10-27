import { sort } from "remeda";
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
  type UsableGscRow,
} from "./shared";

const MIN_IMPRESSIONS = 50;
const MAX_POSITION = 20;
const MIN_SHARE = 0.25;
const MIN_SHARED_QUERIES = 2;
const MIN_SHARED_IMPRESSIONS = 200;
const EVIDENCE_QUERIES = 10;

/** URLs that differ only by protocol, www, trailing slash or case. */
function variantKey(url: string): string {
  const parsed = new URL(url);
  return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/+$/, "")}${parsed.search}`.toLowerCase();
}

type SharedQuery = {
  query: string;
  rows: [UsableGscRow, UsableGscRow];
};

/** Two pages each take 25%+ of the impressions for the same queries. */
export function cannibalization(
  nonBrandedQueryPages: UsableGscRow[],
  pageMetrics: Map<string, OpportunityMetrics>,
  context: ScoringContext,
): OpportunityCandidate[] {
  const byQuery = new Map<string, UsableGscRow[]>();
  for (const row of nonBrandedQueryPages) {
    const rows = byQuery.get(row.keys[0]) ?? [];
    rows.push(row);
    byQuery.set(row.keys[0], rows);
  }
  const pairs = new Map<string, SharedQuery[]>();
  for (const [query, rows] of byQuery) {
    const total = rows.reduce((sum, row) => sum + row.impressions, 0);
    const [a, b] = sort(
      rows.filter(
        (row) =>
          row.impressions >= MIN_IMPRESSIONS && row.position <= MAX_POSITION,
      ),
      (x, y) =>
        y.impressions - x.impressions || compareText(x.keys[1], y.keys[1]),
    );
    if (!a || !b) continue;
    if (a.impressions < MIN_SHARE * total || b.impressions < MIN_SHARE * total)
      continue;
    // A URL variant is a canonical problem for phase 2, not cannibalization.
    if (variantKey(a.keys[1]) === variantKey(b.keys[1])) continue;
    const pair = sort([a, b], (x, y) => compareText(x.keys[1], y.keys[1]));
    const key = JSON.stringify(pair.map((row) => row.keys[1]));
    const entries = pairs.get(key) ?? [];
    entries.push({ query, rows: [pair[0], pair[1]] });
    pairs.set(key, entries);
  }

  const candidates: OpportunityCandidate[] = [];
  for (const shared of pairs.values()) {
    const [first, second] = [0, 1].map((side) =>
      totals(shared.map((entry) => metrics(entry.rows[side]))),
    );
    const sharedImpressions = first.impressions + second.impressions;
    if (
      shared.length < MIN_SHARED_QUERIES &&
      sharedImpressions < MIN_SHARED_IMPRESSIONS
    )
      continue;
    const urls = shared[0].rows.map((row) => row.keys[1]);
    const firstIsPrimary =
      first.clicks !== second.clicks
        ? first.clicks > second.clicks
        : first.impressions >= second.impressions;
    const [primary, competing] = firstIsPrimary ? urls : [urls[1], urls[0]];
    const [primaryTotals, competingTotals] = firstIsPrimary
      ? [first, second]
      : [second, first];
    const evidenceQueries = sort(
      shared,
      (x, y) =>
        y.rows[0].impressions +
          y.rows[1].impressions -
          (x.rows[0].impressions + x.rows[1].impressions) ||
        compareText(x.query, y.query),
    ).slice(0, EVIDENCE_QUERIES);
    candidates.push({
      type: "cannibalization",
      url: primary,
      query: null,
      title: "Review two pages that compete for the same queries",
      explanation: `Two pages rank for the same ${shared.length} queries. This can split clicks, but it is not always a problem. The primary page got ${primaryTotals.clicks} clicks and the competing page got ${competingTotals.clicks} clicks from these queries.`,
      recommendedAction:
        "Check whether both pages serve the same intent. If they do, merge or differentiate them, and point internal links to one page.",
      searchIntent: "Unverified; review query and SERP",
      diagnosis: null,
      ...scoreCandidate(context, {
        type: "cannibalization",
        url: primary,
        query: null,
        position: primaryTotals.position,
        demandImpressions: sharedImpressions,
        visibilityScore: bounded(
          (2 * Math.min(first.impressions, second.impressions)) /
            sharedImpressions,
        ),
        visibilityRule:
          "twice the smaller page's share of the shared-query impressions",
        uncertainty:
          "The two pages may serve different intents. Search Console positions are averages.",
      }),
      evidence: [
        {
          period: "current",
          url: "",
          query: "",
          metrics: pageMetrics.get(primary) ?? primaryTotals,
        },
        ...evidenceQueries.flatMap((entry) =>
          entry.rows.map((row) => ({
            period: "current" as const,
            url: row.keys[1],
            query: entry.query,
            metrics: metrics(row),
          })),
        ),
      ],
      urls: [
        { url: primary, role: "primary" },
        { url: competing, role: "competing" },
      ],
    });
  }
  return candidates;
}
