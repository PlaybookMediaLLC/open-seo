import type { GscSearchAnalyticsRow } from "@/server/lib/gscClient";
import { ACCESSIBILITY_LIMITS } from "@/shared/accessibility";
import type { OpportunityCandidate } from "@/types/schemas/opportunities";
import { priorityFor, type ScoringContext } from "./scoreCandidate";
import { bounded, urlJoinKey, type AuditSignals } from "./shared";

// RFC-0013 5.3: one opportunity per axe-core cluster of the latest audit.
// Relay states what automated checks found and never claims compliance.
const IMPACT_WEIGHT = {
  critical: 1,
  serious: 0.75,
  moderate: 0.4,
  minor: 0.15,
};
const CONFIDENCE = 0.6;
const EFFORT_HOURS = 1;
const DIFFICULTY = 0.3;
const WHY: Record<string, string> = {
  "image-alt":
    "A screen reader cannot describe an image that has no alternative text.",
  "html-has-lang":
    "Without a page language, a screen reader may read the page with the wrong pronunciation.",
  "html-lang-valid":
    "With an invalid page language, a screen reader may read the page with the wrong pronunciation.",
  "link-name":
    'A screen reader announces a link without a name as only "link", so people cannot tell where it goes.',
  "button-name":
    'A screen reader announces a button without a name as only "button", so people cannot tell what it does.',
  label:
    "A form field without a label gives screen reader users no prompt for what to enter.",
  "color-contrast":
    "Text with low contrast is hard to read for people with low vision.",
  "heading-order":
    "Skipped heading levels make the page outline hard to follow with a screen reader.",
};
const ACTION: Record<string, string> = {
  "image-alt":
    'Add alternative text to the image in the component, or alt="" when the image is only decoration.',
  "html-has-lang": "Add the lang attribute to <html> in the root layout.",
  "html-lang-valid": "Correct the lang attribute on <html> in the root layout.",
};
const roleScore = (role: string | undefined) =>
  role === "money"
    ? 1
    : role === "hub"
      ? 0.7
      : role === "spoke" || role === "other"
        ? 0.5
        : 0.25;

/** "1.1.1, 4.1.2" from axe-core's WCAG tags such as "wcag111". */
const criteria = (tags: string) =>
  tags
    .split(" ")
    .flatMap((tag) => {
      const match = /^wcag(\d)(\d)(\d+)$/.exec(tag);
      return match ? [`${match[1]}.${match[2]}.${match[3]}`] : [];
    })
    .join(", ");

export function accessibilityIssues(
  audit: AuditSignals,
  currentPages: GscSearchAnalyticsRow[],
  context: ScoringContext,
): OpportunityCandidate[] {
  const clicks = new Map(
    currentPages.flatMap((row) => {
      const key = urlJoinKey(row.keys?.[0] ?? "");
      return key ? [[key, row.clicks] as const] : [];
    }),
  );
  const roles = new Map(
    [...context.roles].map(([url, role]) => [urlJoinKey(url), role]),
  );
  return audit.accessibility.map((cluster) => {
    const keys = cluster.pageUrls.map(urlJoinKey);
    const pageClicks = keys.reduce(
      (total, key) => total + (key ? (clicks.get(key) ?? 0) : 0),
      0,
    );
    const commercialScore = Math.max(
      ...keys.map((key) => roleScore(key ? roles.get(key) : undefined)),
    );
    const scores = {
      commercialScore,
      demandScore: bounded(Math.log10(1 + pageClicks) / 5),
      visibilityScore: IMPACT_WEIGHT[cluster.impact],
      difficultyScore: DIFFICULTY,
      effortScore: bounded(1 / EFFORT_HOURS),
    };
    const priority = priorityFor(CONFIDENCE, scores);
    const pages = cluster.pageUrls.length;
    const wcag = criteria(cluster.wcagTags);
    return {
      type: "accessibility_issue" as const,
      url: cluster.example.url,
      query: null,
      title: `Fix the ${cluster.ruleId} problem in one component on ${pages} ${pages === 1 ? "page" : "pages"}`,
      explanation: `${WHY[cluster.ruleId] ?? "People who use assistive technology may not be able to use this element."} Automated checks found it in the same component on ${pages} ${pages === 1 ? "page" : "pages"}${wcag ? ` (WCAG ${wcag})` : ""}. ${ACCESSIBILITY_LIMITS}`,
      recommendedAction:
        ACTION[cluster.ruleId] ??
        "Fix the element in the component, then run a new audit to check the affected pages.",
      searchIntent: "Not applicable; accessibility evidence from axe-core",
      confidence: CONFIDENCE,
      effortHours: EFFORT_HOURS,
      priority,
      ...scores,
      scoreExplanation: `Priority = round(100 × confidence ${CONFIDENCE} × (0.30 × commercial ${commercialScore} + 0.25 × demand ${scores.demandScore} + 0.20 × visibility ${scores.visibilityScore} + 0.15 × (1 - difficulty ${DIFFICULTY}) + 0.10 × inverse effort ${scores.effortScore})) = ${priority}. Commercial is the highest key-page role score among the affected pages. Demand = min(1, log10(1 + ${pageClicks} organic clicks of the affected pages) / 5). Visibility is the weight of the ${cluster.impact} impact.`,
      uncertainty: `${ACCESSIBILITY_LIMITS} Clicks count only the pages that Search Console reports.`,
      diagnosis: null,
      evidence: [],
      urls: [],
      ga4: [],
      accessibility: {
        auditId: audit.auditId,
        clusterKey: cluster.clusterKey,
        ruleId: cluster.ruleId,
        impact: cluster.impact,
        wcagTags: cluster.wcagTags,
        pagesAffected: pages,
        exampleUrl: cluster.example.url,
        exampleSelector: cluster.example.selector,
        exampleSnippet: cluster.example.snippet,
      },
    };
  });
}
