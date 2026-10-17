import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { sortBy } from "remeda";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import {
  auditIssues,
  audits,
  opportunityInvestigationFindings,
  opportunityInvestigations,
  opportunityRuns,
} from "@/db/schema";
import {
  INVESTIGATION_FINDING_KINDS,
  INVESTIGATION_SEVERITIES,
  type OpportunityInvestigation,
} from "@/types/schemas/investigations";

const LIST_LIMIT = 5;

/** The two periods that the opportunity's evidence run compared. */
async function getRun(projectId: string, runId: string) {
  const [run] = await db
    .select({
      siteUrl: opportunityRuns.siteUrl,
      startDate: opportunityRuns.startDate,
      endDate: opportunityRuns.endDate,
      previousStartDate: opportunityRuns.previousStartDate,
      previousEndDate: opportunityRuns.previousEndDate,
    })
    .from(opportunityRuns)
    .where(
      and(
        eq(opportunityRuns.projectId, projectId),
        eq(opportunityRuns.id, runId),
      ),
    );
  return run ?? null;
}

/** The latest completed audit's issues for one page, with or without "/". */
async function auditIssuesFor(projectId: string, url: string) {
  const [audit] = await db
    .select({ id: audits.id, completedAt: audits.completedAt })
    .from(audits)
    .where(and(eq(audits.projectId, projectId), eq(audits.status, "completed")))
    .orderBy(desc(audits.completedAt))
    .limit(1);
  if (!audit?.completedAt) return null;
  const bare = url.replace(/\/+$/, "");
  const issues = await db
    .select({
      issueType: auditIssues.issueType,
      severity: auditIssues.severity,
    })
    .from(auditIssues)
    .where(
      and(
        eq(auditIssues.auditId, audit.id),
        inArray(auditIssues.pageUrl, [bare, `${bare}/`]),
      ),
    )
    .orderBy(auditIssues.issueType);
  return { completedAt: audit.completedAt, issues };
}

async function save(
  projectId: string,
  investigation: OpportunityInvestigation,
): Promise<void> {
  const { findings, ...row } = investigation;
  await runBatch((tx) => [
    tx.insert(opportunityInvestigations).values({ ...row, projectId }),
    ...findings.map((finding) =>
      tx.insert(opportunityInvestigationFindings).values({
        ...finding,
        projectId,
        investigationId: investigation.id,
      }),
    ),
  ]);
}

const investigationColumns = {
  id: opportunityInvestigations.id,
  opportunityId: opportunityInvestigations.opportunityId,
  runId: opportunityInvestigations.runId,
  status: opportunityInvestigations.status,
  createdBy: opportunityInvestigations.createdBy,
  createdAt: opportunityInvestigations.createdAt,
  summary: opportunityInvestigations.summary,
  summaryModel: opportunityInvestigations.summaryModel,
  summaryCostUsd: opportunityInvestigations.summaryCostUsd,
  summarizedAt: opportunityInvestigations.summarizedAt,
};

async function withFindings(
  projectId: string,
  rows: Array<Omit<OpportunityInvestigation, "findings">>,
): Promise<OpportunityInvestigation[]> {
  if (!rows.length) return [];
  const findings = await db
    .select({
      id: opportunityInvestigationFindings.id,
      investigationId: opportunityInvestigationFindings.investigationId,
      kind: opportunityInvestigationFindings.kind,
      severity: opportunityInvestigationFindings.severity,
      summary: opportunityInvestigationFindings.summary,
      metricBefore: opportunityInvestigationFindings.metricBefore,
      metricAfter: opportunityInvestigationFindings.metricAfter,
    })
    .from(opportunityInvestigationFindings)
    .where(
      and(
        eq(opportunityInvestigationFindings.projectId, projectId),
        inArray(
          opportunityInvestigationFindings.investigationId,
          rows.map((row) => row.id),
        ),
      ),
    );
  // Most severe first, so the page and the summary prompt read the same way.
  const sorted = sortBy(
    findings,
    (finding) => INVESTIGATION_SEVERITIES.indexOf(finding.severity),
    (finding) => INVESTIGATION_FINDING_KINDS.indexOf(finding.kind),
    (finding) => finding.summary,
  );
  return rows.map((row) => ({
    ...row,
    findings: sorted
      .filter((finding) => finding.investigationId === row.id)
      .map(({ investigationId: _id, ...finding }) => finding),
  }));
}

/** An opportunity's newest investigations, with their findings. */
async function list(projectId: string, opportunityId: string) {
  const rows = await db
    .select(investigationColumns)
    .from(opportunityInvestigations)
    .where(
      and(
        eq(opportunityInvestigations.projectId, projectId),
        eq(opportunityInvestigations.opportunityId, opportunityId),
      ),
    )
    .orderBy(
      desc(opportunityInvestigations.createdAt),
      desc(opportunityInvestigations.id),
    )
    .limit(LIST_LIMIT);
  return withFindings(projectId, rows);
}

async function get(projectId: string, id: string) {
  const rows = await db
    .select(investigationColumns)
    .from(opportunityInvestigations)
    .where(
      and(
        eq(opportunityInvestigations.projectId, projectId),
        eq(opportunityInvestigations.id, id),
      ),
    );
  return (await withFindings(projectId, rows))[0] ?? null;
}

/** Stores the first summary only; false when one exists already. */
async function saveSummary(
  projectId: string,
  id: string,
  summary: { summary: string; model: string; costUsd: number },
): Promise<boolean> {
  const rows = await db
    .update(opportunityInvestigations)
    .set({
      summary: summary.summary,
      summaryModel: summary.model,
      summaryCostUsd: summary.costUsd,
      summarizedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(opportunityInvestigations.projectId, projectId),
        eq(opportunityInvestigations.id, id),
        isNull(opportunityInvestigations.summary),
      ),
    )
    .returning({ id: opportunityInvestigations.id });
  return rows.length > 0;
}

export const InvestigationRepository = {
  getRun,
  auditIssuesFor,
  save,
  list,
  get,
  saveSummary,
};
