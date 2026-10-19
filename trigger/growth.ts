import { createHmac } from "node:crypto";
import { AbortTaskRunError, batch, schedules, task } from "@trigger.dev/sdk";

// RFC-0008 5.3: tasks call the Relay Worker's signed internal endpoints.
// Payloads hold ids and window keys only; summaries hold counts.
type Item = {
  kind: string;
  projectId: string;
  scheduleId: string | null;
  windowKey: string;
};
type RunPayload = Item;

/** Signs `{timestamp}.{body}` with GROWTH_JOBS_SECRET and posts it. */
async function callWorker(path: string, body: object) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const raw = JSON.stringify(body);
  const signature = createHmac("sha256", process.env.GROWTH_JOBS_SECRET ?? "")
    .update(`${timestamp}.${raw}`)
    .digest("hex");
  return fetch(`${process.env.RELAY_INTERNAL_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-relay-timestamp": timestamp,
      "x-relay-signature": signature,
    },
    body: raw,
    signal: AbortSignal.timeout(110_000),
  });
}

const BACKOFF = {
  minTimeoutInMs: 300_000,
  maxTimeoutInMs: 1_800_000,
  factor: 6,
};

/** One child task per job kind; one run per project at a time. */
function growthTask(id: string, maxDuration: number, maxAttempts: number) {
  return task({
    id,
    maxDuration,
    retry: { maxAttempts, ...BACKOFF },
    run: async (payload: RunPayload, { ctx }) => {
      const response = await callWorker("/api/internal/growth/run", {
        ...payload,
        triggerRunId: ctx.run.id,
        attempt: ctx.attempt.number,
        maxAttempts,
      });
      const result: unknown = await response.json().catch(() => null);
      // 422 is final; anything else that is not OK retries.
      if (response.status === 422)
        throw new AbortTaskRunError(JSON.stringify(result));
      if (!response.ok) throw new Error(`Relay answered ${response.status}.`);
      return result;
    },
  });
}

export const opportunityRefresh = growthTask("opportunity-refresh", 300, 3);
export const measurementRefresh = growthTask("measurement-refresh", 300, 3);
export const deploymentCheck = growthTask("deployment-check", 180, 3);
export const trafficWatch = growthTask("traffic-watch", 120, 3);
export const recommendationRecheck = growthTask(
  "recommendation-recheck",
  60,
  2,
);
export const auditFollowup = growthTask("audit-followup", 180, 3);
export const cwvRefresh = growthTask("cwv-refresh", 180, 3);
export const revenueSync = growthTask("revenue-sync", 300, 3);
export const docsIndex = growthTask("docs-index", 300, 3);
export const supportTopics = growthTask("support-topics", 300, 3);

const TASK_IDS: Record<string, string> = {
  opportunity_refresh: "opportunity-refresh",
  measurement_refresh: "measurement-refresh",
  deployment_check: "deployment-check",
  traffic_watch: "traffic-watch",
  recommendation_recheck: "recommendation-recheck",
  audit_followup: "audit-followup",
  cwv_refresh: "cwv-refresh",
  revenue_sync: "revenue-sync",
  docs_index: "docs-index",
  support_topics: "support-topics",
};

/** Every 15 minutes: ask what is due and start one child run per item. */
export const growthDispatch = schedules.task({
  id: "growth-dispatch",
  cron: "*/15 * * * *",
  maxDuration: 120,
  retry: { maxAttempts: 2 },
  run: async () => {
    const response = await callWorker("/api/internal/growth/due", {});
    if (!response.ok) throw new Error(`Relay answered ${response.status}.`);
    const { items } = await response.json<{ items: Item[] }>();
    const runs = items.flatMap((item) => {
      const id = TASK_IDS[item.kind];
      return id
        ? [
            {
              id,
              payload: item,
              options: {
                concurrencyKey: item.projectId,
                // A second dispatch of the same window starts no new run.
                idempotencyKey: `${item.kind}:${item.projectId}:${item.windowKey}`,
                idempotencyKeyTTL: "7d",
              },
            },
          ]
        : [];
    });
    if (runs.length) await batch.trigger(runs);
    return { dispatched: runs.length };
  },
});

/** RFC-0009: every 15 minutes, retry credit settlements that failed. */
export const spendReconcile = schedules.task({
  id: "spend-reconcile",
  cron: "*/15 * * * *",
  maxDuration: 120,
  retry: { maxAttempts: 2 },
  run: async () => {
    const response = await callWorker("/api/internal/billing/reconcile", {});
    if (!response.ok) throw new Error(`Relay answered ${response.status}.`);
    return response.json();
  },
});

/** Daily: delete job history older than 180 days. */
export const growthRetention = schedules.task({
  id: "growth-retention",
  cron: "30 3 * * *",
  maxDuration: 120,
  retry: { maxAttempts: 2 },
  run: async () => {
    const response = await callWorker("/api/internal/growth/retention", {});
    if (!response.ok) throw new Error(`Relay answered ${response.status}.`);
    return response.json();
  },
});
