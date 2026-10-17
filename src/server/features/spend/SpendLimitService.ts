import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import { projects, spendLedger, spendLimits } from "@/db/schema";
import { hasOrgPermission } from "@/lib/org-permissions";
import { requireOrgPermission } from "@/server/auth/org-gate";
import {
  committedCredits,
  limitUse,
  periodOf,
} from "@/server/billing/spendQueries";
import {
  authorize,
  type OpportunityContext,
} from "@/server/features/opportunities/services/opportunityAccess";

// RFC-0009 5.5: members see the limits and this month's committed spend;
// only owners (billing:manage) change a limit.
const canManage = (context: OpportunityContext) =>
  hasOrgPermission(context.role, { billing: ["manage"] });

async function organization(context: OpportunityContext) {
  const { organizationId } = context;
  const periodMonth = periodOf(new Date());
  const inPeriod = and(
    eq(spendLedger.organizationId, organizationId),
    eq(spendLedger.periodMonth, periodMonth),
  );
  const [limits, projectRows, byProject, byFeature] = await Promise.all([
    db
      .select()
      .from(spendLimits)
      .where(eq(spendLimits.organizationId, organizationId)),
    db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(
        and(
          eq(projects.organizationId, organizationId),
          isNull(projects.archivedAt),
        ),
      ),
    db
      .select({ projectId: spendLedger.projectId, credits: committedCredits })
      .from(spendLedger)
      .where(inPeriod)
      .groupBy(spendLedger.projectId),
    db
      .select({ feature: spendLedger.feature, credits: committedCredits })
      .from(spendLedger)
      .where(inPeriod)
      .groupBy(spendLedger.feature),
  ]);
  const spentOn = (projectId: string | null) =>
    Number(byProject.find((row) => row.projectId === projectId)?.credits ?? 0);
  return {
    periodMonth,
    canManage: canManage(context),
    limit:
      limits.find((row) => row.projectId === null)?.monthlyLimitCredits ?? null,
    committed: byProject.reduce((sum, row) => sum + Number(row.credits), 0),
    projects: projectRows.map((row) => ({
      ...row,
      committed: spentOn(row.id),
      limit:
        limits.find((limitRow) => limitRow.projectId === row.id)
          ?.monthlyLimitCredits ?? null,
    })),
    features: byFeature
      .map((row) => ({ feature: row.feature, committed: Number(row.credits) }))
      .filter((row) => row.committed > 0),
  };
}

async function project(context: OpportunityContext, projectId: string) {
  await authorize(context, projectId);
  const periodMonth = periodOf(new Date());
  const uses = await limitUse(context.organizationId, projectId, periodMonth);
  const [spent] = await db
    .select({ credits: committedCredits })
    .from(spendLedger)
    .where(
      and(
        eq(spendLedger.projectId, projectId),
        eq(spendLedger.periodMonth, periodMonth),
      ),
    );
  return {
    periodMonth,
    canManage: canManage(context),
    committed: Number(spent?.credits ?? 0),
    limit: uses.find((use) => use.scope === "project")?.limit ?? null,
    uses,
  };
}

/** Sets or removes (null) the organization's or a project's limit. */
async function save(
  context: OpportunityContext,
  input: { projectId: string | null; monthlyLimitCredits: number | null },
) {
  requireOrgPermission(context, { billing: ["manage"] });
  if (input.projectId) await authorize(context, input.projectId);
  const scope = and(
    eq(spendLimits.organizationId, context.organizationId),
    input.projectId
      ? eq(spendLimits.projectId, input.projectId)
      : isNull(spendLimits.projectId),
  );
  const limit = input.monthlyLimitCredits;
  await runBatch((tx) => [
    tx.delete(spendLimits).where(scope),
    ...(limit === null
      ? []
      : [
          tx.insert(spendLimits).values({
            id: crypto.randomUUID(),
            organizationId: context.organizationId,
            projectId: input.projectId,
            monthlyLimitCredits: limit,
            updatedBy: context.userId,
            updatedAt: new Date().toISOString(),
          }),
        ]),
  ]);
}

export const SpendLimitService = { organization, project, save };
