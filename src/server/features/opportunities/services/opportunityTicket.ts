import type { AccessibilityTicketFacts } from "@/server/features/accessibility/accessibilityTicket";
import { causesOf, METRIC_NAMES, metricValue } from "@/shared/performance";
import type { ProposalDraft } from "@/types/schemas/proposalDrafts";
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
  accessibility_issue:
    "Run a new site audit after the change deploys. The rule must no longer fail on the affected pages. Automated checks find only some accessibility issues; test with assistive technology too.",
  performance_issue:
    "Run Lighthouse on the page after the change deploys for the lab value. Field data needs about 4 weeks: compare the 75th percentile with the evidence above after that.",
  cro_low_conversion:
    "After the change ships, wait 28 days. Then compare the page's conversion rate with the GA4 evidence above.",
  cro_form_drop_off:
    "After the change ships, wait 28 days. Then compare the page's form submits per form start with the GA4 evidence above.",
  cro_device_gap:
    "After the change ships, wait 28 days. Then compare the page's mobile and desktop conversion rates with the GA4 evidence above.",
  cro_low_engagement:
    "After the change ships, wait 28 days. Then compare the page's engagement rate with the GA4 evidence above.",
};

// axe-core's color-contrast summary: the ratio, both colors, the target.
const CONTRAST =
  /contrast of ([\d.]+) \(foreground color: (#[0-9a-f]{3,8}), background color: (#[0-9a-f]{3,8}).*?\)\. Expected contrast ratio of ([\d.]+):1/i;

/** RFC-0013 phase 2: headings in page order, with each skipped level. */
function headingOutline(headings: AccessibilityTicketFacts["headings"]) {
  let previous = 0;
  return headings
    .map(({ level, text }) => {
      const skip = previous > 0 && level > previous + 1;
      const line = `- h${level} \`${text.replaceAll("`", "'") || "(empty)"}\`${skip ? ` (skips from h${previous})` : ""}`;
      previous = level;
      return line;
    })
    .join("\n");
}

/** RFC-0004 phase 3: a checked internal-link anchor draft. */
type TicketAnchor = Pick<
  ProposalDraft,
  "targetUrl" | "valueBefore" | "valueAfter"
>;

/**
 * Plain ticket text from stored fields only: no note text, no provider body
 * and no token can reach it. The only model text is a checked anchor draft,
 * whose words are copied from the source page.
 */
export function opportunityTicket(
  detail: OpportunityDetail,
  anchor: TicketAnchor | null = null,
  accessibilityFacts: AccessibilityTicketFacts | null = null,
) {
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
  const [accessibility] = latest(detail.accessibilityEvidence);
  const [performance] = latest(detail.performanceEvidence);
  const causes = causesOf(performance?.causeIds ?? "");
  const summary =
    accessibilityFacts?.summary?.replace(/\s+/g, " ").trim() ?? null;
  const contrast =
    accessibility?.ruleId === "color-contrast" && summary
      ? CONTRAST.exec(summary)
      : null;
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
    ...(accessibility
      ? [
          `- axe-core rule ${accessibility.ruleId} (${accessibility.impact}) on ${accessibility.pagesAffected} pages${accessibility.wcagTags ? `, ${accessibility.wcagTags}` : ""}`,
          `- Example on ${accessibility.exampleUrl}: \`${accessibility.exampleSelector.replaceAll("`", "'")}\``,
          ...(summary ? [`- axe-core: ${summary}`] : []),
        ]
      : []),
    ...(performance
      ? [
          `- Chrome UX Report, 28 days to ${performance.collectionEnd}: ${METRIC_NAMES[performance.metric]} ${metricValue(performance.metric, performance.p75Value)} at the 75th percentile on ${performance.formFactor === "phone" ? "phones" : "desktops"}; good is ${metricValue(performance.metric, performance.threshold)} or less`,
          `- Measured on ${performance.target}${performance.scope === "origin" ? " (the whole site)" : ""}, for ${performance.template === "*" ? "pages without their own field data" : `pages like ${performance.template}`}`,
          ...(performance.labValue === null
            ? []
            : [
                `- Lighthouse lab value: ${metricValue(performance.metric, performance.labValue)}`,
              ]),
        ]
      : []),
  ];
  return {
    title: item.title.slice(0, 200),
    body: [
      `## What Relay found\n\n${item.explanation}`,
      `## Pages\n\n${pages.join("\n")}`,
      `## Evidence\n\n${evidence.join("\n") || "No stored evidence rows."}`,
      `## Proposed change\n\n${item.recommendedAction}`,
      ...(anchor
        ? [
            `## Suggested link\n\nOn ${anchor.targetUrl}, link the words "${anchor.valueAfter}" to ${item.url}. They stand in this sentence:\n\n> ${anchor.valueBefore ?? ""}\n\nRelay drafted this with AI and checked that the sentence is on the page.`,
          ]
        : []),
      ...(contrast
        ? [
            `## Contrast\n\n- Measured ratio: ${contrast[1]}:1\n- Foreground color: ${contrast[2]}\n- Background color: ${contrast[3]}\n- Required ratio: ${contrast[4]}:1`,
          ]
        : []),
      ...(performance
        ? [
            `## Causes\n\n${causes.length ? causes.map((cause) => `- ${cause.label}: ${cause.fix}`).join("\n") : "- The latest Lighthouse report names no cause. Run a site audit with Lighthouse on the page."}`,
          ]
        : []),
      ...(accessibility && accessibilityFacts?.headings.length
        ? [
            `## Heading outline\n\nOn ${accessibility.exampleUrl}:\n\n${headingOutline(accessibilityFacts.headings)}`,
          ]
        : []),
      `## Risk\n\n${item.uncertainty} Estimated effort: ${item.effortHours} hours.`,
      `## How to verify\n\n${VERIFY[item.type]}`,
    ].join("\n\n"),
  };
}
