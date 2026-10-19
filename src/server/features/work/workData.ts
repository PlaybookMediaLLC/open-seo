import { and, desc, eq, gte, inArray, isNull, lt, or } from "drizzle-orm";
import { chunk } from "remeda";
import { db } from "@/db";
import {
  growthExperiments,
  measurementRuns,
  opportunities,
  opportunityProposals,
  opportunityRuns,
  proposalApprovals,
  proposalExecutions,
  splitTests,
  workCycleEntries,
  workCycles,
  workSettings,
} from "@/db/schema";
import { runBatch } from "@/db/runBatch";
import { Ga4ConnectionRepository } from "@/server/features/ga4/repositories/Ga4ConnectionRepository";
import {
  ga4DateInTimeZone,
  shiftGa4Date,
} from "@/server/features/ga4/services/Ga4Dates";
import { PublishingRepository } from "@/server/features/publishing/repositories/PublishingRepository";
import { buildCycle, type CycleEntry, type CycleInput } from "./workCycle";

// RFC-0018 5.2 and 5.8: the week in the project's time zone, the records the
// cycle reads, and the snapshot it writes once per week.
const DAY_MS = 86_400_000;
const HISTORY_DAYS = 365;
// D1 allows about 100 bound parameters a statement; an entry row has 14.
const ENTRY_ROWS = 7;
export const WORK_DEFAULTS = {
  qualityBar: 40,
  openPrLimit: 3,
  cycleDay: 1,
  cycleHour: 6,
};

export async function workSettingsFor(projectId: string) {
  const [[row], ga4] = await Promise.all([
    db.select().from(workSettings).where(eq(workSettings.projectId, projectId)),
    Ga4ConnectionRepository.getByProjectId(projectId),
  ]);
  return (
    row ?? {
      ...WORK_DEFAULTS,
      timeZone: ga4?.propertyTimeZone ?? "UTC",
    }
  );
}

/** The UTC instant of local midnight on `date` in `timeZone`. */
function zonedMidnight(date: string, timeZone: string) {
  const guess = Date.parse(`${date}T00:00:00Z`);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date(guess))
      .map((part) => [part.type, part.value]),
  );
  const shown = Date.parse(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`,
  );
  return new Date(guess - (shown - guess)).toISOString();
}

/** The current week, starting at local midnight on the cycle day. */
export function weekOf(
  now: Date,
  settings: { cycleDay: number; cycleHour: number; timeZone: string },
) {
  const local = ga4DateInTimeZone(now, settings.timeZone);
  const weekday = new Date(`${local}T00:00:00Z`).getUTCDay() || 7;
  const startDate = shiftGa4Date(
    local,
    -((weekday - settings.cycleDay + 7) % 7),
  );
  const nextStart = shiftGa4Date(startDate, 7);
  const runAt = (date: string) =>
    new Date(
      Date.parse(zonedMidnight(date, settings.timeZone)) +
        settings.cycleHour * 3_600_000,
    ).toISOString();
  const thisRun = runAt(startDate);
  return {
    startDate,
    weekStart: zonedMidnight(startDate, settings.timeZone),
    weekEnd: zonedMidnight(nextStart, settings.timeZone),
    /** The next time the cycle runs. */
    nextRunAt: thisRun > now.toISOString() ? thisRun : runAt(nextStart),
  };
}

/** Every record the cycle reads, for one project and week. */
export async function loadCycleInput(
  projectId: string,
  week: { weekStart: string; weekEnd: string },
  now: Date,
  settings: { qualityBar: number; openPrLimit: number },
): Promise<CycleInput> {
  const since = new Date(now.getTime() - HISTORY_DAYS * DAY_MS).toISOString();
  const [open, experiments, tests, connection, [latestRun]] = await Promise.all(
    [
      db
        .select({
          id: opportunities.id,
          type: opportunities.type,
          url: opportunities.url,
          title: opportunities.title,
          explanation: opportunities.explanation,
          status: opportunities.status,
          confidence: opportunities.confidence,
          priority: opportunities.priority,
          effortHours: opportunities.effortHours,
          lastDetectedAt: opportunities.lastDetectedAt,
        })
        .from(opportunities)
        .where(
          and(
            eq(opportunities.projectId, projectId),
            inArray(opportunities.status, [
              "discovered",
              "reviewed",
              "approved",
            ]),
          ),
        ),
      db
        .select({
          id: growthExperiments.id,
          opportunityType: opportunities.type,
          title: opportunities.title,
          targetUrl: growthExperiments.targetUrl,
          createdAt: growthExperiments.createdAt,
          pullRequestState: growthExperiments.pullRequestState,
          mergedAt: growthExperiments.mergedAt,
          deployedAt: growthExperiments.deployedAt,
          deploymentBasis: growthExperiments.deploymentBasis,
          observationEnd: growthExperiments.observationEnd,
        })
        .from(growthExperiments)
        .innerJoin(
          opportunities,
          eq(opportunities.id, growthExperiments.opportunityId),
        )
        .where(
          and(
            eq(growthExperiments.projectId, projectId),
            or(
              gte(growthExperiments.createdAt, since),
              eq(growthExperiments.pullRequestState, "open"),
            ),
          ),
        ),
      db
        .select({
          id: splitTests.id,
          name: splitTests.name,
          status: splitTests.status,
          deployedAt: splitTests.deployedAt,
          deploymentBasis: splitTests.deploymentBasis,
          observationEnd: splitTests.observationEnd,
        })
        .from(splitTests)
        .where(eq(splitTests.projectId, projectId)),
      PublishingRepository.getConnection(projectId),
      db
        .select({ startedAt: opportunityRuns.startedAt })
        .from(opportunityRuns)
        .where(
          and(
            eq(opportunityRuns.projectId, projectId),
            eq(opportunityRuns.kind, "search_console"),
            eq(opportunityRuns.status, "completed"),
          ),
        )
        .orderBy(desc(opportunityRuns.startedAt))
        .limit(1),
    ],
  );
  const ids = experiments.map((item) => item.id);
  const runs = ids.length
    ? (
        await Promise.all(
          chunk(ids, 90).map((part) =>
            db
              .select({
                experimentId: measurementRuns.experimentId,
                outcome: measurementRuns.outcome,
                windowComplete: measurementRuns.windowComplete,
                startedAt: measurementRuns.startedAt,
              })
              .from(measurementRuns)
              .where(
                and(
                  eq(measurementRuns.projectId, projectId),
                  inArray(measurementRuns.experimentId, part),
                  eq(measurementRuns.status, "completed"),
                  eq(measurementRuns.window, "primary"),
                ),
              ),
          ),
        )
      ).flat()
    : [];
  const latest = (id: string) =>
    runs
      .filter((run) => run.experimentId === id)
      .reduce<
        (typeof runs)[number] | null
      >((best, run) => (!best || run.startedAt > best.startedAt ? run : best), null);
  const approvedIds = open
    .filter((item) => item.status === "approved")
    .map((item) => item.id);
  const proposals = approvedIds.length
    ? (
        await Promise.all(
          chunk(approvedIds, 90).map((part) =>
            db
              .select({
                id: opportunityProposals.id,
                opportunityId: opportunityProposals.opportunityId,
                createdAt: opportunityProposals.createdAt,
                approvalId: proposalApprovals.id,
                executionId: proposalExecutions.id,
              })
              .from(opportunityProposals)
              .leftJoin(
                proposalApprovals,
                eq(proposalApprovals.proposalId, opportunityProposals.id),
              )
              .leftJoin(
                proposalExecutions,
                eq(proposalExecutions.proposalId, opportunityProposals.id),
              )
              .where(
                and(
                  eq(opportunityProposals.projectId, projectId),
                  inArray(opportunityProposals.opportunityId, part),
                  isNull(opportunityProposals.revertsProposalId),
                ),
              ),
          ),
        )
      ).flat()
    : [];
  const newest = new Map<string, (typeof proposals)[number]>();
  for (const row of proposals) {
    const current = newest.get(row.opportunityId);
    if (!current || row.createdAt > current.createdAt)
      newest.set(row.opportunityId, row);
  }
  return {
    ...week,
    now,
    bar: settings.qualityBar,
    openPrLimit: settings.openPrLimit,
    githubConnected: Boolean(connection),
    latestDetectionAt: latestRun?.startedAt ?? null,
    opportunities: open,
    experiments: experiments.map((item) => ({
      ...item,
      windowComplete: latest(item.id)?.windowComplete ?? false,
      outcome: latest(item.id)?.windowComplete
        ? (latest(item.id)?.outcome ?? null)
        : null,
    })),
    splitTests: tests,
    proposals: [...newest.values()]
      .filter((row) => !row.executionId)
      .map((row) => ({
        id: row.id,
        opportunityId: row.opportunityId,
        title: open.find((item) => item.id === row.opportunityId)?.title ?? "",
        createdAt: row.createdAt,
        approved: Boolean(row.approvalId),
      })),
  };
}

const entryRows = (projectId: string, cycleId: string, entries: CycleEntry[]) =>
  entries.map(({ link, ...entry }) => ({
    id: crypto.randomUUID(),
    projectId,
    cycleId,
    ...entry,
    opportunityId: "opportunityId" in link ? link.opportunityId : null,
    proposalId: "proposalId" in link ? link.proposalId : null,
    experimentId: "experimentId" in link ? link.experimentId : null,
    splitTestId: "splitTestId" in link ? link.splitTestId : null,
  }));
const counts = (entries: CycleEntry[]) => ({
  completedCount: entries.filter((item) => item.section === "completed").length,
  measuringCount: entries.filter((item) => item.section === "measuring").length,
  nextCount: entries.filter((item) => item.section === "next").length,
  waitingCount: entries.filter((item) => item.section === "waiting").length,
});

/**
 * Closes the earlier open cycles with their Completed lists recomputed, then
 * writes this week's cycle once. A second run for the same week writes
 * nothing and returns null.
 */
export async function writeCycle(
  projectId: string,
  week: ReturnType<typeof weekOf>,
  now: Date,
  settings: { qualityBar: number; openPrLimit: number; timeZone: string },
) {
  const [existing] = await db
    .select({ id: workCycles.id })
    .from(workCycles)
    .where(
      and(
        eq(workCycles.projectId, projectId),
        eq(workCycles.weekStart, week.startDate),
      ),
    );
  if (existing) return null;
  const earlier = await db
    .select({ id: workCycles.id, weekStart: workCycles.weekStart })
    .from(workCycles)
    .where(
      and(
        eq(workCycles.projectId, projectId),
        eq(workCycles.status, "open"),
        lt(workCycles.weekStart, week.startDate),
      ),
    );
  for (const cycle of earlier) {
    const window = {
      weekStart: zonedMidnight(cycle.weekStart, settings.timeZone),
      weekEnd: zonedMidnight(
        shiftGa4Date(cycle.weekStart, 7),
        settings.timeZone,
      ),
    };
    const completed = buildCycle(
      await loadCycleInput(projectId, window, now, settings),
    ).entries.filter((entry) => entry.section === "completed");
    await runBatch((tx) => [
      tx
        .delete(workCycleEntries)
        .where(
          and(
            eq(workCycleEntries.cycleId, cycle.id),
            eq(workCycleEntries.section, "completed"),
          ),
        ),
      ...chunk(entryRows(projectId, cycle.id, completed), ENTRY_ROWS).map(
        (rows) => tx.insert(workCycleEntries).values(rows),
      ),
      tx
        .update(workCycles)
        .set({
          status: "closed",
          closedAt: now.toISOString(),
          completedCount: completed.length,
        })
        .where(eq(workCycles.id, cycle.id)),
    ]);
  }
  const built = buildCycle(
    await loadCycleInput(projectId, week, now, settings),
  );
  const id = crypto.randomUUID();
  try {
    await runBatch((tx) => [
      tx.insert(workCycles).values({
        id,
        projectId,
        weekStart: week.startDate,
        status: "open",
        generatedAt: now.toISOString(),
        ...counts(built.entries),
        emptyReasons: built.emptyReasons || null,
      }),
      ...chunk(entryRows(projectId, id, built.entries), ENTRY_ROWS).map(
        (rows) => tx.insert(workCycleEntries).values(rows),
      ),
    ]);
  } catch (error) {
    // A concurrent run wrote the same week first; the unique index kept one.
    const [winner] = await db
      .select({ id: workCycles.id })
      .from(workCycles)
      .where(
        and(
          eq(workCycles.projectId, projectId),
          eq(workCycles.weekStart, week.startDate),
        ),
      );
    if (winner) return null;
    throw error;
  }
  return { id, ...built };
}
