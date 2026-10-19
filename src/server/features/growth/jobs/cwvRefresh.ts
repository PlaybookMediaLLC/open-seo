import { refreshFieldData } from "@/server/features/performance/fieldData";
import type { JobContext } from "../growthJobs";

/** RFC-0014 5.2: the weekly Chrome UX Report refresh. */
export async function cwvRefreshJob(context: JobContext) {
  const result = await refreshFieldData(context.projectId, context.now);
  if (!result.configured) {
    context.log("warn", "CRUX_API_KEY is not set");
    return { summary: "Skipped: Chrome UX Report access is not configured." };
  }
  if (result.failed) context.log("warn", `${result.failed} requests failed`);
  return {
    summary: `Stored ${result.stored} field data records; ${result.noData} targets have too few Chrome users; ${result.failed} requests failed.`,
  };
}
