import { sort } from "remeda";
import type { GscSearchAnalyticsRow } from "@/server/lib/gscClient";
import type {
  OpportunityCandidate,
  OpportunityMetrics,
} from "@/types/schemas/opportunities";
import { INLINK_CAP } from "../../audit/inlinksSql";
import { scoreCandidate, type ScoringContext } from "./scoreCandidate";
import {
  bounded,
  compareText,
  metrics,
  urlJoinKey,
  type AuditSignals,
} from "./shared";

const MIN_TARGET_QUERIES = 3;
const TARGET_QUERIES = 10;
const MAX_SOURCE_POSITION = 30;
const SOURCES_PER_TARGET = 5;

type Source = {
  url: string;
  impressions: number;
  best: GscSearchAnalyticsRow;
};

/** A page that ranks for a key page's queries does not link to it yet. */
export function internalLinks(
  nonBrandedQueryPages: GscSearchAnalyticsRow[],
  keyPages: Array<{ url: string; role: string }>,
  audit: AuditSignals,
  pageMetrics: Map<string, OpportunityMetrics>,
  context: ScoringContext,
): OpportunityCandidate[] {
  const live = new Set(
    audit.pages
      .filter((page) => page.statusCode === 200 && page.isIndexable)
      .map((page) => urlJoinKey(page.url)),
  );
  const rowsByPage = new Map<string, GscSearchAnalyticsRow[]>();
  for (const row of nonBrandedQueryPages) {
    const key = urlJoinKey(row.keys![1]);
    if (!key || row.impressions <= 0) continue;
    const rows = rowsByPage.get(key) ?? [];
    rows.push(row);
    rowsByPage.set(key, rows);
  }
  const candidates: OpportunityCandidate[] = [];
  for (const keyPage of keyPages) {
    const targetKey = urlJoinKey(keyPage.url);
    if (keyPage.role !== "money" && keyPage.role !== "hub") continue;
    const linked = targetKey ? audit.inlinks.get(targetKey) : undefined;
    if (!targetKey || (linked?.size ?? 0) >= INLINK_CAP) continue;
    const targetRows = rowsByPage.get(targetKey) ?? [];
    if (targetRows.length < MIN_TARGET_QUERIES) continue;
    const topQueries = new Map(
      sort(
        targetRows,
        (a, b) =>
          b.impressions - a.impressions || compareText(a.keys![0], b.keys![0]),
      )
        .slice(0, TARGET_QUERIES)
        .map((row) => [row.keys![0], row]),
    );
    const sources = new Map<string, Source>();
    for (const row of nonBrandedQueryPages) {
      const sourceKey = urlJoinKey(row.keys![1]);
      if (
        !sourceKey ||
        sourceKey === targetKey ||
        !topQueries.has(row.keys![0]) ||
        row.position > MAX_SOURCE_POSITION ||
        !live.has(sourceKey) ||
        linked?.has(sourceKey)
      )
        continue;
      const source = sources.get(sourceKey);
      if (!source)
        sources.set(sourceKey, {
          url: row.keys![1],
          impressions: row.impressions,
          best: row,
        });
      else {
        source.impressions += row.impressions;
        if (row.impressions > source.best.impressions) source.best = row;
      }
    }
    const ranked = sort(
      [...sources.values()],
      (a, b) => b.impressions - a.impressions || compareText(a.url, b.url),
    ).slice(0, SOURCES_PER_TARGET);
    for (const source of ranked) {
      const sharedQuery = source.best.keys![0];
      const targetPosition = topQueries.get(sharedQuery)!.position;
      candidates.push({
        type: "internal_link",
        url: keyPage.url,
        query: null,
        title: "Add an internal link to a key page",
        explanation: `${source.url} gets ${source.impressions} impressions for queries that this ${keyPage.role} page ranks for, and the latest audit found no link from it to this page. The target ranks at position ${targetPosition} for "${sharedQuery}".`,
        recommendedAction: `Add a contextual link from the source page to the target page, in text about '${sharedQuery}'.`,
        searchIntent: "Unverified; review query and SERP",
        diagnosis: null,
        ...scoreCandidate(context, {
          type: "internal_link",
          url: keyPage.url,
          query: null,
          position: targetPosition,
          demandImpressions: source.impressions,
          visibilityScore: bounded((targetPosition - 1) / 19),
          visibilityRule: `(target position ${targetPosition} for the shared query - 1) / 19, clamped to [0,1]`,
          uncertainty:
            "The link graph is from the latest audit. A link added since then is not seen. Anchor text and link placement are not checked.",
        }),
        evidence: [
          ...(pageMetrics.has(keyPage.url)
            ? [
                {
                  period: "current" as const,
                  url: "",
                  query: "",
                  metrics: pageMetrics.get(keyPage.url)!,
                },
              ]
            : []),
          {
            period: "current",
            url: source.url,
            query: sharedQuery,
            metrics: metrics(source.best),
          },
        ],
        urls: [
          { url: keyPage.url, role: "primary" },
          { url: keyPage.url, role: "link_target" },
          { url: source.url, role: "link_source" },
        ],
        link: {
          auditId: audit.auditId,
          sourceUrl: source.url,
          targetUrl: keyPage.url,
          sharedQuery,
          sourceImpressions: source.best.impressions,
          sourcePosition: source.best.position,
        },
      });
    }
  }
  return candidates;
}
