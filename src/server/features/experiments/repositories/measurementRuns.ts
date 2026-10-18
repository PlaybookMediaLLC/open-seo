import {
  and,
  eq,
  exists,
  gt,
  isNotNull,
  isNull,
  ne,
  notExists,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import { growthExperiments, measurementRuns } from "@/db/schema";
import type { MeasurementRun } from "@/types/schemas/experiments";
import {
  claimExists,
  lockClaim,
  selectedValues,
} from "../../publishing/repositories/publishingSql";
import {
  currentProperty,
  experimentScope,
  lockProperty,
  type ExperimentScope,
} from "./experimentSql";
import {
  auditInsert,
  type AuditInput,
} from "@/server/features/activity/auditLog";

export async function startRun(input: {
  run: MeasurementRun;
  claimToken: string;
  organizationId: string;
  audit?: AuditInput;
}): Promise<boolean> {
  const { run } = input;
  if (run.status !== "running") return false;
  const scope = {
    ...input,
    projectId: run.projectId,
    experimentId: run.experimentId,
  };
  const admissionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const dayAgo = new Date(Date.now() - 86400_000).toISOString();
  const fiveMinutesAgo = new Date(Date.now() - 300_000).toISOString();
  await runBatch((tx) => {
    const runScope = and(
      eq(measurementRuns.projectId, run.projectId),
      eq(measurementRuns.experimentId, run.experimentId),
    );
    const accepted = exists(
      tx
        .select({ id: measurementRuns.id })
        .from(measurementRuns)
        .where(
          and(
            runScope,
            eq(measurementRuns.id, run.id),
            eq(measurementRuns.completionToken, admissionId),
          ),
        ),
    );
    return [
      lockClaim(tx, scope),
      lockProperty(tx, scope),
      tx
        .insert(measurementRuns)
        .select(
          selectedValues(
            measurementRuns,
            {
              ...run,
              startedAt: now,
              requestCount: 1,
              finishedAt: null,
              error: null,
              claimToken: input.claimToken,
              completionToken: admissionId,
            },
            and(
              claimExists(tx, scope),
              exists(
                tx
                  .select({ id: growthExperiments.id })
                  .from(growthExperiments)
                  .where(
                    and(
                      experimentScope(run.projectId, run.experimentId),
                      isNotNull(growthExperiments.deployedAt),
                      currentProperty(tx, run.projectId),
                      run.includesBaseline
                        ? isNull(growthExperiments.baselineRunId)
                        : isNotNull(growthExperiments.baselineRunId),
                    ),
                  ),
              ),
              sql`(select count(*) from ${measurementRuns} budget where budget.project_id = ${run.projectId} and budget.started_at >= ${dayAgo}) < 5`,
              notExists(
                tx
                  .select({ id: measurementRuns.id })
                  .from(measurementRuns)
                  .where(
                    and(
                      runScope,
                      eq(measurementRuns.status, "completed"),
                      eq(measurementRuns.window, run.window),
                      gt(measurementRuns.finishedAt, dayAgo),
                    ),
                  ),
              ),
              sql`not exists (select 1 from ${measurementRuns} latest where latest.project_id = ${run.projectId} and latest.experiment_id = ${run.experimentId} and latest.status = 'failed' and latest.finished_at > ${fiveMinutesAgo} and latest.id = (select newest.id from ${measurementRuns} newest where newest.project_id = ${run.projectId} and newest.experiment_id = ${run.experimentId} order by newest.started_at desc, newest.id desc limit 1))`,
              notExists(
                tx
                  .select({ id: measurementRuns.id })
                  .from(measurementRuns)
                  .where(
                    and(
                      runScope,
                      eq(measurementRuns.status, "running"),
                      eq(measurementRuns.claimToken, input.claimToken),
                    ),
                  ),
              ),
            )!,
          ),
        )
        .onConflictDoNothing(),
      tx
        .update(measurementRuns)
        .set({
          status: "failed",
          finishedAt: now,
          error:
            "Measurement abandoned after its publishing lease was replaced.",
        })
        .where(
          and(
            runScope,
            ne(measurementRuns.id, run.id),
            eq(measurementRuns.status, "running"),
            ne(measurementRuns.claimToken, input.claimToken),
            accepted,
          ),
        ),
      // RFC-0009: services pass the event; it lands only with the run.
      ...(input.audit ? [auditInsert(tx, input.audit, accepted)] : []),
    ];
  });
  return runAccepted(run.projectId, run.experimentId, run.id, admissionId);
}

export async function failRun(
  input: ExperimentScope & { runId: string; message: string },
): Promise<boolean> {
  const completionToken = crypto.randomUUID();
  const message = input.message
    .replace(/(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]+/g, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .slice(0, 1000);
  await runBatch((tx) => [
    lockClaim(tx, input),
    lockProperty(tx, input),
    tx
      .update(measurementRuns)
      .set({
        status: "failed",
        finishedAt: new Date().toISOString(),
        error: message,
        completionToken,
      })
      .where(
        and(
          eq(measurementRuns.projectId, input.projectId),
          eq(measurementRuns.experimentId, input.experimentId),
          eq(measurementRuns.id, input.runId),
          eq(measurementRuns.status, "running"),
          eq(measurementRuns.claimToken, input.claimToken),
          claimExists(tx, input),
          exists(
            tx
              .select({ id: growthExperiments.id })
              .from(growthExperiments)
              .where(
                and(
                  experimentScope(input.projectId, input.experimentId),
                  isNotNull(growthExperiments.deployedAt),
                ),
              ),
          ),
        ),
      ),
  ]);
  return runAccepted(
    input.projectId,
    input.experimentId,
    input.runId,
    completionToken,
  );
}

export async function runAccepted(
  projectId: string,
  experimentId: string,
  runId: string,
  completionToken: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: measurementRuns.id })
    .from(measurementRuns)
    .where(
      and(
        eq(measurementRuns.projectId, projectId),
        eq(measurementRuns.experimentId, experimentId),
        eq(measurementRuns.id, runId),
        eq(measurementRuns.completionToken, completionToken),
      ),
    );
  return Boolean(row);
}
