import { processSupportTickets } from "@/server/features/support/supportSync";
import type { JobContext } from "../growthJobs";

/** RFC-0017 5.4: the daily support topics from GitHub Issues. */
export async function supportTopicsJob(context: JobContext) {
  const result = await processSupportTickets(context.projectId, context.now, {
    organizationId: context.organizationId,
    userId: context.actor.userId,
    userEmail: "system@openseo.so",
    projectId: context.projectId,
  });
  return {
    summary:
      result.status === "off"
        ? "Skipped: support topics are off on this server."
        : result.status === "not_connected"
          ? "Skipped: GitHub Issues is not connected as a support source."
          : `Grouped ${result.tickets} tickets from the last 90 days into ${result.topics} topics.`,
  };
}
