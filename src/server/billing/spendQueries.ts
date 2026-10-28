import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { projects, spendLedger, spendLimits } from "@/db/schema";

// RFC-0009 5.2: committed spend for a month is the real cost once known,
// plus the estimate of rows that are still admitted.
export const periodOf = (now: Date) => now.toISOString().slice(0, 7);

export const committedCredits = sql<number>`coalesce(sum(case when ${spendLedger.status} = 'admitted' then ${spendLedger.estimatedCredits} when ${spendLedger.status} in ('settled', 'settle_failed') then coalesce(${spendLedger.actualCredits}, 0) else 0 end), 0)`;

export function committedIn(scope: SQL, periodMonth: string) {
  return sql<number>`(select ${committedCredits} from ${spendLedger} where ${scope} and ${spendLedger.periodMonth} = ${periodMonth})`;
}

export type LimitUse = {
  scope: "project" | "organization";
  limit: number;
  committed: number;
};

/** The project's and the organization's limits with this month's spend. */
export async function limitUse(
  organizationId: string,
  projectId: string | null,
  periodMonth: string,
): Promise<LimitUse[]> {
  const limits = (
    await db
      .select()
      .from(spendLimits)
      .where(eq(spendLimits.organizationId, organizationId))
  ).filter((row) => row.projectId === null || row.projectId === projectId);
  if (!limits.length) return [];
  const [totals] = await db
    .select({
      organization: committedIn(
        eq(spendLedger.organizationId, organizationId),
        periodMonth,
      ),
      project: committedIn(
        eq(spendLedger.projectId, projectId ?? ""),
        periodMonth,
      ),
    })
    .from(spendLimits)
    .limit(1);
  return limits.map((row) => ({
    scope: row.projectId ? "project" : "organization",
    limit: row.monthlyLimitCredits,
    committed: Number(
      row.projectId ? (totals?.project ?? 0) : (totals?.organization ?? 0),
    ),
  }));
}

/**
 * This month's committed spend and the limits of an organization and each of
 * its active projects (RFC-0009 5.5). Shared by the spending card and the
 * portfolio summary (RFC-0007 6.1); callers authorize the organization.
 */
export async function organizationSpend(organizationId: string): Promise<{
  periodMonth: string;
  limit: number | null;
  committed: number;
  projects: {
    id: string;
    name: string;
    committed: number;
    limit: number | null;
  }[];
  features: { feature: string | null; committed: number }[];
}> {
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
