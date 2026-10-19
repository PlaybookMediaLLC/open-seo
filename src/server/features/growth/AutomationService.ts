import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import { GROWTH_JOB_KINDS } from "@/db/growth-jobs.schema";
import { growthJobLogs, growthJobRuns, growthSchedules } from "@/db/schema";
import { hasOrgPermission } from "@/lib/org-permissions";
import { requireOrgPermission } from "@/server/auth/org-gate";
import { auditInsert } from "@/server/features/activity/auditLog";
import {
  authorize,
  type OpportunityContext,
} from "@/server/features/opportunities/services/opportunityAccess";
import type { SaveScheduleInput } from "@/types/schemas/growthJobs";
import { growthJobsMode } from "./internalAuth";

// RFC-0008 5.5, 5.7 and 5.10: the project's growth schedules, run history
// and logs. Editing a schedule makes the editor its owner.
type Kind = (typeof GROWTH_JOB_KINDS)[number];
const DEFAULTS: Record<
  Kind,
  { interval: "daily" | "weekly"; hourUtc: number }
> = {
  opportunity_refresh: { interval: "weekly", hourUtc: 6 },
  traffic_watch: { interval: "daily", hourUtc: 7 },
  recommendation_recheck: { interval: "weekly", hourUtc: 8 },
  measurement_refresh: { interval: "daily", hourUtc: 9 },
  deployment_check: { interval: "daily", hourUtc: 10 },
  cwv_refresh: { interval: "weekly", hourUtc: 5 },
};
export const SEARCH_CONSOLE_JOBS: Kind[] = [
  "opportunity_refresh",
  "traffic_watch",
  "recommendation_recheck",
];
export const TRACKING_JOBS: Kind[] = [
  "measurement_refresh",
  "deployment_check",
];
const RUN_LIMIT = 20;

/** The next time the clock shows `hourUtc`, after now. */
function firstSlot(hourUtc: number, now = new Date()) {
  const slot = new Date(now);
  slot.setUTCHours(hourUtc, 0, 0, 0);
  if (slot <= now) slot.setUTCDate(slot.getUTCDate() + 1);
  return slot.toISOString();
}

/**
 * Turns the default jobs on once, when Search Console connects or tracking
 * starts. An existing schedule, even a turned-off one, is left alone.
 */
export async function ensureDefaultSchedules(
  projectId: string,
  ownerUserId: string,
  kinds: Kind[],
) {
  const now = new Date().toISOString();
  for (const kind of kinds)
    await db
      .insert(growthSchedules)
      .values({
        id: crypto.randomUUID(),
        projectId,
        kind,
        enabled: true,
        ...DEFAULTS[kind],
        nextRunAt: firstSlot(DEFAULTS[kind].hourUtc),
        ownerUserId,
        updatedBy: ownerUserId,
        updatedAt: now,
      })
      .onConflictDoNothing();
}

/** Never lets a schedule problem fail the Search Console connection. */
export async function startSearchConsoleJobs<
  T extends { projectId: string; connectedByUserId: string },
>(connection: T): Promise<T> {
  await ensureDefaultSchedules(
    connection.projectId,
    connection.connectedByUserId,
    SEARCH_CONSOLE_JOBS,
  ).catch(() => undefined);
  return connection;
}

async function get(context: OpportunityContext, projectId: string) {
  await authorize(context, projectId);
  const [schedules, runs] = await Promise.all([
    db
      .select()
      .from(growthSchedules)
      .where(eq(growthSchedules.projectId, projectId)),
    db
      .select()
      .from(growthJobRuns)
      .where(eq(growthJobRuns.projectId, projectId))
      .orderBy(desc(growthJobRuns.createdAt), desc(growthJobRuns.id))
      .limit(RUN_LIMIT),
  ]);
  return {
    available: (await growthJobsMode()) !== "off",
    canManage: hasOrgPermission(context.role, { integration: ["manage"] }),
    schedules: GROWTH_JOB_KINDS.map((kind) => {
      const schedule = schedules.find((row) => row.kind === kind);
      return {
        kind,
        enabled: schedule?.enabled ?? false,
        interval: schedule?.interval ?? DEFAULTS[kind].interval,
        hourUtc: schedule?.hourUtc ?? DEFAULTS[kind].hourUtc,
        nextRunAt: schedule?.enabled ? schedule.nextRunAt : null,
        ownedByViewer: schedule?.ownerUserId === context.userId,
      };
    }),
    runs: runs.map(({ triggerRunId: _id, ...run }) => run),
  };
}

async function save(context: OpportunityContext, input: SaveScheduleInput) {
  await authorize(context, input.projectId);
  requireOrgPermission(context, { integration: ["manage"] });
  const now = new Date().toISOString();
  const values = {
    enabled: input.enabled,
    interval: input.interval,
    hourUtc: input.hourUtc,
    nextRunAt: firstSlot(input.hourUtc),
    ownerUserId: context.userId,
    updatedBy: context.userId,
    updatedAt: now,
  };
  await runBatch((tx) => [
    tx
      .insert(growthSchedules)
      .values({
        id: crypto.randomUUID(),
        projectId: input.projectId,
        kind: input.kind,
        ...values,
      })
      .onConflictDoUpdate({
        target: [growthSchedules.projectId, growthSchedules.kind],
        set: values,
      }),
    auditInsert(tx, {
      organizationId: context.organizationId,
      projectId: input.projectId,
      actor: context,
      action: "schedule.changed",
      targetType: "schedule",
      targetId: input.kind,
      summary: `${input.enabled ? "Turned on" : "Turned off"} ${input.kind.replaceAll("_", " ")}, ${input.interval} at ${input.hourUtc}:00 UTC`,
    }),
  ]);
}

async function runLogs(
  context: OpportunityContext,
  input: { projectId: string; runId: string },
) {
  await authorize(context, input.projectId);
  return db
    .select({
      at: growthJobLogs.at,
      level: growthJobLogs.level,
      message: growthJobLogs.message,
    })
    .from(growthJobLogs)
    .where(
      and(
        eq(growthJobLogs.projectId, input.projectId),
        eq(growthJobLogs.runId, input.runId),
      ),
    )
    .orderBy(asc(growthJobLogs.at));
}

export const AutomationService = { get, save, runLogs };
