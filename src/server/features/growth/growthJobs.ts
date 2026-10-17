import type { GrowthJobKind } from "@/types/schemas/growthJobs";
import type { LogLine } from "./repositories/GrowthJobRepository";
import { measurementRefreshJob } from "./jobs/measurementRefresh";

// RFC-0008 5.8: each job runs with the schedule owner's current permissions.
export type JobContext = {
  projectId: string;
  organizationId: string;
  actor: { organizationId: string; userId: string; role: string };
  now: Date;
  log: (level: LogLine["level"], message: string) => void;
};
type Job = (context: JobContext) => Promise<{ summary: string }>;

export const GROWTH_JOBS: Partial<Record<GrowthJobKind, Job>> = {
  measurement_refresh: measurementRefreshJob,
};
