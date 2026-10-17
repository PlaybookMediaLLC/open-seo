import { and, asc, eq, lt, lte } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import {
  growthJobLogs,
  growthJobRuns,
  growthNotifications,
  growthSchedules,
} from "@/db/schema";

// RFC-0008 5.5 and 5.6: schedules, runs, logs and notifications. Every write
// that could race is conditional or unique-keyed.
type RunRow = typeof growthJobRuns.$inferInsert;
type NotificationRow = typeof growthNotifications.$inferInsert;
export type LogLine = {
  at: string;
  level: "info" | "warn" | "error";
  message: string;
};

/** Enabled schedules whose time has come, oldest first. Changes nothing. */
async function dueSchedules(now: string, limit: number) {
  return db
    .select()
    .from(growthSchedules)
    .where(
      and(
        eq(growthSchedules.enabled, true),
        lte(growthSchedules.nextRunAt, now),
      ),
    )
    .orderBy(asc(growthSchedules.nextRunAt))
    .limit(limit);
}

/** Event work that could not reach Trigger.dev and waits for a dispatch. */
async function queuedRuns(limit: number) {
  if (limit <= 0) return [];
  return db
    .select()
    .from(growthJobRuns)
    .where(eq(growthJobRuns.status, "queued"))
    .orderBy(asc(growthJobRuns.createdAt))
    .limit(limit);
}

async function getSchedule(projectId: string, id: string) {
  const [row] = await db
    .select()
    .from(growthSchedules)
    .where(
      and(eq(growthSchedules.projectId, projectId), eq(growthSchedules.id, id)),
    );
  return row ?? null;
}

async function succeededRun(
  projectId: string,
  kind: RunRow["kind"],
  windowKey: string,
) {
  const [row] = await db
    .select({ id: growthJobRuns.id })
    .from(growthJobRuns)
    .where(
      and(
        eq(growthJobRuns.projectId, projectId),
        eq(growthJobRuns.kind, kind),
        eq(growthJobRuns.windowKey, windowKey),
        eq(growthJobRuns.status, "succeeded"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** False when this attempt of this window already has a row. */
async function startRun(row: RunRow) {
  const inserted = await db
    .insert(growthJobRuns)
    .values(row)
    .onConflictDoNothing()
    .returning({ id: growthJobRuns.id });
  return inserted.length > 0;
}

/** Ends a run, keeps up to 50 log lines and clears queued work for it. */
async function finishRun(input: {
  projectId: string;
  runId: string;
  kind: RunRow["kind"];
  windowKey: string;
  status: "succeeded" | "failed" | "skipped";
  summary?: string;
  skipReason?: string;
  error?: string;
  logs: LogLine[];
}) {
  const finishedAt = new Date().toISOString();
  await runBatch((tx) => [
    tx
      .update(growthJobRuns)
      .set({
        status: input.status,
        finishedAt,
        summary: input.summary?.slice(0, 500) ?? null,
        skipReason: input.skipReason?.slice(0, 500) ?? null,
        error: input.error?.slice(0, 500) ?? null,
      })
      .where(
        and(
          eq(growthJobRuns.projectId, input.projectId),
          eq(growthJobRuns.id, input.runId),
        ),
      ),
    ...input.logs.slice(0, 50).map((line) =>
      tx.insert(growthJobLogs).values({
        id: crypto.randomUUID(),
        projectId: input.projectId,
        runId: input.runId,
        at: line.at,
        level: line.level,
        message: line.message.slice(0, 500),
      }),
    ),
    ...(input.status === "failed"
      ? []
      : [
          tx
            .delete(growthJobRuns)
            .where(
              and(
                eq(growthJobRuns.projectId, input.projectId),
                eq(growthJobRuns.kind, input.kind),
                eq(growthJobRuns.windowKey, input.windowKey),
                eq(growthJobRuns.status, "queued"),
              ),
            ),
        ]),
  ]);
}

/** Moves a schedule on only if nobody else moved it first. */
async function advanceSchedule(id: string, observed: string, next: string) {
  await db
    .update(growthSchedules)
    .set({ nextRunAt: next })
    .where(
      and(eq(growthSchedules.id, id), eq(growthSchedules.nextRunAt, observed)),
    );
}

/** One notification per project, kind and dedupe key. */
async function notify(row: Omit<NotificationRow, "id" | "createdAt">) {
  await db
    .insert(growthNotifications)
    .values({
      ...row,
      title: row.title.slice(0, 200),
      body: row.body.slice(0, 1000),
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing();
}

/** RFC-0008 5.3: runs (with their logs) and notifications older than cutoff. */
async function deleteBefore(cutoff: string) {
  const runs = await db
    .delete(growthJobRuns)
    .where(lt(growthJobRuns.createdAt, cutoff))
    .returning({ id: growthJobRuns.id });
  const notifications = await db
    .delete(growthNotifications)
    .where(lt(growthNotifications.createdAt, cutoff))
    .returning({ id: growthNotifications.id });
  return { runs: runs.length, notifications: notifications.length };
}

export const GrowthJobRepository = {
  dueSchedules,
  queuedRuns,
  getSchedule,
  succeededRun,
  startRun,
  finishRun,
  advanceSchedule,
  notify,
  deleteBefore,
};
