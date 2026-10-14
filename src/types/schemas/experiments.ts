import { z } from "zod";
import type { ProposalWithHistory } from "./publishing";

const project = z.object({ projectId: z.string().min(1) });
export const experimentListInputSchema = project.extend({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
});
export const experimentInputSchema = project.extend({
  experimentId: z.string().min(1),
});
export const registerExperimentInputSchema = project.extend({
  executionId: z.string().min(1),
});
export const confirmDeploymentInputSchema = experimentInputSchema.extend({
  deployedAt: z.iso.datetime({ offset: true }),
  note: z.string().trim().min(1).max(2000),
  confirmProductionDeployment: z.literal(true),
  otherChanges: z.boolean(),
  seasonalRisk: z.boolean(),
});
export type ExperimentListInput = z.infer<typeof experimentListInputSchema>;
export type ExperimentInput = z.infer<typeof experimentInputSchema>;
export type RegisterExperimentInput = z.infer<
  typeof registerExperimentInputSchema
>;
export type ConfirmDeploymentInput = z.infer<
  typeof confirmDeploymentInputSchema
>;
export type MeasurementOutcome = "encouraging" | "inconclusive" | "negative";
export type GrowthExperiment = {
  id: string;
  projectId: string;
  opportunityId: string;
  proposalId: string;
  executionId: string;
  siteUrl: string;
  targetUrl: string;
  createdBy: string;
  createdAt: string;
  pullRequestState: "unknown" | "open" | "closed" | "merged";
  pullRequestCheckedAt: string | null;
  mergedAt: string | null;
  mergeCommitSha: string | null;
  deployedAt: string | null;
  deploymentConfirmedBy: string | null;
  deploymentNote: string | null;
  deploymentConfirmedAt: string | null;
  otherChanges: boolean;
  seasonalRisk: boolean;
  baselineStart: string | null;
  baselineEnd: string | null;
  observationStart: string | null;
  observationEnd: string | null;
  baselineRunId: string | null;
};
export type MeasurementRun = {
  id: string;
  projectId: string;
  experimentId: string;
  status: "running" | "completed" | "failed";
  requestedBy: string;
  startedAt: string;
  finishedAt: string | null;
  requestCount: number;
  includesBaseline: boolean;
  observationThrough: string | null;
  outcome: MeasurementOutcome;
  explanation: string;
  overlappingChanges: boolean;
  windowComplete: boolean;
  error: string | null;
};
export type MeasurementDay = {
  id: string;
  projectId: string;
  experimentId: string;
  runId: string;
  period: "baseline" | "observation";
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};
export type MeasurementTotals = {
  reportedDays: number;
  clicks: number;
  impressions: number;
  ctr: number | null;
  position: number | null;
};
export type MeasurementAssessment = {
  outcome: MeasurementOutcome;
  explanation: string;
  baseline: MeasurementTotals;
  observation: MeasurementTotals;
  clickChange: number;
  clickChangePercent: number | null;
};
export type ExperimentSummary = GrowthExperiment & {
  opportunityTitle: string;
  pullRequestUrl: string | null;
  latestRun: MeasurementRun | null;
};
export type ExperimentDetail = {
  experiment: GrowthExperiment;
  publishing: ProposalWithHistory;
  runs: MeasurementRun[];
  baselineDays: MeasurementDay[];
  observationDays: MeasurementDay[];
  latestRun: MeasurementRun | null;
};
export type ExperimentMutationResult = {
  ok: boolean;
  message: string;
  experimentId?: string;
};
