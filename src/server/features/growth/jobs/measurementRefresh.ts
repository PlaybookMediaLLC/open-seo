import { MeasurementService } from "@/server/features/experiments/MeasurementService";
import { measurementRefreshDue } from "@/server/features/experiments/measurementSchedule";
import { ExperimentRepository } from "@/server/features/experiments/repositories/ExperimentRepository";
import type { JobContext } from "../growthJobs";
import { GrowthJobRepository } from "../repositories/GrowthJobRepository";

/**
 * RFC-0008 5.8 and RFC-0006 5.3: refresh each due experiment through the
 * normal measurement service, then tell the project when a result is final.
 */
export async function measurementRefreshJob(context: JobContext) {
  const { items } = await ExperimentRepository.list({
    projectId: context.projectId,
    limit: 100,
    offset: 0,
  });
  const due = items.filter((item) =>
    measurementRefreshDue(item, item.latestRun, context.now),
  );
  let finals = 0;
  for (const item of due) {
    const result = await MeasurementService.refresh(context.actor, {
      projectId: context.projectId,
      experimentId: item.id,
    });
    context.log(
      result.ok ? "info" : "warn",
      `${item.targetUrl}: ${result.message}`,
    );
    const detail = await ExperimentRepository.get(context.projectId, item.id);
    const final = detail?.latestRun;
    if (!final?.windowComplete) continue;
    finals++;
    const path = new URL(item.targetUrl).pathname;
    await GrowthJobRepository.notify({
      organizationId: context.organizationId,
      projectId: context.projectId,
      kind: "result_ready",
      title: `Result ready: ${final.outcome} for ${path}`,
      body:
        final.outcome === "negative"
          ? `${final.explanation} Review the page. You can prepare a revert.`
          : final.explanation,
      linkPath: `/p/${context.projectId}/experiments/${item.id}`,
      dedupeKey: item.id,
    });
  }
  return {
    summary: `Refreshed ${due.length} of ${items.length} experiments; ${finals} final results.`,
  };
}
