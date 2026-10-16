import type {
  OpportunityCandidate,
  OpportunityMetrics,
} from "@/types/schemas/opportunities";
import { scoreCandidate, type ScoringContext } from "./scoreCandidate";
import { metrics, urlJoinKey, usableRow, type DetectionInput } from "./shared";

const MIN_IMPRESSIONS = 50;

/**
 * Audit issues that can block a page in search, with one plain action and an
 * effort estimate each. "indexing" issues can stop indexing, so they score
 * full visibility, and URL inspection can confirm them.
 */
const TECHNICAL_ISSUES: Record<
  string,
  { indexing: boolean; effortHours: number; action: string }
> = {
  "noindex-page": {
    indexing: true,
    effortHours: 1,
    action:
      "Remove the noindex directive if this page should appear in search.",
  },
  "blocked-page": {
    indexing: true,
    effortHours: 1,
    action: "Allow this page in robots.txt if it should appear in search.",
  },
  "canonicalized-page": {
    indexing: true,
    effortHours: 2,
    action:
      "Check the canonical tag. Point it to this page if this page should rank.",
  },
  "canonical-conflict": {
    indexing: true,
    effortHours: 2,
    action:
      "Make the HTML canonical tag and the HTTP header canonical point to the same URL.",
  },
  "broken-page": {
    indexing: true,
    effortHours: 2,
    action:
      "Restore the page, or redirect it to the closest live page and update links to it.",
  },
  "server-error": {
    indexing: true,
    effortHours: 4,
    action: "Fix the server error so the page returns status 200.",
  },
  "redirect-loop": {
    indexing: true,
    effortHours: 2,
    action: "Fix the redirect rules so the URL reaches one final page.",
  },
  "redirect-chain": {
    indexing: false,
    effortHours: 1,
    action: "Redirect straight to the final URL and update internal links.",
  },
  "javascript-rendering-suspected": {
    indexing: true,
    effortHours: 8,
    action:
      "Render the main content in the HTML response, so search engines can read it without JavaScript.",
  },
  "missing-title": {
    indexing: false,
    effortHours: 1,
    action: "Add a unique title that describes the page.",
  },
  "duplicate-title": {
    indexing: false,
    effortHours: 1,
    action: "Give this page a unique title.",
  },
  "slow-response": {
    indexing: false,
    effortHours: 4,
    action:
      "Find the slow part of the server response and fix it, for example with caching.",
  },
};

export const TECHNICAL_ISSUE_TYPES = Object.keys(TECHNICAL_ISSUES);

/** Whether URL inspection shows that Google does not index the page normally. */
function inspectionConfirms(verdict: string | null): boolean {
  return verdict !== null && verdict !== "PASS";
}

export function isIndexingIssue(issueType: string): boolean {
  return TECHNICAL_ISSUES[issueType]?.indexing ?? false;
}

function pageRows(rows: DetectionInput["currentPages"]) {
  const result = new Map<string, OpportunityMetrics>();
  for (const row of rows) {
    const key = usableRow(row, 0) ? urlJoinKey(row.keys![0]) : null;
    if (key) result.set(key, metrics(row));
  }
  return result;
}

/** A page with 50+ impressions, or a key page, has a blocking audit issue. */
export function technicalBlockers(
  input: DetectionInput,
  context: ScoringContext,
): OpportunityCandidate[] {
  if (!input.audit) return [];
  const audit = input.audit;
  const current = pageRows(input.currentPages);
  const previous = pageRows(input.previousPages);
  const keyPages = new Set(input.keyPages.map((page) => urlJoinKey(page.url)));
  const seen = new Set<string>();
  const candidates: OpportunityCandidate[] = [];
  for (const issue of audit.issues) {
    const rule = TECHNICAL_ISSUES[issue.issueType];
    const key = urlJoinKey(issue.pageUrl);
    if (!rule || !key || seen.has(`${key} ${issue.issueType}`)) continue;
    seen.add(`${key} ${issue.issueType}`);
    const now = current.get(key);
    const before = previous.get(key);
    const impressions = Math.max(
      now?.impressions ?? 0,
      before?.impressions ?? 0,
    );
    const keyPage = keyPages.has(key);
    if (impressions < MIN_IMPRESSIONS && !keyPage) continue;
    const inspection = rule.indexing ? input.inspections.get(key) : undefined;
    const confirmed = inspectionConfirms(inspection?.verdict ?? null);
    candidates.push({
      type: "technical_blocker",
      url: issue.pageUrl,
      query: null,
      title: `Fix a technical issue: ${issue.issueType}`,
      explanation: `The site audit of ${audit.completedAt.slice(0, 10)} found "${issue.issueType}" on this page. The page had ${impressions} impressions in the larger of the two periods${keyPage ? " and is a key page" : ""}.${confirmed ? ` URL inspection confirms it: Google reports "${inspection!.coverageState ?? inspection!.verdict}".` : ""}`,
      recommendedAction: rule.action,
      searchIntent: "Not applicable; a technical issue",
      diagnosis: null,
      ...scoreCandidate(context, {
        type: "technical_blocker",
        url: issue.pageUrl,
        query: null,
        position: now?.position ?? before?.position ?? null,
        demandImpressions: impressions,
        visibilityScore: rule.indexing ? 1 : 0.5,
        visibilityRule: rule.indexing
          ? "1, because this issue can stop the page from being indexed"
          : "0.5, because this issue can lower rankings but does not stop indexing",
        confidence: confirmed ? 0.7 : undefined,
        effortHours: rule.effortHours,
        uncertainty:
          "The audit shows the page as the crawler saw it on the audit date. Google may see it differently.",
      }),
      evidence: [
        ...(now
          ? [{ period: "current" as const, url: "", query: "", metrics: now }]
          : []),
        ...(before
          ? [
              {
                period: "previous" as const,
                url: "",
                query: "",
                metrics: before,
              },
            ]
          : []),
      ],
      urls: [],
      audit: {
        auditId: audit.auditId,
        auditIssueId: issue.id,
        issueType: issue.issueType,
        severity: issue.severity,
        pageUrl: issue.pageUrl,
        auditCompletedAt: audit.completedAt,
      },
      ...(inspection ? { inspection } : {}),
    });
  }
  return candidates;
}
