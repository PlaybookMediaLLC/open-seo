import type { GrowthJobKind } from "@/types/schemas/growthJobs";
import type { LogLine } from "./repositories/GrowthJobRepository";
import { auditFollowupJob } from "./jobs/auditFollowup";
import { cwvRefreshJob } from "./jobs/cwvRefresh";
import { deploymentCheckJob } from "./jobs/deploymentCheck";
import { measurementRefreshJob } from "./jobs/measurementRefresh";
import {
  opportunityRefreshJob,
  recommendationRecheckJob,
} from "./jobs/opportunityJobs";
import { trafficWatchJob } from "./jobs/trafficWatch";

// RFC-0008 5.8: each job runs with the schedule owner's current permissions.
export type JobContext = {
  projectId: string;
  windowKey: string;
  organizationId: string;
  // `scheduled` labels audit events as the system's (RFC-0009).
  actor: {
    organizationId: string;
    userId: string;
    role: string;
    scheduled?: boolean;
  };
  now: Date;
  log: (level: LogLine["level"], message: string) => void;
};
type Job = (context: JobContext) => Promise<{ summary: string }>;

export const GROWTH_JOBS: Partial<Record<GrowthJobKind, Job>> = {
  opportunity_refresh: opportunityRefreshJob,
  measurement_refresh: measurementRefreshJob,
  deployment_check: deploymentCheckJob,
  traffic_watch: trafficWatchJob,
  recommendation_recheck: recommendationRecheckJob,
  audit_followup: auditFollowupJob,
  cwv_refresh: cwvRefreshJob,
};
