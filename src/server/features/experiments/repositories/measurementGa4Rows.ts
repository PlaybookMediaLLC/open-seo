import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import {
  experimentKeyEvents,
  growthExperiments,
  measurementGa4Days,
  measurementGa4EventTotals,
  projectConversionEvents,
} from "@/db/schema";
import { experimentScope } from "./experimentSql";

// RFC-0006: the experiment's GA4 settings and the GA4 rows of one run.

async function keyEvents(projectId: string, experimentId: string) {
  const rows = await db
    .select({ eventName: experimentKeyEvents.eventName })
    .from(experimentKeyEvents)
    .where(
      and(
        eq(experimentKeyEvents.projectId, projectId),
        eq(experimentKeyEvents.experimentId, experimentId),
      ),
    )
    .orderBy(asc(experimentKeyEvents.eventName));
  return rows.map((row) => row.eventName);
}

/** RFC-0012 5.6: the project's chosen conversion, measured on every experiment. */
async function conversionEvent(projectId: string) {
  const [row] = await db
    .select({ eventName: projectConversionEvents.eventName })
    .from(projectConversionEvents)
    .where(eq(projectConversionEvents.projectId, projectId));
  return row?.eventName ?? null;
}

/** Replaces the chosen key events and the refresh setting together. */
async function saveSettings(input: {
  projectId: string;
  experimentId: string;
  autoRefresh: boolean;
  keyEvents: string[];
}) {
  const scope = and(
    eq(experimentKeyEvents.projectId, input.projectId),
    eq(experimentKeyEvents.experimentId, input.experimentId),
  );
  await runBatch((tx) => [
    tx
      .update(growthExperiments)
      .set({ autoRefresh: input.autoRefresh })
      .where(experimentScope(input.projectId, input.experimentId)),
    tx.delete(experimentKeyEvents).where(scope),
    ...input.keyEvents.map((eventName) =>
      tx.insert(experimentKeyEvents).values({
        id: crypto.randomUUID(),
        projectId: input.projectId,
        experimentId: input.experimentId,
        eventName,
      }),
    ),
  ]);
}

async function forRun(projectId: string, runId: string) {
  const [days, eventTotals] = await Promise.all([
    db
      .select()
      .from(measurementGa4Days)
      .where(
        and(
          eq(measurementGa4Days.projectId, projectId),
          eq(measurementGa4Days.runId, runId),
        ),
      )
      .orderBy(asc(measurementGa4Days.date)),
    db
      .select()
      .from(measurementGa4EventTotals)
      .where(
        and(
          eq(measurementGa4EventTotals.projectId, projectId),
          eq(measurementGa4EventTotals.runId, runId),
        ),
      )
      .orderBy(asc(measurementGa4EventTotals.eventName)),
  ]);
  return { days, eventTotals };
}

export const MeasurementGa4Repository = {
  keyEvents,
  conversionEvent,
  saveSettings,
  forRun,
};
