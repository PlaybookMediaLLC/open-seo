import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  auditAccessibilityHeadings,
  auditAccessibilityResults,
  auditAccessibilityViolations,
  auditPages,
  audits,
} from "@/db/schema";
import type { AccessibilityEvidence } from "@/types/schemas/opportunities";

/** RFC-0013 5.4 phase 2: stored facts that a ticket shows for a cluster. */
export type AccessibilityTicketFacts = {
  summary: string | null;
  headings: Array<{ level: number; text: string }>;
};

/**
 * The axe-core failure summary on the example page and, for heading-order,
 * that page's headings. Stored rows only, so the ticket text is stable.
 */
export async function accessibilityTicketFacts(
  projectId: string,
  evidence: AccessibilityEvidence,
): Promise<AccessibilityTicketFacts> {
  const examplePage = and(
    eq(audits.projectId, projectId),
    eq(audits.id, evidence.auditId),
    eq(auditPages.url, evidence.exampleUrl),
  );
  const [[example], headings] = await Promise.all([
    db
      .select({ summary: auditAccessibilityViolations.failureSummary })
      .from(auditAccessibilityViolations)
      .innerJoin(
        auditAccessibilityResults,
        eq(auditAccessibilityResults.id, auditAccessibilityViolations.resultId),
      )
      .innerJoin(audits, eq(audits.id, auditAccessibilityResults.auditId))
      .innerJoin(
        auditPages,
        eq(auditPages.id, auditAccessibilityResults.pageId),
      )
      .where(
        and(
          examplePage,
          eq(auditAccessibilityViolations.clusterKey, evidence.clusterKey),
        ),
      )
      .orderBy(
        asc(auditAccessibilityViolations.targetSelector),
        asc(auditAccessibilityViolations.id),
      )
      .limit(1),
    evidence.ruleId === "heading-order"
      ? db
          .select({
            level: auditAccessibilityHeadings.level,
            text: auditAccessibilityHeadings.text,
          })
          .from(auditAccessibilityHeadings)
          .innerJoin(
            auditAccessibilityResults,
            eq(
              auditAccessibilityResults.id,
              auditAccessibilityHeadings.resultId,
            ),
          )
          .innerJoin(audits, eq(audits.id, auditAccessibilityResults.auditId))
          .innerJoin(
            auditPages,
            eq(auditPages.id, auditAccessibilityResults.pageId),
          )
          .where(examplePage)
          .orderBy(asc(auditAccessibilityHeadings.position))
      : [],
  ]);
  return { summary: example?.summary ?? null, headings };
}
