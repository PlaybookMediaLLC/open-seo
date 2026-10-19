import { syncRevenue } from "@/server/features/revenue/revenueSync";
import type { JobContext } from "../growthJobs";

/** RFC-0016 5.4: the daily Stripe revenue sync. */
export async function revenueSyncJob(context: JobContext) {
  const result = await syncRevenue(context.projectId, context.now);
  if (!result.connected)
    return { summary: "Skipped: Stripe is not connected." };
  if (result.refundsSkipped) context.log("warn", "The key cannot read refunds");
  return {
    summary: `Read ${result.invoices} paid invoices and stored ${result.rows} payments${result.complete ? "" : "; the rest follows in the next run"}.${result.refundsSkipped ? " Refunds were skipped: give the key read access to Refunds and Charges." : ""}`,
  };
}
