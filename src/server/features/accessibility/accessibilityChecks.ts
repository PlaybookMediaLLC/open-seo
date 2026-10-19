import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import {
  accessibilityFixCheckPages,
  accessibilityFixChecks,
  auditAccessibilityResults,
  auditAccessibilityViolations,
  auditPages,
  audits,
} from "@/db/schema";
import type {
  AccessibilityFixCheck,
  AccessibilityTrend,
} from "@/types/schemas/accessibility";

const MAX_PAGES = 10;
const TREND_AUDITS = 10;

/** At most 10 pages of the project's audit where the cluster was found. */
async function affectedPages(
  projectId: string,
  auditId: string,
  clusterKey: string,
) {
  const rows = await db
    .selectDistinct({ url: auditPages.url })
    .from(auditAccessibilityViolations)
    .innerJoin(
      auditAccessibilityResults,
      eq(auditAccessibilityResults.id, auditAccessibilityViolations.resultId),
    )
    .innerJoin(audits, eq(audits.id, auditAccessibilityResults.auditId))
    .innerJoin(auditPages, eq(auditPages.id, auditAccessibilityResults.pageId))
    .where(
      and(
        eq(audits.projectId, projectId),
        eq(audits.id, auditId),
        eq(auditAccessibilityViolations.clusterKey, clusterKey),
      ),
    )
    .orderBy(asc(auditPages.url))
    .limit(MAX_PAGES);
  return rows.map((row) => row.url);
}

async function save(
  scope: { projectId: string; experimentId: string; checkedBy: string },
  check: AccessibilityFixCheck,
) {
  await runBatch((tx) => [
    tx.insert(accessibilityFixChecks).values({
      id: check.id,
      projectId: scope.projectId,
      experimentId: scope.experimentId,
      ruleId: check.ruleId,
      checkedAt: check.checkedAt,
      checkedBy: scope.checkedBy,
    }),
    ...(check.pages.length
      ? [
          tx.insert(accessibilityFixCheckPages).values(
            check.pages.map((page) => ({
              ...page,
              id: crypto.randomUUID(),
              projectId: scope.projectId,
              checkId: check.id,
            })),
          ),
        ]
      : []),
  ]);
}

async function latest(
  projectId: string,
  experimentId: string,
): Promise<AccessibilityFixCheck | null> {
  const [check] = await db
    .select({
      id: accessibilityFixChecks.id,
      ruleId: accessibilityFixChecks.ruleId,
      checkedAt: accessibilityFixChecks.checkedAt,
    })
    .from(accessibilityFixChecks)
    .where(
      and(
        eq(accessibilityFixChecks.projectId, projectId),
        eq(accessibilityFixChecks.experimentId, experimentId),
      ),
    )
    .orderBy(desc(accessibilityFixChecks.checkedAt))
    .limit(1);
  if (!check) return null;
  const pages = await db
    .select({
      url: accessibilityFixCheckPages.url,
      outcome: accessibilityFixCheckPages.outcome,
      detail: accessibilityFixCheckPages.detail,
    })
    .from(accessibilityFixCheckPages)
    .where(
      and(
        eq(accessibilityFixCheckPages.projectId, projectId),
        eq(accessibilityFixCheckPages.checkId, check.id),
      ),
    )
    .orderBy(asc(accessibilityFixCheckPages.url));
  return { ...check, pages };
}

/**
 * The serious and critical violations of the last 10 checked audits, and
 * the fixes whose newest check passed on every page.
 */
async function trend(projectId: string): Promise<AccessibilityTrend> {
  const [rows, checks, pages] = await Promise.all([
    db
      .select({
        auditId: audits.id,
        startedAt: audits.startedAt,
        pagesChecked:
          sql<number>`count(distinct case when ${auditAccessibilityResults.error} is null then ${auditAccessibilityResults.id} end)`.mapWith(
            Number,
          ),
        seriousViolations:
          sql<number>`count(${auditAccessibilityViolations.id})`.mapWith(
            Number,
          ),
      })
      .from(audits)
      .innerJoin(
        auditAccessibilityResults,
        eq(auditAccessibilityResults.auditId, audits.id),
      )
      .leftJoin(
        auditAccessibilityViolations,
        and(
          eq(
            auditAccessibilityViolations.resultId,
            auditAccessibilityResults.id,
          ),
          inArray(auditAccessibilityViolations.impact, ["serious", "critical"]),
        ),
      )
      .where(eq(audits.projectId, projectId))
      .groupBy(audits.id, audits.startedAt)
      .orderBy(desc(audits.startedAt))
      .limit(TREND_AUDITS),
    db
      .select({
        id: accessibilityFixChecks.id,
        experimentId: accessibilityFixChecks.experimentId,
      })
      .from(accessibilityFixChecks)
      .where(eq(accessibilityFixChecks.projectId, projectId))
      .orderBy(desc(accessibilityFixChecks.checkedAt)),
    db
      .select({
        checkId: accessibilityFixCheckPages.checkId,
        outcome: accessibilityFixCheckPages.outcome,
      })
      .from(accessibilityFixCheckPages)
      .where(eq(accessibilityFixCheckPages.projectId, projectId)),
  ]);
  const newest = new Map<string, string>();
  for (const check of checks)
    if (!newest.has(check.experimentId))
      newest.set(check.experimentId, check.id);
  const fixesPassed = [...newest.values()].filter((id) => {
    const outcomes = pages.filter((page) => page.checkId === id);
    return (
      outcomes.length > 0 && outcomes.every((page) => page.outcome === "passed")
    );
  }).length;
  return { audits: rows, fixesPassed };
}

export const AccessibilityCheckRepository = {
  affectedPages,
  save,
  latest,
  trend,
};
