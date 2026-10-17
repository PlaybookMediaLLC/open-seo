import { eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { spendLedger, spendLimits } from "@/db/schema";

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
