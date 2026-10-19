import { and, desc, eq, inArray } from "drizzle-orm";
import { sortBy } from "remeda";
import { db } from "@/db";
import {
  growthSchedules,
  workCycleEntries,
  workCycles,
  workSettings,
} from "@/db/schema";
import { runBatch } from "@/db/runBatch";
import { hasOrgPermission } from "@/lib/org-permissions";
import {
  authorizePublishing,
  type PublishingContext,
} from "@/server/features/publishing/publishingAccess";
import { AppError } from "@/server/lib/errors";
import type { WorkSettingsInput } from "@/types/schemas/work";
import type { CycleEntry } from "./workCycle";
import { buildCycle } from "./workCycle";
import { loadCycleInput, weekOf, workSettingsFor } from "./workData";

// RFC-0018 5.9: "This week" (live), its history (the weekly snapshots) and
// the cycle settings.
const HISTORY_WEEKS = 12;

/** The page that holds an entry's record. */
function targetOf(
  { link }: Pick<CycleEntry, "link">,
  proposalOpportunity: Map<string, string>,
) {
  if ("opportunityId" in link)
    return { kind: "opportunity" as const, id: link.opportunityId };
  if ("proposalId" in link)
    return {
      kind: "opportunity" as const,
      id: proposalOpportunity.get(link.proposalId) ?? "",
    };
  if ("experimentId" in link)
    return { kind: "experiment" as const, id: link.experimentId };
  return { kind: "experiments" as const, id: link.splitTestId };
}

async function thisWeek(context: PublishingContext, projectId: string) {
  await authorizePublishing(context, projectId);
  const settings = await workSettingsFor(projectId);
  const now = new Date();
  const week = weekOf(now, settings);
  const [input, [snapshot], [schedule]] = await Promise.all([
    loadCycleInput(projectId, week, now, settings),
    db
      .select({ generatedAt: workCycles.generatedAt })
      .from(workCycles)
      .where(
        and(
          eq(workCycles.projectId, projectId),
          eq(workCycles.weekStart, week.startDate),
        ),
      ),
    db
      .select({ enabled: growthSchedules.enabled })
      .from(growthSchedules)
      .where(
        and(
          eq(growthSchedules.projectId, projectId),
          eq(growthSchedules.kind, "weekly_cycle"),
        ),
      ),
  ]);
  const built = buildCycle(input);
  const proposals = new Map(
    input.proposals.map((item) => [item.id, item.opportunityId]),
  );
  return {
    weekStart: week.startDate,
    snapshotAt: snapshot?.generatedAt ?? null,
    scheduled: schedule?.enabled ?? false,
    emptyReasons: built.emptyReasons,
    entries: built.entries.map(({ link, ...entry }) => ({
      ...entry,
      target: targetOf({ link }, proposals),
    })),
    settings,
    canManage: hasOrgPermission(context.role, { integration: ["manage"] }),
  };
}

async function history(context: PublishingContext, projectId: string) {
  await authorizePublishing(context, projectId);
  const cycles = await db
    .select()
    .from(workCycles)
    .where(eq(workCycles.projectId, projectId))
    .orderBy(desc(workCycles.weekStart))
    .limit(HISTORY_WEEKS);
  const entries = cycles.length
    ? await db
        .select()
        .from(workCycleEntries)
        .where(
          and(
            eq(workCycleEntries.projectId, projectId),
            inArray(
              workCycleEntries.cycleId,
              cycles.map((cycle) => cycle.id),
            ),
          ),
        )
    : [];
  return cycles.map((cycle) => ({
    ...cycle,
    entries: sortBy(
      entries.filter((entry) => entry.cycleId === cycle.id),
      (entry) => entry.section,
      (entry) => entry.rank,
    ),
  }));
}

async function saveSettings(
  context: PublishingContext,
  input: WorkSettingsInput,
) {
  await authorizePublishing(context, input.projectId, true);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: input.timeZone }).format();
  } catch {
    throw new AppError(
      "VALIDATION_ERROR",
      "Enter a valid time zone, such as Europe/Berlin.",
    );
  }
  const { projectId, ...values } = input;
  const now = new Date().toISOString();
  const week = weekOf(new Date(), values);
  const schedule = {
    enabled: true,
    interval: "weekly" as const,
    hourUtc: new Date(week.nextRunAt).getUTCHours(),
    nextRunAt: week.nextRunAt,
    ownerUserId: context.userId,
    updatedBy: context.userId,
    updatedAt: now,
  };
  await runBatch((tx) => [
    tx
      .insert(workSettings)
      .values({
        projectId,
        ...values,
        updatedBy: context.userId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: workSettings.projectId,
        set: { ...values, updatedBy: context.userId, updatedAt: now },
      }),
    // The weekly cycle runs on the chosen day and hour in the time zone.
    tx
      .insert(growthSchedules)
      .values({
        id: crypto.randomUUID(),
        projectId,
        kind: "weekly_cycle",
        ...schedule,
      })
      .onConflictDoUpdate({
        target: [growthSchedules.projectId, growthSchedules.kind],
        set: schedule,
      }),
  ]);
  return { nextRunAt: week.nextRunAt };
}

export const WorkService = { thisWeek, history, saveSettings };
