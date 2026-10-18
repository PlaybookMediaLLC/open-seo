import { and, desc, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { auditIssues, audits, opportunityEvidence } from "@/db/schema";
import { OpportunityRepository } from "@/server/features/opportunities/repositories/OpportunityRepository";
import { OpportunityService } from "@/server/features/opportunities/services/OpportunityService";
import { urlJoinKey } from "@/server/features/opportunities/services/detectors/shared";
import type { JobContext } from "../growthJobs";
import { GrowthJobRepository } from "../repositories/GrowthJobRepository";

// RFC-0008 5.8: after an audit completes, tell the project about new
// critical issues on pages that get search impressions.
const MAX_LISTED = 10;

/** The member who started the audit runs its follow-up. */
export async function auditStarter(projectId: string, auditId: string) {
  const [row] = await db
    .select({ userId: audits.startedByUserId })
    .from(audits)
    .where(and(eq(audits.projectId, projectId), eq(audits.id, auditId)));
  return row?.userId ?? null;
}

async function criticalIssues(auditId: string) {
  const rows = await db
    .select({ pageUrl: auditIssues.pageUrl, issueType: auditIssues.issueType })
    .from(auditIssues)
    .where(
      and(
        eq(auditIssues.auditId, auditId),
        eq(auditIssues.severity, "critical"),
      ),
    );
  return rows;
}

/** Pages with impressions in the latest Search Console analysis. */
async function pagesWithImpressions(projectId: string) {
  const run = await OpportunityRepository.latestRun(
    projectId,
    undefined,
    "search_console",
  );
  if (!run) return new Set<string>();
  const rows = await db
    .selectDistinct({ url: opportunityEvidence.url })
    .from(opportunityEvidence)
    .where(
      and(
        eq(opportunityEvidence.projectId, projectId),
        eq(opportunityEvidence.runId, run.id),
        gt(opportunityEvidence.impressions, 0),
      ),
    );
  return new Set(rows.flatMap((row) => (row.url ? [urlJoinKey(row.url)] : [])));
}

export async function auditFollowupJob(context: JobContext) {
  const auditId = context.windowKey;
  const [current] = await db
    .select({ completedAt: audits.completedAt })
    .from(audits)
    .where(
      and(
        eq(audits.projectId, context.projectId),
        eq(audits.id, auditId),
        eq(audits.status, "completed"),
      ),
    );
  if (!current?.completedAt) return { summary: "The audit is not complete." };
  const [previous] = await db
    .select({ id: audits.id })
    .from(audits)
    .where(
      and(
        eq(audits.projectId, context.projectId),
        eq(audits.status, "completed"),
        lt(audits.completedAt, current.completedAt),
      ),
    )
    .orderBy(desc(audits.completedAt))
    .limit(1);
  const known = new Set(
    (previous ? await criticalIssues(previous.id) : []).map(
      (row) => `${urlJoinKey(row.pageUrl)} ${row.issueType}`,
    ),
  );
  const searched = await pagesWithImpressions(context.projectId);
  const fresh = (await criticalIssues(auditId)).filter(
    (row) =>
      !known.has(`${urlJoinKey(row.pageUrl)} ${row.issueType}`) &&
      searched.has(urlJoinKey(row.pageUrl) ?? ""),
  );
  if (fresh.length)
    await GrowthJobRepository.notify({
      organizationId: context.organizationId,
      projectId: context.projectId,
      kind: "new_technical_issues",
      title: `${fresh.length} new critical issues on pages with search traffic`,
      body: fresh
        .slice(0, MAX_LISTED)
        .map((row) => `${row.issueType.replaceAll("_", " ")}: ${row.pageUrl}`)
        .join("\n"),
      linkPath: `/p/${context.projectId}/audit`,
      dedupeKey: auditId,
    });
  // The analysis keeps its own cooldown; a busy or cached result is fine.
  const refresh = await OpportunityService.detect(
    context.actor,
    context.projectId,
  );
  context.log("info", refresh.message);
  return {
    summary: `${fresh.length} new critical issues on pages with impressions. ${refresh.message}`,
  };
}
