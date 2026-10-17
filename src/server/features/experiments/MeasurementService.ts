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
  refreshMeasurementInputSchema,
  type ExperimentMutationResult,
  type RefreshMeasurementInput,
  type GrowthExperiment,
  type MeasurementRun,
} from "@/types/schemas/experiments";
import { Ga4ConnectionRepository } from "@/server/features/ga4/repositories/Ga4ConnectionRepository";
import { assessMeasurement, parseMeasurementDays } from "./measurementAnalysis";
import { fetchMeasurementGa4, ga4Failure } from "./measurementGa4";
import { MeasurementGa4Repository } from "./repositories/measurementGa4Rows";
import { ExperimentRepository } from "./repositories/ExperimentRepository";

const NO_GA4 = { days: [], eventTotals: [] };
// Days 63 to 90 after deployment are the primary window moved by 8 weeks.
const LONG_TERM_SHIFT = 56;

/** GA4 rows for the run, or a reason on the run when GA4 cannot answer. */
async function measureGa4(
  experiment: GrowthExperiment,
  run: MeasurementRun,
  windows: Parameters<typeof fetchMeasurementGa4>[0]["windows"],
) {
  if (!experiment.ga4PropertyId) return NO_GA4;
  try {
    const connection = await Ga4ConnectionRepository.getByProjectId(
      run.projectId,
    );
    if (connection?.propertyId !== experiment.ga4PropertyId) {
      run.ga4Error =
        "The GA4 property changed since tracking started. Reconnect the original property to see GA4 data.";
      return NO_GA4;
    }
    const result = await fetchMeasurementGa4({
      connection,
      targetUrl: experiment.targetUrl,
      windows,
      keyEvents: await MeasurementGa4Repository.keyEvents(
        run.projectId,
        run.experimentId,
      ),
      ids: {
        projectId: run.projectId,
        experimentId: run.experimentId,
        runId: run.id,
      },
    });
    run.requestCount += result.requests;
    return result;
  } catch (error) {
    run.ga4Error = ga4Failure(error);
    return NO_GA4;
  }
}

const FAILURE =
  "Measurement could not finish. Saved baseline and observations are unchanged. Check Search Console access and retry after five minutes, subject to the project's five-attempt daily limit.";

async function refresh(
  context: PublishingContext,
  raw: RefreshMeasurementInput,
): Promise<ExperimentMutationResult> {
  await authorizePublishing(context, raw.projectId, true);
  const input = refreshMeasurementInputSchema.parse(raw);
  const longTerm = input.window === "long_term";
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
      if (longTerm && !detail.latestRun?.windowComplete)
        return {
          ok: false,
          message:
            "The long-term check starts after the primary result is final. No Google request was made.",
        };
      // RFC-0006 5.4: days 63 to 90 after deployment, with the same baseline.
      const window = longTerm
        ? {
            start: shiftGa4Date(observationStart, LONG_TERM_SHIFT),
            end: shiftGa4Date(observationEnd, LONG_TERM_SHIFT),
          }
        : { start: observationStart, end: observationEnd };
      const saved = longTerm ? detail.longTermRun : detail.latestRun;
      if (
        saved?.status === "completed" &&
        saved.finishedAt &&
        Date.now() - Date.parse(saved.finishedAt) < 86_400_000
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
        finalDate < window.start
          ? null
          : finalDate < window.end
            ? finalDate
            : window.end;
      if (longTerm && !observationThrough)
        return {
          ok: false,
          message:
            "The long-term window starts 63 days after deployment, plus three reporting days. No Google request was made.",
        };
      // A long-term run reads only its own window; the baseline stays pinned.
      const queryStart = longTerm ? window.start : baselineStart;
      const queryEnd = observationThrough ?? baselineEnd;
      if (
        resolveDateRange({ startDate: queryStart, endDate: queryEnd })
          .startDate !== queryStart
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
        includesBaseline: !longTerm && !experiment.baselineRunId,
        observationThrough,
        outcome: "inconclusive",
        explanation: "Measurement has not completed.",
        overlappingChanges: false,
        windowComplete: observationThrough === window.end,
        error: null,
        ga4Error: null,
        window: input.window,
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
            startDate: queryStart,
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
          result.request.startDate !== queryStart ||
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
          observationStart: window.start,
          observationEnd: window.end,
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
        // RFC-0006: GA4 is supporting evidence. It never changes the label,
        // and its failure never fails the Search Console run.
        const ga4 = await measureGa4(experiment, run, {
          baselineStart,
          baselineEnd,
          observationStart: window.start,
          observationThrough,
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
            ga4Days: ga4.days,
            ga4EventTotals: ga4.eventTotals,
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
