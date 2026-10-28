import { db } from "@/db";
import { growthJobRuns } from "@/db/schema";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";
import { growthJobsMode } from "./internalAuth";

// RFC-0008 5.8: the site-audit workflow queues its follow-up job here. Keep
// this module light: the audit worker bundles everything it imports.
const TRIGGER_API =
  "https://api.trigger.dev/api/v1/tasks/audit-followup/trigger";

/**
 * Called by the site-audit workflow when an audit completes. It never throws:
 * when Trigger.dev cannot take the run, a queued row waits for the dispatch.
 */
export async function queueAuditFollowup(projectId: string, auditId: string) {
  try {
    if ((await growthJobsMode()) === "off") return;
    const payload = {
      kind: "audit_followup",
      projectId,
      scheduleId: null,
      windowKey: auditId,
    };
    const key = await getOptionalEnvValue("TRIGGER_SECRET_KEY");
    if (key) {
      const response = await fetch(TRIGGER_API, {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          payload,
          options: {
            idempotencyKey: `audit:${auditId}`,
            concurrencyKey: projectId,
          },
        }),
        signal: AbortSignal.timeout(10_000),
        // A network failure falls through to the queued row.
      }).catch(() => null);
      await response?.body?.cancel();
      if (response?.ok) return;
    }
    await db
      .insert(growthJobRuns)
      .values({
        id: crypto.randomUUID(),
        projectId,
        kind: "audit_followup",
        windowKey: auditId,
        attempt: 0,
        status: "queued",
        createdAt: new Date().toISOString(),
      })
      .onConflictDoNothing();
  } catch (error) {
    console.warn("Audit follow-up was not queued", {
      projectId,
      auditId,
      error: error instanceof Error ? error.name : "unknown",
    });
  }
}
