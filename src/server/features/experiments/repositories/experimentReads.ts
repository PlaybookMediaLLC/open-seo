import { and, asc, count, desc, eq, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  ga4DateInTimeZone,
  shiftGa4Date,
} from "@/server/features/ga4/services/Ga4Dates";
import {
  growthExperiments,
  measurementRuns,
  measurementDays,
  opportunities,
  proposalExecutions,
} from "@/db/schema";
import type {
  ExperimentDetail,
  ExperimentListInput,
  ExperimentSummary,
  GrowthExperiment,
} from "@/types/schemas/experiments";
import type { ProposalWithHistory } from "@/types/schemas/publishing";
import { PublishingRepository } from "../../publishing/repositories/PublishingRepository";
import {
  experimentColumns,
  experimentScope,
  runColumns,
} from "./experimentSql";
import { listSignals } from "./deploymentSignals";

export async function list(
  input: ExperimentListInput,
): Promise<{ items: ExperimentSummary[]; total: number }> {
  const scope = eq(growthExperiments.projectId, input.projectId);
  const [items, totals] = await Promise.all([
    db
      .select({
        ...experimentColumns,
        opportunityTitle: opportunities.title,
        pullRequestUrl: proposalExecutions.pullRequestUrl,
        latestRun: runColumns,
      })
      .from(growthExperiments)
      .innerJoin(
        opportunities,
        and(
          eq(opportunities.id, growthExperiments.opportunityId),
          eq(opportunities.projectId, growthExperiments.projectId),
        ),
      )
      .innerJoin(
        proposalExecutions,
        and(
          eq(proposalExecutions.id, growthExperiments.executionId),
          eq(proposalExecutions.projectId, growthExperiments.projectId),
        ),
      )
      .leftJoin(
        measurementRuns,
        eq(
          measurementRuns.id,
          // Same rule as get(): the newest COMPLETED snapshot, so a later failed
          // attempt never replaces the last valid assessment.
          sql`(select latest.id from ${measurementRuns} latest where latest.project_id = ${input.projectId} and latest.experiment_id = ${growthExperiments.id} and latest.status = 'completed' order by latest.started_at desc, latest.id desc limit 1)`,
        ),
      )
      .where(scope)
      .orderBy(desc(growthExperiments.createdAt), desc(growthExperiments.id))
      .limit(input.limit)
      .offset(input.offset),
    db.select({ total: count() }).from(growthExperiments).where(scope),
  ]);
  return { items, total: totals[0]?.total ?? 0 };
}

export async function get(
  projectId: string,
  experimentId: string,
): Promise<ExperimentDetail | null> {
  const [experiment] = await db
    .select(experimentColumns)
    .from(growthExperiments)
    .where(experimentScope(projectId, experimentId));
  if (!experiment) return null;
  const runScope = and(
    eq(measurementRuns.projectId, projectId),
    eq(measurementRuns.experimentId, experimentId),
  );
  const [publishing, runs, completed, signals] = await Promise.all([
    PublishingRepository.getProposal(projectId, experiment.proposalId),
    db
      .select(runColumns)
      .from(measurementRuns)
      .where(runScope)
      .orderBy(desc(measurementRuns.startedAt), desc(measurementRuns.id))
      .limit(20),
    db
      .select(runColumns)
      .from(measurementRuns)
      .where(and(runScope, eq(measurementRuns.status, "completed")))
      .orderBy(desc(measurementRuns.startedAt), desc(measurementRuns.id))
      .limit(1),
    listSignals(projectId, experimentId),
  ]);
  if (!publishing) return null;
  const dayScope = and(
    eq(measurementDays.projectId, projectId),
    eq(measurementDays.experimentId, experimentId),
  );
  const [baselineDays, observationDays] = await Promise.all([
    experiment.baselineRunId
      ? db
          .select()
          .from(measurementDays)
          .where(
            and(
              dayScope,
              eq(measurementDays.runId, experiment.baselineRunId),
              eq(measurementDays.period, "baseline"),
            ),
          )
          .orderBy(asc(measurementDays.date))
          .limit(28)
      : [],
    completed[0]
      ? db
          .select()
          .from(measurementDays)
          .where(
            and(
              dayScope,
              eq(measurementDays.runId, completed[0].id),
              eq(measurementDays.period, "observation"),
            ),
          )
          .orderBy(asc(measurementDays.date))
          .limit(28)
      : [],
  ]);
  // latestRun is the newest completed snapshot so its flags always describe observationDays.
  return {
    experiment,
    publishing,
    signals,
    runs,
    baselineDays,
    observationDays,
    latestRun: completed[0] ?? null,
  };
}

export async function getForExecution(
  projectId: string,
  executionId: string,
): Promise<GrowthExperiment | null> {
  const [row] = await db
    .select(experimentColumns)
    .from(growthExperiments)
    .where(
      and(
        eq(growthExperiments.projectId, projectId),
        eq(growthExperiments.executionId, executionId),
      ),
    );
  return row ?? null;
}

export async function getExecutionHistory(
  projectId: string,
  executionId: string,
): Promise<ProposalWithHistory | null> {
  const [row] = await db
    .select({ proposalId: proposalExecutions.proposalId })
    .from(proposalExecutions)
    .where(
      and(
        eq(proposalExecutions.projectId, projectId),
        eq(proposalExecutions.id, executionId),
      ),
    );
  return row
    ? PublishingRepository.getProposal(projectId, row.proposalId)
    : null;
}

export async function hasOverlappingChanges(
  projectId: string,
  experimentId: string,
): Promise<boolean> {
  const [experiment] = await db
    .select(experimentColumns)
    .from(growthExperiments)
    .where(experimentScope(projectId, experimentId));
  if (!experiment?.baselineStart || !experiment.observationEnd) return false;
  // deployedAt is a UTC instant while windows are Pacific dates. Prefilter one
  // day wider in SQL, then compare the exact Pacific deployment date.
  const candidates = await db
    .select({ deployedAt: growthExperiments.deployedAt })
    .from(growthExperiments)
    .where(
      and(
        eq(growthExperiments.projectId, projectId),
        ne(growthExperiments.id, experimentId),
        eq(growthExperiments.targetUrl, experiment.targetUrl),
        isNotNull(growthExperiments.deployedAt),
        sql`substr(${growthExperiments.deployedAt}, 1, 10) >= ${shiftGa4Date(experiment.baselineStart, -1)}`,
        sql`substr(${growthExperiments.deployedAt}, 1, 10) <= ${shiftGa4Date(experiment.observationEnd, 1)}`,
      ),
    )
    .limit(20);
  return candidates.some(({ deployedAt }) => {
    const day = ga4DateInTimeZone(new Date(deployedAt!), "America/Los_Angeles");
    return (
      day >= experiment.baselineStart! && day <= experiment.observationEnd!
    );
  });
}
