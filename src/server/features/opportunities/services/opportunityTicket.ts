import { sort } from "remeda";
import type {
  EvidencePeriod,
  OpportunityDetail,
  OpportunityType,
} from "@/types/schemas/opportunities";

/** A ticket exists once a person approved the work (RFC-0003 5.6). */
export const TICKET_STATUSES = [
  "approved",
  "in_progress",
  "implemented",
  "failed",
];
const EVIDENCE_ROWS = 10;
const KEYWORD_ROWS = 5;

const PERIOD: Record<EvidencePeriod, string> = {
  current: "Current 28 days",
  previous: "Previous 28 days",
  year_ago: "Same 28 days a year ago",
  year_ago_previous: "Previous 28 days a year ago",
};

const VERIFY: Record<OpportunityType, string> = {
  striking_distance:
    "After the change ships, wait 28 days. Then compare this query's position and clicks for this page with the evidence above.",
  declining_page:
    "After the change ships, wait 28 days. Then compare the page's clicks with the current period above.",
  low_ctr:
    "After the change ships, wait 28 days. Then compare the page's click-through rate at the same positions with the evidence above.",
  cannibalization:
    "After the change ships, wait 28 days. Then check that one page gets most of the impressions for the shared queries.",
  technical_blocker:
    "Run a new site audit and inspect the URL in Search Console. The issue must be gone from both.",
  internal_link:
    "Run a new site audit. It must show a link from the source page to the target page.",
  content_gap:
    "After the page ships, track the topic's keywords for 28 days and compare their positions with the competitor positions above.",
};

/**
 * Plain ticket text from stored fields only: no model, no note text, no
 * provider body and no token can reach it.
 */
export function opportunityTicket(detail: OpportunityDetail) {
  const { opportunity: item } = detail;
  const latest = <T extends { runId: string }>(rows: T[]) =>
    rows.filter((row) => row.runId === item.evidenceRunId);
  const pages = [
    `- ${item.url}`,
    ...detail.urls
      .filter((row) => row.url !== item.url)
      .map((row) => `- ${row.url} (${row.role.replace("_", " ")})`),
    ...(item.query ? [`- Query: "${item.query}"`] : []),
  ];
  const searchRows = sort(
    latest(detail.evidence),
    (a, b) => b.impressions - a.impressions,
  )
    .slice(0, EVIDENCE_ROWS)
    .map((row) => {
      const scope = [row.url, row.query && `"${row.query}"`]
        .filter(Boolean)
        .join(", ");
      return `- ${PERIOD[row.period]}${scope ? ` (${scope})` : ""}: ${row.clicks} clicks, ${row.impressions} impressions, CTR ${(row.ctr * 100).toFixed(2)}%, average position ${row.position.toFixed(1)}`;
    });
  const [audit] = latest(detail.auditEvidence);
  const [inspection] = latest(detail.inspectionEvidence);
  const [link] = latest(detail.linkEvidence);
  const keywords = latest(detail.keywordEvidence).slice(0, KEYWORD_ROWS);
  const evidence = [
    ...searchRows,
    ...(audit
      ? [
          `- Site audit of ${audit.auditCompletedAt.slice(0, 10)}: ${audit.issueType} (${audit.severity})`,
        ]
      : []),
    ...(inspection
      ? [
          `- URL inspection on ${inspection.inspectedAt.slice(0, 10)}: ${inspection.verdict ?? "no verdict"}${inspection.coverageState ? `, ${inspection.coverageState}` : ""}`,
        ]
      : []),
    ...(link
      ? [
          `- Link source: ${link.sourceUrl} gets ${link.sourceImpressions} impressions for "${link.sharedQuery}" at position ${link.sourcePosition.toFixed(1)}`,
        ]
      : []),
    ...keywords.map(
      (row) =>
        `- "${row.keyword}": ${row.searchVolume} monthly searches; ${row.competitorDomain} ranks at position ${row.competitorPosition}`,
    ),
  ];
  return {
    title: item.title.slice(0, 200),
    body: [
      `## What Relay found\n\n${item.explanation}`,
      `## Pages\n\n${pages.join("\n")}`,
      `## Evidence\n\n${evidence.join("\n") || "No stored evidence rows."}`,
      `## Proposed change\n\n${item.recommendedAction}`,
      `## Risk\n\n${item.uncertainty} Estimated effort: ${item.effortHours} hours.`,
      `## How to verify\n\n${VERIFY[item.type]}`,
    ].join("\n\n"),
  };
}
