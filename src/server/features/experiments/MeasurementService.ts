import {
  ga4DateInTimeZone,
  shiftGa4Date,
} from "@/server/features/ga4/services/Ga4Dates";
import { resolveDateRange } from "@/server/features/gsc/searchAnalytics";
import { GscService } from "@/server/features/gsc/services/GscService";
import {
  authorizePublishing,
  withPublishingClaim,
  type PublishingContext,
} from "@/server/features/publishing/publishingAccess";
import { AppError } from "@/server/lib/errors";
import {
  experimentInputSchema,
  type ExperimentInput,
  type ExperimentMutationResult,
  type MeasurementRun,
} from "@/types/schemas/experiments";
import { assessMeasurement, parseMeasurementDays } from "./measurementAnalysis";
import { ExperimentRepository } from "./repositories/ExperimentRepository";

const FAILURE =
  "Measurement could not finish. Saved baseline and observations are unchanged. Check Search Console access and retry after five minutes, subject to the project's five-attempt daily limit.";

async function refresh(
  context: PublishingContext,
  raw: ExperimentInput,
): Promise<ExperimentMutationResult> {
  await authorizePublishing(context, raw.projectId, true);
  const input = experimentInputSchema.parse(raw);
  return withPublishingClaim(
    context,
    input.projectId,
    async (claimToken, signal) => {
      const detail = await ExperimentRepository.get(
        input.projectId,
        input.experimentId,
      );
      if (!detail) throw new AppError("NOT_FOUND");
      const { experiment } = detail;
      const { baselineStart, baselineEnd, observationStart, observationEnd } =
        experiment;
      if (
        !experiment.deployedAt ||
        !baselineStart ||
        !baselineEnd ||
        !observationStart ||
        !observationEnd
      )
        return {
          ok: false,
          message:
            "Confirm the actual production deployment before requesting measurements. A merged pull request is not a deployment.",
        };
      if (
        detail.latestRun?.status === "completed" &&
        Date.now() - Date.parse(detail.latestRun.startedAt) < 86_400_000
      )
        return {
          ok: true,
          message:
            "Using the saved measurement from the last 24 hours. No Google request was made.",
        };
      const connection = await GscService.getConnection(input.projectId);
      if (connection?.siteUrl !== experiment.siteUrl)
        return {
          ok: false,
          message:
            "Reconnect this experiment's original Search Console property. Data from another property cannot replace its baseline.",
        };
      const finalDate = shiftGa4Date(
        ga4DateInTimeZone(new Date(), "America/Los_Angeles"),
        -3,
      );
      if (finalDate < baselineEnd)
        return {
          ok: false,
          message:
            "The complete pre-change baseline is not yet old enough for the three-day reporting allowance. No Google request was made.",
        };
      const observationThrough =
        finalDate < observationStart
          ? null
          : finalDate < observationEnd
            ? finalDate
            : observationEnd;
      const queryEnd = observationThrough ?? baselineEnd;
      if (
        resolveDateRange({ startDate: baselineStart, endDate: queryEnd })
          .startDate !== baselineStart
      )
        return {
          ok: false,
          message:
            "This measurement window is outside Search Console's available history. Saved snapshots remain available; no request was made.",
        };
      const run: MeasurementRun = {
        id: claimToken,
        projectId: input.projectId,
        experimentId: input.experimentId,
        status: "running",
        requestedBy: context.userId,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        requestCount: 1,
        includesBaseline: !experiment.baselineRunId,
        observationThrough,
        outcome: "inconclusive",
        explanation: "Measurement has not completed.",
        overlappingChanges: false,
        windowComplete: observationThrough === observationEnd,
        error: null,
      };
      const scope = {
        projectId: input.projectId,
        experimentId: input.experimentId,
        claimToken,
        organizationId: context.organizationId,
      };
      if (
        !(await ExperimentRepository.startRun({
          run,
          claimToken,
          organizationId: context.organizationId,
        }))
      )
        return {
          ok: false,
          message:
            "Measurement was not started. A cached result, five-minute retry delay, five-attempt project daily limit, or changed connection prevents this run. No Google request was made.",
        };
      try {
        signal.throwIfAborted();
        const result = await GscService.getPerformance(
          {
            projectId: input.projectId,
            startDate: baselineStart,
            endDate: queryEnd,
            dimensions: ["date"],
            filters: [
              {
                dimension: "page",
                operator: "equals",
                expression: experiment.targetUrl,
              },
            ],
            rowLimit: 100,
            type: "web",
            dataState: "final",
          },
          { signal },
        );
        signal.throwIfAborted();
        if (
          result.siteUrl !== experiment.siteUrl ||
          result.request.startDate !== baselineStart ||
          result.request.endDate !== queryEnd ||
          result.rows.length >= 100
        )
          throw new AppError("CONFLICT");
        const parsed = parseMeasurementDays(result.rows, {
          projectId: input.projectId,
          experimentId: input.experimentId,
          runId: run.id,
          baselineStart,
          baselineEnd,
          observationStart,
          observationEnd,
          observationThrough,
        });
        const days = run.includesBaseline
          ? parsed
          : parsed.filter((day) => day.period === "observation");
        run.overlappingChanges =
          await ExperimentRepository.hasOverlappingChanges(
            input.projectId,
            input.experimentId,
          );
        const assessment = assessMeasurement({
          baselineDays: run.includesBaseline
            ? days.filter((day) => day.period === "baseline")
            : detail.baselineDays,
          observationDays: days.filter((day) => day.period === "observation"),
          windowComplete: run.windowComplete,
          otherChanges: experiment.otherChanges,
          seasonalRisk: experiment.seasonalRisk,
          overlappingChanges: run.overlappingChanges,
        });
        run.outcome = assessment.outcome;
        run.explanation = assessment.explanation;
        run.status = "completed";
        run.finishedAt = new Date().toISOString();
        signal.throwIfAborted();
        if (
          !(await ExperimentRepository.completeRun({
            run,
            days,
            claimToken,
            organizationId: context.organizationId,
          }))
        )
          throw new AppError("CONFLICT");
        return {
          ok: true,
          message:
            "Saved finalized Search Console observations. These are measured differences, not proof that the change caused them. No site changes were made.",
        };
      } catch {
        await ExperimentRepository.failRun({
          ...scope,
          runId: run.id,
          message: FAILURE,
        }).catch(() => false);
        return { ok: false, message: FAILURE };
      }
    },
  ).catch(() => ({
    ok: false,
    message:
      "Measurement is unavailable or another project operation is running. Saved results remain available. Reload and retry later.",
  }));
}

export const MeasurementService = { refresh };
