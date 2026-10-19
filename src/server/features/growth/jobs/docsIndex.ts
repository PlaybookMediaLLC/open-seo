import { indexDocs, indexSummary } from "@/server/features/docs/docsIndex";
import type { JobContext } from "../growthJobs";

/** RFC-0017 5.2: the daily docs index. */
export async function docsIndexJob(context: JobContext) {
  const result = await indexDocs(context.projectId, context.now);
  return {
    summary: result
      ? indexSummary(result)
      : "Skipped: set the docs path and directory first.",
  };
}
