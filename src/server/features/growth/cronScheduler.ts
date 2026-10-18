import { reconcileSpend } from "@/server/billing/spendReconcile";
import { GrowthJobService } from "./GrowthJobService";
import { growthJobsMode } from "./internalAuth";
import { GrowthJobRepository } from "./repositories/GrowthJobRepository";

// RFC-0008 without Trigger.dev (owner decision, 2026-10-18): the Worker's
// five-minute cron does the dispatch every 15 minutes. It runs the due jobs
// one at a time, retries a failed window on later ticks, reconciles failed
// credit settlements, and deletes old history once a day.
const MAX_ATTEMPTS = 3;
// A cron run may last 15 minutes; stop starting jobs well before that.
const TICK_BUDGET_MS = 10 * 60_000;

/** Called on every five-minute tick; acts on the :00, :15, :30, :45 ticks. */
export async function runGrowthCron(scheduledTime: number) {
  if ((await growthJobsMode()) !== "cron") return { ran: 0 };
  const now = new Date(scheduledTime);
  const minute = now.getUTCMinutes();
  if (minute % 15 >= 5) return { ran: 0 };
  await reconcileSpend().catch((error: unknown) =>
    console.error("[cron] spend reconcile failed", error),
  );
  if (now.getUTCHours() === 3 && minute >= 30 && minute < 35)
    await GrowthJobService.retention(now).catch((error: unknown) =>
      console.error("[cron] growth retention failed", error),
    );
  const started = Date.now();
  let ran = 0;
  for (const item of (await GrowthJobService.due(now)).items) {
    if (Date.now() - started > TICK_BUDGET_MS) break;
    const attempt =
      (await GrowthJobRepository.attempts(
        item.projectId,
        item.kind,
        item.windowKey,
      )) + 1;
    // A window past its last attempt already told the project and moved on.
    if (attempt > MAX_ATTEMPTS) continue;
    await GrowthJobService.run(
      { ...item, attempt, maxAttempts: MAX_ATTEMPTS, triggerRunId: null },
      now,
    ).catch((error: unknown) =>
      console.error("[cron] growth job failed", item.kind, error),
    );
    ran++;
  }
  return { ran };
}
