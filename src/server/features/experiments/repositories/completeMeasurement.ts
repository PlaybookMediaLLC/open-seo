import { and, eq, exists, isNotNull, isNull, sql } from "drizzle-orm";
import { runBatch } from "@/db/runBatch";
import {
  growthExperiments,
  measurementRuns,
  measurementDays,
  opportunities,
} from "@/db/schema";
import type {
  MeasurementDay,
  MeasurementRun,
} from "@/types/schemas/experiments";
import {
  claimExists,
  lockClaim,
  selectedValues,
} from "../../publishing/repositories/publishingSql";
import {
  currentProperty,
  experimentScope,
  lockProperty,
} from "./experimentSql";
import { runAccepted } from "./measurementRuns";

export async function completeRun(input: {
  run: MeasurementRun;
  days: MeasurementDay[];
  claimToken: string;
  organizationId: string;
}): Promise<boolean> {
  const { run, days } = input;
  if (
    run.status !== "completed" ||
    days.length > 56 ||
    new Set(days.map((day) => `${day.period}:${day.date}`)).size !==
      days.length ||
    new Set(days.map((day) => day.id)).size !== days.length
  )
    return false;
  if (
    days.some(
      (day) =>
        day.projectId !== run.projectId ||
        day.experimentId !== run.experimentId ||
        day.runId !== run.id ||
        (!run.includesBaseline && day.period === "baseline"),
    )
  )
    return false;
  if (
    days.filter((day) => day.period === "baseline").length > 28 ||
    days.filter((day) => day.period === "observation").length > 28
  )
    return false;
  const scope = {
    ...input,
    projectId: run.projectId,
    experimentId: run.experimentId,
  };
  const completionToken = crypto.randomUUID();
  const now = new Date().toISOString();
  await runBatch((tx) => {
    const accepted = exists(
      tx
        .select({ id: measurementRuns.id })
        .from(measurementRuns)
        .where(
          and(
            eq(measurementRuns.projectId, run.projectId),
            eq(measurementRuns.experimentId, run.experimentId),
            eq(measurementRuns.id, run.id),
            eq(measurementRuns.completionToken, completionToken),
          ),
        ),
    );
    return [
      lockClaim(tx, scope),
      lockProperty(tx, scope),
      tx
        .update(measurementRuns)
        .set({
          status: "completed",
          finishedAt: now,
          observationThrough: run.observationThrough,
          outcome: run.outcome,
          explanation: run.explanation,
          overlappingChanges: run.overlappingChanges,
          windowComplete: run.windowComplete,
          error: null,
          completionToken,
        })
        .where(
          and(
            eq(measurementRuns.projectId, run.projectId),
            eq(measurementRuns.experimentId, run.experimentId),
            eq(measurementRuns.id, run.id),
            eq(measurementRuns.status, "running"),
            eq(measurementRuns.claimToken, input.claimToken),
            eq(measurementRuns.includesBaseline, run.includesBaseline),
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
          ),
        ),
      ...days.map((day) =>
        tx
          .insert(measurementDays)
          .select(selectedValues(measurementDays, day, accepted)),
      ),
      ...(run.includesBaseline
        ? [
            tx
              .update(growthExperiments)
              .set({ baselineRunId: run.id })
              .where(
                and(
                  experimentScope(run.projectId, run.experimentId),
                  isNull(growthExperiments.baselineRunId),
                  accepted,
                ),
              ),
          ]
        : []),
      tx
        .update(opportunities)
        .set({
          status: run.windowComplete ? "completed" : "measuring",
          version: sql`${opportunities.version} + 1`,
        })
        .where(
          and(
            eq(opportunities.projectId, run.projectId),
            accepted,
            exists(
              tx
                .select({ id: growthExperiments.id })
                .from(growthExperiments)
                .where(
                  and(
                    experimentScope(run.projectId, run.experimentId),
                    eq(growthExperiments.opportunityId, opportunities.id),
                  ),
                ),
            ),
          ),
        ),
    ];
  });
  return runAccepted(run.projectId, run.experimentId, run.id, completionToken);
}
