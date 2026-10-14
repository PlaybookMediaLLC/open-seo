import { sort } from "remeda";
import { z } from "zod";
import {
  inclusiveGa4Days,
  shiftGa4Date,
} from "@/server/features/ga4/services/Ga4Dates";
import { sumSearchTotals } from "@/server/features/gsc/searchPerformanceReport";
import { AppError } from "@/server/lib/errors";
import type { GscSearchAnalyticsRow } from "@/server/lib/gscClient";
import type {
  MeasurementAssessment,
  MeasurementDay,
  MeasurementTotals,
} from "@/types/schemas/experiments";

const dateSchema = z.iso.date();
const rowsSchema = z
  .array(
    z.object({
      keys: z.tuple([dateSchema]),
      clicks: z.number().finite().nonnegative(),
      impressions: z.number().finite().nonnegative(),
      ctr: z.number().finite().min(0).max(1),
      position: z.number().finite().nonnegative(),
    }),
  )
  .max(100);

type ParseInput = {
  projectId: string;
  experimentId: string;
  runId: string;
  baselineStart: string;
  baselineEnd: string;
  observationStart: string;
  observationEnd: string;
  observationThrough: string | null;
};

function invalid(message: string): never {
  throw new AppError("VALIDATION_ERROR", message);
}

export function parseMeasurementDays(
  rows: GscSearchAnalyticsRow[],
  input: ParseInput,
): MeasurementDay[] {
  const {
    baselineStart,
    baselineEnd,
    observationStart,
    observationEnd,
    observationThrough,
  } = input;
  const dates = [baselineStart, baselineEnd, observationStart, observationEnd];
  if (observationThrough !== null) dates.push(observationThrough);
  if (
    dates.some((date) => !dateSchema.safeParse(date).success) ||
    inclusiveGa4Days(baselineStart, baselineEnd) !== 28 ||
    inclusiveGa4Days(observationStart, observationEnd) !== 28 ||
    baselineEnd >= observationStart ||
    (observationThrough !== null &&
      (observationThrough < observationStart ||
        observationThrough > observationEnd))
  ) {
    invalid("Measurement date windows are invalid.");
  }
  const parsed = rowsSchema.safeParse(rows);
  if (!parsed.success)
    invalid("Search Console returned invalid daily measurement rows.");
  // A null observation cutoff can still include washout dates in the one combined request.
  const through = observationThrough ?? shiftGa4Date(observationStart, -1);
  const seen = new Set<string>();
  const days: MeasurementDay[] = [];
  for (const row of parsed.data) {
    const date = row.keys[0];
    if (date < baselineStart || date > through)
      invalid(
        "Search Console returned a date outside the measurement request.",
      );
    if (seen.has(date))
      invalid("Search Console returned duplicate daily measurement rows.");
    seen.add(date);
    const period =
      date <= baselineEnd
        ? "baseline"
        : date >= observationStart
          ? "observation"
          : null;
    if (!period) continue;
    days.push({
      id: crypto.randomUUID(),
      projectId: input.projectId,
      experimentId: input.experimentId,
      runId: input.runId,
      period,
      date,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    });
  }
  return sort(days, (a, b) => a.date.localeCompare(b.date));
}

function totals(days: MeasurementDay[]): MeasurementTotals {
  const result = sumSearchTotals(days);
  if (
    ![result.clicks, result.impressions, result.ctr, result.position].every(
      Number.isFinite,
    )
  ) {
    invalid("Measurement totals cannot be represented safely.");
  }
  return {
    ...result,
    reportedDays: new Set(days.map((day) => day.date)).size,
    ctr: result.impressions > 0 ? result.ctr : null,
    position: result.impressions > 0 ? result.position : null,
  };
}

function fullyReported(
  days: MeasurementDay[],
  period: MeasurementDay["period"],
): boolean {
  if (days.length !== 28 || days.some((day) => day.period !== period))
    return false;
  const dates = sort(
    days.map((day) => day.date),
    (a, b) => a.localeCompare(b),
  );
  return dates.every((date, index) => date === shiftGa4Date(dates[0], index));
}

export function assessMeasurement(input: {
  baselineDays: MeasurementDay[];
  observationDays: MeasurementDay[];
  windowComplete: boolean;
  otherChanges: boolean;
  seasonalRisk: boolean;
  overlappingChanges: boolean;
}): MeasurementAssessment {
  const baseline = totals(input.baselineDays);
  const observation = totals(input.observationDays);
  const clickChange = observation.clicks - baseline.clicks;
  const clickChangePercent =
    baseline.clicks > 0 ? (clickChange / baseline.clicks) * 100 : null;
  const result: MeasurementAssessment = {
    outcome: "inconclusive",
    explanation: "",
    baseline,
    observation,
    clickChange,
    clickChangePercent,
  };
  if (!input.windowComplete) {
    return {
      ...result,
      explanation:
        "The full observation window is not available yet. Missing or future days are unknown, not zero.",
    };
  }
  if (
    !fullyReported(input.baselineDays, "baseline") ||
    !fullyReported(input.observationDays, "observation")
  ) {
    return {
      ...result,
      explanation:
        "Both periods need 28 distinct, consecutive reported days. Missing days are unknown, not zero, so the available totals are not a full-period comparison.",
    };
  }
  if (input.otherChanges || input.seasonalRisk || input.overlappingChanges) {
    return {
      ...result,
      explanation:
        "Other changes, seasonal risk, or overlapping experiments make this comparison inconclusive. The observed difference cannot be attributed to this change.",
    };
  }
  if (
    baseline.clicks < 100 ||
    baseline.impressions < 1000 ||
    observation.impressions < 1000
  ) {
    return {
      ...result,
      explanation:
        "There is not enough reported traffic for the conservative comparison: at least 100 baseline clicks and 1,000 impressions in each period are required.",
    };
  }
  // These are descriptive product thresholds, not statistical significance or a causal estimate.
  if (
    Math.abs(clickChange) < 20 ||
    Math.abs(clickChange / baseline.clicks) < 0.2
  ) {
    return {
      ...result,
      explanation:
        "The observed click change did not meet both descriptive thresholds: 20 clicks and 20%. This does not demonstrate no effect.",
    };
  }
  return {
    ...result,
    outcome: clickChange > 0 ? "encouraging" : "negative",
    explanation: `Observed clicks were ${clickChange > 0 ? "higher" : "lower"} by at least 20 clicks and 20% across the completed periods. This before/after comparison is not a statistical or causal claim about the change.`,
  };
}
