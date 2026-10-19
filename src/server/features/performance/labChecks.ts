import type { BillingCustomerContext } from "@/server/billing/subscription";
import { createDataforseoClient } from "@/server/lib/dataforseo/client";
import { asAppError } from "@/server/lib/errors";

// RFC-0014 5.6: three billed Lighthouse runs on one page, one after another,
// in the audit worker. Only the metrics leave it: the multi-MB payloads that
// once ran the app worker out of memory stay here.
export const LAB_RUNS = 3;
export type LabCheckInput = { url: string; customer: BillingCustomerContext };
type LabRun = {
  lcpMs: number | null;
  cls: number | null;
  tbtMs: number | null;
  score: number | null;
} | null;
// These stop the runs: the next one would be refused for the same reason.
const STOPS = new Set([
  "INSUFFICIENT_CREDITS",
  "SPEND_LIMIT_REACHED",
  "PAYMENT_REQUIRED",
]);

export async function runLabChecks(
  input: LabCheckInput,
): Promise<{ runs: LabRun[]; refused: string | null }> {
  const client = createDataforseoClient(input.customer);
  const runs: LabRun[] = [];
  for (let run = 0; run < LAB_RUNS; run++)
    try {
      const report = await client.lighthouse.live({
        url: input.url,
        strategy: "mobile",
      });
      runs.push({
        lcpMs: report.metrics.largestContentfulPaint.numericValue,
        cls: report.metrics.cumulativeLayoutShift.numericValue,
        tbtMs: report.metrics.totalBlockingTime.numericValue,
        score: report.scores.performance,
      });
    } catch (error) {
      const code = asAppError(error)?.code;
      if (code && STOPS.has(code)) return { runs, refused: code };
      runs.push(null);
    }
  return { runs, refused: null };
}
