import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  gte,
  inArray,
  sum,
} from "drizzle-orm";
import { db } from "@/db";
import {
  auditAccessibilityResults,
  auditAccessibilityViolations,
  auditIssues,
  auditPageInlinks,
  auditPages,
  audits,
  opportunityAccessibilityEvidence,
  opportunityPerformanceEvidence,
  opportunityAuditEvidence,
  opportunityInspectionEvidence,
  opportunityLinkEvidence,
  opportunityRankEvidence,
  opportunityRuns,
  rankCheckRuns,
  rankSnapshots,
} from "@/db/schema";
import type { RankEvidence } from "@/types/schemas/opportunities";
import {
  urlJoinKey,
  type AccessibilityCluster,
  type AuditSignals,
} from "../services/detectors/shared";

const IMPACT_RANK = { minor: 0, moderate: 1, serious: 2, critical: 3 };

/** RFC-0013 5.3: the audit's axe-core violations, one entry per cluster. */
async function accessibilityClusters(auditId: string) {
  const rows = await db
    .select({
      clusterKey: auditAccessibilityViolations.clusterKey,
      ruleId: auditAccessibilityViolations.ruleId,
      impact: auditAccessibilityViolations.impact,
      wcagTags: auditAccessibilityViolations.wcagTags,
      selector: auditAccessibilityViolations.targetSelector,
      snippet: auditAccessibilityViolations.htmlSnippet,
      url: auditPages.url,
    })
    .from(auditAccessibilityViolations)
    .innerJoin(
      auditAccessibilityResults,
      eq(auditAccessibilityResults.id, auditAccessibilityViolations.resultId),
    )
    .innerJoin(auditPages, eq(auditPages.id, auditAccessibilityResults.pageId))
    .where(eq(auditAccessibilityResults.auditId, auditId))
    .orderBy(asc(auditPages.url), asc(auditAccessibilityViolations.clusterKey));
  const clusters = new Map<string, AccessibilityCluster>();
  for (const row of rows) {
    const cluster = clusters.get(row.clusterKey) ?? {
      clusterKey: row.clusterKey,
      ruleId: row.ruleId,
      impact: row.impact,
      wcagTags: row.wcagTags,
      pageUrls: [],
      example: { url: row.url, selector: row.selector, snippet: row.snippet },
    };
    if (IMPACT_RANK[row.impact] > IMPACT_RANK[cluster.impact])
      cluster.impact = row.impact;
    if (!cluster.pageUrls.includes(row.url)) cluster.pageUrls.push(row.url);
    clusters.set(row.clusterKey, cluster);
  }
  return [...clusters.values()];
}

/** RFC-0002 phase 2 reads. Each one filters by project first. */
async function latestAudit(
  projectId: string,
  since: string,
  issueTypes: string[],
): Promise<AuditSignals | null> {
  const [audit] = await db
    .select({ id: audits.id, completedAt: audits.completedAt })
    .from(audits)
    .where(
      and(
        eq(audits.projectId, projectId),
        eq(audits.status, "completed"),
        gte(audits.completedAt, since),
      ),
    )
    .orderBy(desc(audits.completedAt))
    .limit(1);
  if (!audit?.completedAt) return null;
  const [issues, pages, inlinkRows, accessibility] = await Promise.all([
    db
      .select({
        id: auditIssues.id,
        issueType: auditIssues.issueType,
        severity: auditIssues.severity,
        pageUrl: auditIssues.pageUrl,
      })
      .from(auditIssues)
      .where(
        and(
          eq(auditIssues.auditId, audit.id),
          inArray(auditIssues.issueType, issueTypes),
        ),
      )
      .orderBy(asc(auditIssues.pageUrl), asc(auditIssues.issueType)),
    db
      .select({
        id: auditPages.id,
        url: auditPages.url,
        statusCode: auditPages.statusCode,
        isIndexable: auditPages.isIndexable,
      })
      .from(auditPages)
      .where(eq(auditPages.auditId, audit.id)),
    db
      .select({
        target: auditPageInlinks.targetPageId,
        source: auditPageInlinks.sourcePageId,
      })
      .from(auditPageInlinks)
      .where(
        and(
          eq(auditPageInlinks.projectId, projectId),
          eq(auditPageInlinks.auditId, audit.id),
        ),
      ),
    accessibilityClusters(audit.id),
  ]);
  const keys = new Map(pages.map((page) => [page.id, urlJoinKey(page.url)]));
  const inlinks = new Map<string, Set<string>>();
  for (const row of inlinkRows) {
    const target = keys.get(row.target);
    const source = keys.get(row.source);
    if (!target || !source) continue;
    inlinks.set(target, (inlinks.get(target) ?? new Set()).add(source));
  }
  return {
    auditId: audit.id,
    completedAt: audit.completedAt,
    issues,
    pages: pages.map(({ id: _id, ...page }) => page),
    inlinks,
    accessibility,
  };
}

/** Lowercase keyword to the first and last check per device since a date. */
async function rankHistory(
  projectId: string,
  since: string,
): Promise<Map<string, RankEvidence[]>> {
  const rows = await db
    .select({
      trackingKeywordId: rankSnapshots.trackingKeywordId,
      keyword: rankSnapshots.keyword,
      device: rankSnapshots.device,
      position: rankSnapshots.position,
      checkedAt: rankSnapshots.checkedAt,
    })
    .from(rankSnapshots)
    .innerJoin(rankCheckRuns, eq(rankCheckRuns.id, rankSnapshots.runId))
    .where(
      and(
        eq(rankCheckRuns.projectId, projectId),
        gte(rankSnapshots.checkedAt, since),
      ),
    )
    .orderBy(asc(rankSnapshots.checkedAt), asc(rankSnapshots.id));
  const history = new Map<string, RankEvidence>();
  for (const row of rows) {
    const key = `${row.trackingKeywordId} ${row.device}`;
    const entry = history.get(key);
    if (entry) {
      entry.lastPosition = row.position;
      entry.lastCheckedAt = row.checkedAt;
    } else
      history.set(key, {
        trackingKeywordId: row.trackingKeywordId,
        device: row.device,
        firstPosition: row.position,
        lastPosition: row.position,
        firstCheckedAt: row.checkedAt,
        lastCheckedAt: row.checkedAt,
      });
  }
  const keywords = new Map(
    rows.map((row) => [row.trackingKeywordId, row.keyword.toLowerCase()]),
  );
  const byKeyword = new Map<string, RankEvidence[]>();
  for (const entry of history.values()) {
    const keyword = keywords.get(entry.trackingKeywordId)!;
    byKeyword.set(keyword, [...(byKeyword.get(keyword) ?? []), entry]);
  }
  return byKeyword;
}

/** URL inspections reserved by the project's runs since a time. */
async function inspectionRequestsSince(
  projectId: string,
  since: string,
): Promise<number> {
  const [row] = await db
    .select({ total: sum(opportunityRuns.inspectionRequests) })
    .from(opportunityRuns)
    .where(
      and(
        eq(opportunityRuns.projectId, projectId),
        gte(opportunityRuns.startedAt, since),
      ),
    );
  return Number(row?.total ?? 0);
}

const { projectId: _audit, ...auditColumns } = getTableColumns(
  opportunityAuditEvidence,
);
const { projectId: _inspection, ...inspectionColumns } = getTableColumns(
  opportunityInspectionEvidence,
);
const { projectId: _link, ...linkColumns } = getTableColumns(
  opportunityLinkEvidence,
);
const { projectId: _rank, ...rankColumns } = getTableColumns(
  opportunityRankEvidence,
);
const { projectId: _accessibility, ...accessibilityColumns } = getTableColumns(
  opportunityAccessibilityEvidence,
);
const { projectId: _performance, ...performanceColumns } = getTableColumns(
  opportunityPerformanceEvidence,
);

/** The phase 2 evidence of one opportunity, newest run first. */
async function evidenceFor(projectId: string, opportunityId: string) {
  const [
    auditEvidence,
    inspectionEvidence,
    linkEvidence,
    rankEvidence,
    accessibilityEvidence,
    performanceEvidence,
  ] = await Promise.all([
    db
      .select(auditColumns)
      .from(opportunityAuditEvidence)
      .where(
        and(
          eq(opportunityAuditEvidence.projectId, projectId),
          eq(opportunityAuditEvidence.opportunityId, opportunityId),
        ),
      )
      .orderBy(desc(opportunityAuditEvidence.auditCompletedAt)),
    db
      .select(inspectionColumns)
      .from(opportunityInspectionEvidence)
      .where(
        and(
          eq(opportunityInspectionEvidence.projectId, projectId),
          eq(opportunityInspectionEvidence.opportunityId, opportunityId),
        ),
      )
      .orderBy(desc(opportunityInspectionEvidence.inspectedAt)),
    db
      .select(linkColumns)
      .from(opportunityLinkEvidence)
      .where(
        and(
          eq(opportunityLinkEvidence.projectId, projectId),
          eq(opportunityLinkEvidence.opportunityId, opportunityId),
        ),
      ),
    db
      .select(rankColumns)
      .from(opportunityRankEvidence)
      .where(
        and(
          eq(opportunityRankEvidence.projectId, projectId),
          eq(opportunityRankEvidence.opportunityId, opportunityId),
        ),
      )
      .orderBy(desc(opportunityRankEvidence.lastCheckedAt)),
    db
      .select(accessibilityColumns)
      .from(opportunityAccessibilityEvidence)
      .where(
        and(
          eq(opportunityAccessibilityEvidence.projectId, projectId),
          eq(opportunityAccessibilityEvidence.opportunityId, opportunityId),
        ),
      ),
    db
      .select(performanceColumns)
      .from(opportunityPerformanceEvidence)
      .where(
        and(
          eq(opportunityPerformanceEvidence.projectId, projectId),
          eq(opportunityPerformanceEvidence.opportunityId, opportunityId),
        ),
      ),
  ]);
  return {
    auditEvidence,
    inspectionEvidence,
    linkEvidence,
    rankEvidence,
    accessibilityEvidence,
    performanceEvidence,
  };
}

export const OpportunitySignalRepository = {
  evidenceFor,
  latestAudit,
  rankHistory,
  inspectionRequestsSince,
};
