import { buildStrikingDistanceRows } from "@/server/features/gsc/searchPerformanceReport";
import type { GscSearchAnalyticsRow } from "@/server/lib/gscClient";
import type { OpportunityCandidate } from "@/types/schemas/opportunities";
import { scoreCandidate, type ScoringContext } from "./scoreCandidate";
import { bounded, metrics } from "./shared";

/** The best page for a query ranks from 5 to 20 with 100+ impressions. */
export function strikingDistance(
  queryPages: GscSearchAnalyticsRow[],
  context: ScoringContext,
): OpportunityCandidate[] {
  // queryPages is sorted, so the first row per query and page is stable.
  const sources = new Map<string, GscSearchAnalyticsRow>();
  for (const row of queryPages) {
    const key = JSON.stringify(row.keys);
    if (!sources.has(key)) sources.set(key, row);
  }
  return buildStrikingDistanceRows(queryPages, queryPages.length)
    .filter((row) => row.impressions >= 100)
    .map((row) => {
      // buildStrikingDistanceRows only returns query+page pairs from queryPages.
      const source = sources.get(JSON.stringify([row.query, row.page]));
      if (!source) throw new Error("Striking-distance row has no source row");
      const current = metrics(source);
      return {
        type: "striking_distance",
        url: row.page,
        query: row.query,
        title: "Review a striking-distance query",
        explanation: `The best observed page for this query ranks at average position ${current.position}, with ${current.impressions} impressions.`,
        recommendedAction:
          "Review query relevance, the SERP, page content and internal links before proposing an improvement.",
        searchIntent: "Unverified; review query and SERP",
        diagnosis: null,
        ...scoreCandidate(context, {
          type: "striking_distance",
          url: row.page,
          query: row.query,
          position: current.position,
          demandImpressions: current.impressions,
          visibilityScore: bounded((current.position - 4) / 16),
          visibilityRule: "(position - 4) / 16, clamped to [0,1]",
          uncertainty:
            "Brand, SERP, seasonality and underlying demand changes are not verified.",
        }),
        evidence: [{ period: "current", url: "", query: "", metrics: current }],
        urls: [],
      };
    });
}
