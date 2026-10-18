import { OpportunityRepository } from "@/server/features/opportunities/repositories/OpportunityRepository";
import { OpportunityService } from "@/server/features/opportunities/services/OpportunityService";
import { AppError } from "@/server/lib/errors";
import { listOpportunitiesInputSchema } from "@/types/schemas/opportunities";
import type { JobContext } from "../growthJobs";
import { GrowthJobRepository } from "../repositories/GrowthJobRepository";

// RFC-0008 5.8: refresh the opportunity queue, and re-check old items.
const NOTIFY_PRIORITY = 50;
const list = (projectId: string, filters: object) =>
  OpportunityRepository.list(
    listOpportunitiesInputSchema.parse({ projectId, ...filters }),
  );

export async function opportunityRefreshJob(context: JobContext) {
  const result = await OpportunityService.detect(
    context.actor,
    context.projectId,
  );
  context.log("info", result.message);
  // A failed analysis retries; busy, cached and unconnected ones are done.
  if (result.outcome === "failed")
    throw new AppError("UPSTREAM_UNAVAILABLE", result.message);
  const run = result.run;
  if (result.outcome !== "completed" || !run?.finishedAt)
    return { summary: result.message };
  // Items first found by this run have their first detection at its end.
  const fresh = (
    await list(context.projectId, {
      status: "discovered",
      minPriority: NOTIFY_PRIORITY,
      limit: 100,
    })
  ).rows.filter((row) => row.firstDetectedAt === run.finishedAt);
  if (fresh.length)
    await GrowthJobRepository.notify({
      organizationId: context.organizationId,
      projectId: context.projectId,
      kind: "new_opportunities",
      title: `${fresh.length} new ${fresh.length === 1 ? "opportunity" : "opportunities"}`,
      body: `The weekly analysis found ${fresh.length} new items with priority ${NOTIFY_PRIORITY} or higher. The highest: ${fresh[0]?.title ?? ""}.`,
      linkPath: `/p/${context.projectId}/opportunities`,
      dedupeKey: run.id,
    });
  return {
    summary: `${result.message} ${fresh.length} new high-priority items.`,
  };
}

/** Counts open items that the latest analysis no longer found. */
export async function recommendationRecheckJob(context: JobContext) {
  const totals = await Promise.all(
    (["discovered", "reviewed"] as const).map(
      async (status) =>
        (
          await list(context.projectId, {
            status,
            freshness: "stale",
            limit: 1,
          })
        ).total,
    ),
  );
  const stale = totals.reduce((sum, value) => sum + value, 0);
  if (stale)
    await GrowthJobRepository.notify({
      organizationId: context.organizationId,
      projectId: context.projectId,
      kind: "stale_recommendations",
      title: `${stale} recommendations are not in the latest analysis`,
      body: "Review them, or reject the ones that no longer apply. Relay changed no status.",
      linkPath: `/p/${context.projectId}/opportunities`,
      dedupeKey: context.now.toISOString().slice(0, 10),
    });
  return { summary: `${stale} open items are not in the latest analysis.` };
}
