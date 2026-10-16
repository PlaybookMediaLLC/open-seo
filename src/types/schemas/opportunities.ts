import { z } from "zod";

export const OPPORTUNITY_TYPES = [
  "striking_distance",
  "declining_page",
] as const;
export const OPPORTUNITY_STATUSES = [
  "discovered",
  "reviewed",
  "approved",
  "in_progress",
  "implemented",
  "measuring",
  "completed",
  "rejected",
  "failed",
  "reverted",
] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

const projectScope = z.object({ projectId: z.string().min(1) });
export const detectOpportunitiesInputSchema = projectScope;
export const listOpportunitiesInputSchema = projectScope.extend({
  status: z.enum(OPPORTUNITY_STATUSES).optional(),
  type: z.enum(OPPORTUNITY_TYPES).optional(),
  minPriority: z.number().int().min(0).max(100).default(0),
  sort: z.enum(["priority", "newest"]).default("priority"),
  includeDeferred: z.boolean().default(false),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).max(10000).default(0),
});
export const opportunityDetailInputSchema = projectScope.extend({
  opportunityId: z.string().min(1),
});
export const reviewOpportunityInputSchema = opportunityDetailInputSchema.extend(
  {
    expectedVersion: z.number().int().min(1),
    decision: z.enum(["reviewed", "approved", "rejected", "deferred"]),
    note: z.string().trim().max(2000).default(""),
  },
);
export type OpportunityListInput = z.infer<typeof listOpportunitiesInputSchema>;
export type OpportunityReviewInput = z.infer<
  typeof reviewOpportunityInputSchema
>;

export type OpportunityMetrics = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type OpportunityCandidate = {
  type: OpportunityType;
  url: string;
  query: string | null;
  title: string;
  explanation: string;
  recommendedAction: string;
  searchIntent: string;
  confidence: number;
  effortHours: number;
  priority: number;
  commercialScore: number;
  demandScore: number;
  visibilityScore: number;
  difficultyScore: number;
  effortScore: number;
  scoreExplanation: string;
  uncertainty: string;
  current: OpportunityMetrics;
  previous: OpportunityMetrics | null;
};

export type Opportunity = Omit<OpportunityCandidate, "current" | "previous"> & {
  id: string;
  projectId: string;
  siteUrl: string;
  identityKey: string;
  status: OpportunityStatus;
  ownerUserId: string | null;
  evidenceRunId: string;
  firstDetectedAt: string;
  lastDetectedAt: string;
  deferredUntil: string | null;
  version: number;
};

export type OpportunityRun = {
  id: string;
  projectId: string;
  siteUrl: string;
  status: "running" | "completed" | "failed";
  requestedBy: string;
  startDate: string;
  endDate: string;
  previousStartDate: string;
  previousEndDate: string;
  startedAt: string;
  finishedAt: string | null;
  queryRows: number;
  currentPageRows: number;
  previousPageRows: number;
  requestCount: number;
  opportunityCount: number;
  truncated: boolean;
  error: string | null;
};

export type OpportunityEvidence = OpportunityMetrics & {
  id: string;
  opportunityId: string;
  runId: string;
  source: "google_search_console";
  period: "current" | "previous";
  startDate: string;
  endDate: string;
};

export type OpportunityDecision = {
  id: string;
  opportunityId: string;
  evidenceRunId: string;
  actorUserId: string;
  // "reverted" is recorded only when a confirmed revert ships (RFC-0005 5.6).
  decision: OpportunityReviewInput["decision"] | "reverted";
  fromStatus: OpportunityStatus;
  toStatus: OpportunityStatus;
  note: string;
  createdAt: string;
};

export type OpportunityDetail = {
  opportunity: Opportunity;
  evidence: OpportunityEvidence[];
  decisions: OpportunityDecision[];
};

export type OpportunityDetectionResult = {
  outcome: "completed" | "cached" | "busy" | "not_connected" | "failed";
  run: OpportunityRun | null;
  message: string;
};
