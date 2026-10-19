import { and, eq, gte, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  growthExperiments,
  measurementRuns,
  opportunities,
  opportunityProposals,
  proposalApprovals,
  proposalExecutions,
} from "@/db/schema";
import { AuthRepository } from "@/server/auth/repositories/AuthRepository";
import { ExperimentRepository } from "@/server/features/experiments/repositories/ExperimentRepository";
import {
  authorizePublishing,
  type PublishingContext,
} from "@/server/features/publishing/publishingAccess";
import { experimentRevenue } from "@/server/features/revenue/RevenueReportService";
import { workReport } from "./workReport";

// RFC-0018 5.7: the monthly work report. Regressions join with RFC-0019.
async function monthly(
  context: PublishingContext,
  input: { projectId: string; month: string },
) {
  await authorizePublishing(context, input.projectId);
  const { projectId } = input;
  const start = `${input.month}-01T00:00:00.000Z`;
  const next = new Date(start);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const end = next.toISOString();
  const [changes, runs, approvals, pending] = await Promise.all([
    db
      .select({
        experimentId: growthExperiments.id,
        proposalId: growthExperiments.proposalId,
        title: opportunities.title,
        targetUrl: growthExperiments.targetUrl,
        deployedAt: growthExperiments.deployedAt,
        deploymentBasis: growthExperiments.deploymentBasis,
        effortHours: opportunities.effortHours,
      })
      .from(growthExperiments)
      .innerJoin(
        opportunities,
        eq(opportunities.id, growthExperiments.opportunityId),
      )
      .where(
        and(
          eq(growthExperiments.projectId, projectId),
          gte(growthExperiments.deployedAt, start),
          lt(growthExperiments.deployedAt, end),
        ),
      ),
    db
      .select({
        experimentId: measurementRuns.experimentId,
        outcome: measurementRuns.outcome,
        explanation: measurementRuns.explanation,
        title: opportunities.title,
      })
      .from(measurementRuns)
      .innerJoin(
        growthExperiments,
        eq(growthExperiments.id, measurementRuns.experimentId),
      )
      .innerJoin(
        opportunities,
        eq(opportunities.id, growthExperiments.opportunityId),
      )
      .where(
        and(
          eq(measurementRuns.projectId, projectId),
          eq(measurementRuns.status, "completed"),
          eq(measurementRuns.window, "primary"),
          eq(measurementRuns.windowComplete, true),
          gte(measurementRuns.finishedAt, start),
          lt(measurementRuns.finishedAt, end),
        ),
      ),
    db
      .select({
        proposalId: proposalApprovals.proposalId,
        actorUserId: proposalApprovals.actorUserId,
        approvedAt: proposalApprovals.createdAt,
        preparedAt: opportunityProposals.createdAt,
      })
      .from(proposalApprovals)
      .innerJoin(
        opportunityProposals,
        eq(opportunityProposals.id, proposalApprovals.proposalId),
      )
      .where(
        and(
          eq(proposalApprovals.projectId, projectId),
          gte(proposalApprovals.createdAt, start),
          lt(proposalApprovals.createdAt, end),
        ),
      ),
    db
      .select({ id: opportunityProposals.id })
      .from(opportunityProposals)
      .innerJoin(
        opportunities,
        eq(opportunities.id, opportunityProposals.opportunityId),
      )
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
          eq(opportunities.status, "approved"),
          isNull(proposalApprovals.id),
          isNull(proposalExecutions.id),
          isNull(opportunityProposals.revertsProposalId),
        ),
      ),
  ]);
  const approverIds = [
    ...new Set(
      approvals
        .filter((row) =>
          changes.some((change) => change.proposalId === row.proposalId),
        )
        .map((row) => row.actorUserId),
    ),
  ];
  const names = new Map(
    (await AuthRepository.getHostedUserNames(approverIds)).map((row) => [
      row.id,
      row.name,
    ]),
  );
  // One result per experiment: the newest complete primary run of the month.
  const results = [
    ...new Map(runs.map((run) => [run.experimentId, run])).values(),
  ];
  const details = await Promise.all(
    results.map(async (run) => {
      const detail = await ExperimentRepository.get(
        projectId,
        run.experimentId,
      );
      const revenue = detail
        ? await experimentRevenue(projectId, detail.experiment)
        : null;
      const total = (period: "baseline" | "observation") =>
        (detail?.ga4Days ?? [])
          .filter((day) => day.period === period)
          .reduce((sum, day) => sum + day.keyEvents, 0);
      return {
        ...run,
        conversions:
          detail?.conversionEvent && detail.ga4Days.length
            ? { baseline: total("baseline"), observation: total("observation") }
            : null,
        revenue,
      };
    }),
  );
  const report = workReport({
    changes: changes.flatMap((change) =>
      change.deployedAt && change.deploymentBasis
        ? [
            {
              ...change,
              deployedAt: change.deployedAt,
              deploymentBasis: change.deploymentBasis,
              approver:
                names.get(
                  approvals.find((row) => row.proposalId === change.proposalId)
                    ?.actorUserId ?? "",
                ) ?? null,
            },
          ]
        : [],
    ),
    results: details,
    approvals,
    waiting: pending.length,
  });
  return {
    month: input.month,
    ...report,
    results: {
      ...report.results,
      items: report.results.items.map((item) => ({
        ...item,
        revenue:
          details.find((row) => row.experimentId === item.experimentId)
            ?.revenue ?? null,
      })),
    },
  };
}

export const WorkReportService = { monthly };
