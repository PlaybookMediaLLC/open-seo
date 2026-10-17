import { sortBy } from "remeda";
import type { InvestigationFinding } from "@/types/schemas/investigations";
import type { RankEvidence } from "@/types/schemas/opportunities";

// RFC-0004 phase 3: the deterministic rules that turn stored data into
// investigation findings. No model is involved.
type Finding = Omit<InvestigationFinding, "id">;
type QueryRow = { keys?: string[] | null; clicks: number };
const TOP_LOSSES = 5;

const label = (position: number | null) =>
  position === null ? "not ranking" : `position ${position}`;
const finding = (
  kind: Finding["kind"],
  severity: Finding["severity"],
  summary: string,
  metricBefore: number | null = null,
  metricAfter: number | null = null,
): Finding => ({ kind, severity, summary, metricBefore, metricAfter });

const clicksByQuery = (rows: QueryRow[]) => {
  const clicks = new Map<string, number>();
  for (const row of rows) {
    const query = row.keys?.[0];
    if (query) clicks.set(query, (clicks.get(query) ?? 0) + row.clicks);
  }
  return clicks;
};

/** The queries that lost the most clicks between the two periods. */
export function queryLossFindings(
  current: QueryRow[],
  previous: QueryRow[],
): Finding[] {
  const now = clicksByQuery(current);
  const before = clicksByQuery(previous);
  const losses = sortBy(
    [...before]
      .map(([query, clicks]) => ({
        query,
        before: clicks,
        after: now.get(query) ?? 0,
      }))
      .filter((row) => row.before > row.after),
    [(row) => row.before - row.after, "desc"],
  );
  const total = losses.reduce((sum, row) => sum + row.before - row.after, 0);
  if (!losses.length)
    return [
      finding(
        "query_loss",
        "info",
        "No query lost clicks between the periods.",
      ),
    ];
  return losses.slice(0, TOP_LOSSES).map((row) => {
    const share = (row.before - row.after) / total;
    return finding(
      "query_loss",
      share >= 0.5 ? "high" : share >= 0.2 ? "medium" : "low",
      `"${row.query}" lost ${row.before - row.after} clicks (${row.before} → ${row.after}).`,
      row.before,
      row.after,
    );
  });
}

type IndexStatus = {
  verdict?: string | null;
  coverageState?: string | null;
  robotsTxtState?: string | null;
  googleCanonical?: string | null;
  userCanonical?: string | null;
};

/** What URL Inspection says about the page now. */
export function indexStateFindings(status: IndexStatus | undefined): Finding[] {
  if (!status)
    return [
      finding(
        "index_state",
        "medium",
        "URL Inspection returned no index status.",
      ),
    ];
  const findings: Finding[] = [];
  if (status.verdict === "PASS")
    findings.push(
      finding(
        "index_state",
        "info",
        `Google reports the page as indexed (${status.coverageState ?? "no coverage state"}).`,
      ),
    );
  else
    findings.push(
      finding(
        "index_state",
        "high",
        `Google does not report the page as indexed: ${status.coverageState ?? status.verdict ?? "unknown state"}.`,
      ),
    );
  if (status.robotsTxtState === "DISALLOWED")
    findings.push(
      finding("index_state", "high", "robots.txt blocks the page."),
    );
  if (
    status.googleCanonical &&
    status.userCanonical &&
    status.googleCanonical !== status.userCanonical
  )
    findings.push(
      finding(
        "index_state",
        "high",
        `Google chose a different canonical: ${status.googleCanonical} instead of ${status.userCanonical}.`,
      ),
    );
  return findings;
}

const AUDIT_SEVERITY = {
  critical: "high",
  warning: "medium",
  info: "low",
} as const;

/** The latest site audit's issues for the page. */
export function auditFindings(
  issues: Array<{ issueType: string; severity: keyof typeof AUDIT_SEVERITY }>,
  completedAt: string,
): Finding[] {
  return issues.map((issue) =>
    finding(
      "audit_issue",
      AUDIT_SEVERITY[issue.severity],
      `The site audit of ${completedAt.slice(0, 10)} found ${issue.issueType.replaceAll("_", " ")}.`,
    ),
  );
}

/** Tracked keywords that are also the page's queries, first and last check. */
export function rankFindings(
  history: Map<string, RankEvidence[]>,
  queries: Iterable<string>,
): Finding[] {
  const findings: Finding[] = [];
  for (const query of new Set([...queries].map((item) => item.toLowerCase())))
    for (const entry of history.get(query) ?? []) {
      const { firstPosition: first, lastPosition: last } = entry;
      if (first === last) continue;
      const drop =
        first === null ? -Infinity : last === null ? Infinity : last - first;
      findings.push(
        finding(
          "rank_change",
          drop >= 5 ? "high" : drop >= 2 ? "medium" : drop > 0 ? "low" : "info",
          `Tracked keyword "${query}" (${entry.device}) moved from ${label(first)} to ${label(last)}.`,
          first,
          last,
        ),
      );
    }
  return findings;
}
