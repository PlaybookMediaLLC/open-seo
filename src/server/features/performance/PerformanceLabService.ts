import { env } from "cloudflare:workers";
import { and, desc, eq } from "drizzle-orm";
import { sort } from "remeda";
import { db } from "@/db";
import { performanceLabChecks } from "@/db/schema";
import { DataRefreshClaimRepository } from "@/server/features/dashboard/repositories/DataRefreshClaimRepository";
import {
  get,
  type OpportunityContext,
} from "@/server/features/opportunities/services/opportunityAccess";
import { authorizePublishing } from "@/server/features/publishing/publishingAccess";
import type { DraftContext } from "@/server/features/publishing/draftAdmission";
import { dataforseoPricing } from "@/server/lib/dataforseo/pricing";
import { AppError } from "@/server/lib/errors";
import { isHostedServerAuthMode } from "@/server/lib/runtime-env";
import {
  autumnSeoDataCreditsToUsd,
  creditsForProviderUsd,
} from "@/shared/billing";
import { LAB_RUNS } from "./labChecks";

// RFC-0014 5.6: a lab check is three Lighthouse runs on the measured page,
// with the median of each metric. The audit worker runs them and bills each
// run; the result labels the newest check before the change against the
// newest one after it.
const HISTORY = 10;

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = sort(values, (a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

async function evidenceOf(
  context: OpportunityContext,
  input: { projectId: string; opportunityId: string },
) {
  const detail = await get(context, input.projectId, input.opportunityId);
  const evidence = detail.performanceEvidence.find(
    (row) => row.runId === detail.opportunity.evidenceRunId,
  );
  if (!evidence || evidence.scope !== "url")
    throw new AppError(
      "VALIDATION_ERROR",
      "Lab checks need a performance item about one page.",
    );
  const [changed] = sort(
    detail.decisions.filter((decision) => decision.toStatus === "implemented"),
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  );
  return { evidence, changedAt: changed?.createdAt ?? null };
}

/** The checks of an item, its cost estimate and its lab result. */
async function state(
  context: OpportunityContext,
  input: { projectId: string; opportunityId: string },
) {
  const { evidence, changedAt } = await evidenceOf(context, input);
  const callUsd = dataforseoPricing.lighthouse.live({
    url: evidence.target,
    strategy: "mobile",
  });
  const estimateUsd = (await isHostedServerAuthMode())
    ? autumnSeoDataCreditsToUsd(LAB_RUNS * creditsForProviderUsd(callUsd))
    : LAB_RUNS * callUsd;
  const checks = await db
    .select()
    .from(performanceLabChecks)
    .where(
      and(
        eq(performanceLabChecks.projectId, input.projectId),
        eq(performanceLabChecks.opportunityId, input.opportunityId),
      ),
    )
    .orderBy(desc(performanceLabChecks.ranAt))
    .limit(HISTORY);
  // Only checks with all three runs compare.
  const complete = checks.filter((check) => check.runs === LAB_RUNS);
  const before = changedAt
    ? complete.find((check) => check.ranAt < changedAt)
    : undefined;
  const after = changedAt
    ? complete.find((check) => check.ranAt >= changedAt)
    : undefined;
  return {
    metric: evidence.metric,
    estimateUsd,
    changedAt,
    checks,
    comparison: before && after ? { before, after } : null,
  };
}

async function run(
  context: DraftContext,
  input: { projectId: string; opportunityId: string },
) {
  await authorizePublishing(context, input.projectId, true);
  const { evidence } = await evidenceOf(context, input);
  if (!env.AUDIT_ENGINE)
    throw new AppError(
      "VALIDATION_ERROR",
      "Lab checks run in the audit worker, which this server does not have.",
    );
  const key = `lab-check:${input.opportunityId}`;
  const token = await DataRefreshClaimRepository.claim(
    key,
    context.organizationId,
  );
  if (!token)
    return {
      ok: false,
      message:
        "A lab check of this page is running. Try again in a few minutes.",
    };
  try {
    const result = await env.AUDIT_ENGINE.runLabChecks({
      url: evidence.target,
      customer: {
        organizationId: context.organizationId,
        userId: context.userId,
        userEmail: context.userEmail,
        projectId: input.projectId,
      },
    });
    const runs = result.runs.flatMap((item) => (item ? [item] : []));
    if (runs.length)
      await db.insert(performanceLabChecks).values({
        id: crypto.randomUUID(),
        projectId: input.projectId,
        opportunityId: input.opportunityId,
        url: evidence.target,
        ranAt: new Date().toISOString(),
        ranBy: context.userId,
        runs: runs.length,
        lcpMs: median(runs.flatMap((item) => item.lcpMs ?? [])),
        cls: median(runs.flatMap((item) => item.cls ?? [])),
        tbtMs: median(runs.flatMap((item) => item.tbtMs ?? [])),
        performanceScore: median(runs.flatMap((item) => item.score ?? [])),
      });
    if (result.refused)
      return {
        ok: false,
        message: `Lighthouse stopped after ${runs.length} of ${LAB_RUNS} runs: your credits or spending limits have no room.`,
      };
    return {
      ok: runs.length === LAB_RUNS,
      message:
        runs.length === LAB_RUNS
          ? "Lab check finished: the medians of 3 Lighthouse runs are stored."
          : `${LAB_RUNS - runs.length} of ${LAB_RUNS} Lighthouse runs failed. A check with fewer than 3 runs does not compare.`,
    };
  } finally {
    await DataRefreshClaimRepository.finish(key, token, 0);
  }
}

export const PerformanceLabService = { state, run };
