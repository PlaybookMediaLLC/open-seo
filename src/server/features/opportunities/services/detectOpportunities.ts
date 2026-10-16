import { sort } from "remeda";
import type { OpportunityCandidate } from "@/types/schemas/opportunities";
import { cannibalization } from "./detectors/cannibalization";
import { decliningPages } from "./detectors/decliningPages";
import { internalLinks } from "./detectors/internalLink";
import { lowCtr } from "./detectors/lowCtr";
import { scoringContext } from "./detectors/scoreCandidate";
import {
  brandMatcher,
  compareText,
  metrics,
  usableRow,
  type DetectionInput,
} from "./detectors/shared";
import { strikingDistance } from "./detectors/strikingDistance";
import { technicalBlockers } from "./detectors/technicalBlocker";

/** Pure evidence shaping. No collection, writes, or inferred search intent. */
export function detectOpportunities(
  input: DetectionInput,
): OpportunityCandidate[] {
  const context = scoringContext(input);
  const isBranded = brandMatcher(input.brandTerms);
  // Stable ordering makes equal-position/equal-impression best-page ties independent
  // of provider row order. Apply the demand threshold after best-page selection.
  const queryPages = sort(
    input.queryPages.filter((row) => usableRow(row, 1)),
    (a, b) =>
      compareText(a.keys![1], b.keys![1]) ||
      compareText(a.keys![0], b.keys![0]),
  );
  const nonBranded = queryPages.filter((row) => !isBranded(row.keys![0]));
  const pageMetrics = new Map(
    input.currentPages
      .filter((row) => usableRow(row, 0))
      .map((row) => [row.keys![0], metrics(row)]),
  );
  const candidates = [
    ...strikingDistance(queryPages, context),
    ...decliningPages(input, context),
    ...lowCtr(nonBranded, pageMetrics, context),
    ...cannibalization(nonBranded, pageMetrics, context),
    ...technicalBlockers(input, context),
    ...(input.audit?.inlinks.size
      ? internalLinks(
          nonBranded,
          input.keyPages,
          input.audit,
          pageMetrics,
          context,
        )
      : []),
  ].map((candidate) => {
    // Rank history is evidence only. It does not change the score.
    const rank = candidate.query
      ? input.rankHistory.get(candidate.query.toLowerCase())
      : undefined;
    return rank ? { ...candidate, rank } : candidate;
  });
  return sort(
    candidates,
    (a, b) =>
      b.priority - a.priority ||
      compareText(a.url, b.url) ||
      compareText(a.query ?? "", b.query ?? "") ||
      compareText(a.type, b.type) ||
      compareText(JSON.stringify(a.urls), JSON.stringify(b.urls)) ||
      compareText(a.audit?.issueType ?? "", b.audit?.issueType ?? ""),
  ).slice(0, 50);
}
