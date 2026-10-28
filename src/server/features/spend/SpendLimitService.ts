import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import { spendLedger, spendLimits } from "@/db/schema";
import { hasOrgPermission } from "@/lib/org-permissions";
import { requireOrgPermission } from "@/server/auth/org-gate";
import { auditInsert } from "@/server/features/activity/auditLog";
import {
  committedCredits,
  limitUse,
  organizationSpend,
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
  return {
    ...(await organizationSpend(context.organizationId)),
    canManage: canManage(context),
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
    auditInsert(tx, {
      organizationId: context.organizationId,
      projectId: input.projectId,
      actor: context,
      action: "spend_limit.changed",
      targetType: input.projectId ? "project" : "organization",
      targetId: input.projectId ?? context.organizationId,
      summary:
        limit === null
          ? "Removed the monthly credit limit"
          : `Set the monthly credit limit to ${limit} credits`,
    }),
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
