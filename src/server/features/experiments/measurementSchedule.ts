import type {
  GrowthExperiment,
  MeasurementRun,
} from "@/types/schemas/experiments";

// RFC-0006 5.3: an experiment is due for its daily refresh until the final
// result is stored; the refresh itself keeps the 5-a-day allowance.
const DAY_MS = 86_400_000;

export function measurementRefreshDue(
  experiment: Pick<GrowthExperiment, "deployedAt" | "autoRefresh">,
  latestRun: Pick<MeasurementRun, "windowComplete" | "finishedAt"> | null,
  now: Date,
) {
  if (!experiment.deployedAt || !experiment.autoRefresh) return false;
  // The job stops once the final result exists.
  if (latestRun?.windowComplete) return false;
  return (
    !latestRun?.finishedAt ||
    now.getTime() - Date.parse(latestRun.finishedAt) >= DAY_MS
  );
}
