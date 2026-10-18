import { z } from "zod";
import type { ProposalWithHistory } from "./publishing";

const project = z.object({ projectId: z.string().min(1) });
// RFC-0006 5.5: a final label, or "measuring" until the window is complete.
export const EXPERIMENT_LABELS = [
  "encouraging",
  "inconclusive",
  "negative",
  "measuring",
] as const;
export type ExperimentLabel = (typeof EXPERIMENT_LABELS)[number];
export const experimentListInputSchema = project.extend({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
  label: z.enum(EXPERIMENT_LABELS).optional(),
});
export const experimentInputSchema = project.extend({
  experimentId: z.string().min(1),
});
// RFC-0006: GA4 event names are letters, digits and underscores.
const ga4EventName = z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,39}$/);
export const measurementSettingsInputSchema = experimentInputSchema.extend({
  autoRefresh: z.boolean(),
  keyEvents: z
    .array(ga4EventName)
    .max(5)
    .refine((names) => new Set(names).size === names.length, {
      message: "Choose each key event once.",
    }),
});
export type MeasurementSettingsInput = z.infer<
  typeof measurementSettingsInputSchema
>;
// RFC-0006 5.4: the primary window, or the long-term check at days 63 to 90.
export const refreshMeasurementInputSchema = experimentInputSchema.extend({
  window: z.enum(["primary", "long_term"]).default("primary"),
});
export type RefreshMeasurementInput = z.input<
  typeof refreshMeasurementInputSchema
>;
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
export const confirmVerifiedDeploymentInputSchema =
  experimentInputSchema.extend({
    note: z.string().trim().max(2000).default(""),
    otherChanges: z.boolean(),
    seasonalRisk: z.boolean(),
  });
export type ConfirmVerifiedDeploymentInput = z.input<
  typeof confirmVerifiedDeploymentInputSchema
>;
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
  deploymentBasis: "human" | "verified" | null;
  otherChanges: boolean;
  seasonalRisk: boolean;
  baselineStart: string | null;
  baselineEnd: string | null;
  observationStart: string | null;
  observationEnd: string | null;
  baselineRunId: string | null;
  ga4PropertyId: string | null;
  autoRefresh: boolean;
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
  ga4Error: string | null;
  window: "primary" | "long_term";
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
export type DeploymentSignal = {
  id: string;
  projectId: string;
  experimentId: string;
  kind: "human_attestation" | "github_deployment" | "live_content_match";
  observedAt: string;
  effectiveAt: string;
  environment: string | null;
  externalId: string;
  detail: string;
  createdBy: string;
};
export type ExperimentDetail = {
  experiment: GrowthExperiment;
  publishing: ProposalWithHistory;
  signals: DeploymentSignal[];
  runs: MeasurementRun[];
  baselineDays: MeasurementDay[];
  observationDays: MeasurementDay[];
  latestRun: MeasurementRun | null;
  longTermRun: MeasurementRun | null;
  longTermDays: MeasurementDay[];
  keyEvents: string[];
  /** RFC-0012 5.6: the project's chosen conversion, if any. */
  conversionEvent: string | null;
  ga4Days: MeasurementGa4Day[];
  ga4EventTotals: MeasurementGa4EventTotal[];
};

// RFC-0006: GA4 supporting metrics, stored per run.
export type MeasurementGa4Day = {
  id: string;
  projectId: string;
  runId: string;
  experimentId: string;
  date: string;
  period: "baseline" | "observation";
  sessions: number;
  engagedSessions: number;
  keyEvents: number;
  revenue: number | null;
  currency: string | null;
};
export type MeasurementGa4EventTotal = {
  id: string;
  projectId: string;
  runId: string;
  period: "baseline" | "observation";
  eventName: string;
  keyEvents: number;
};
export type ExperimentMutationResult = {
  ok: boolean;
  message: string;
  experimentId?: string;
};
