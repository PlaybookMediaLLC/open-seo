import { z } from "zod";

export const OPPORTUNITY_TYPES = [
  "striking_distance",
  "declining_page",
  "low_ctr",
  "cannibalization",
  // Only this type may change canonical or robots (RFC-0005).
  "technical_blocker",
  "internal_link",
] as const;
export const OPPORTUNITY_DIAGNOSES = [
  "ranking_drop",
  "demand_drop",
  "ctr_drop",
  "mixed",
  "seasonal",
  "unknown",
] as const;
export const OPPORTUNITY_RUN_KINDS = ["search_console"] as const;
// The year-ago periods are the current and previous windows moved back 364
// days, so weekdays match.
export const EVIDENCE_PERIODS = [
  "current",
  "previous",
  "year_ago",
  "year_ago_previous",
] as const;
export const OPPORTUNITY_URL_ROLES = [
  "primary",
  "competing",
  "link_source",
  "link_target",
] as const;
export const BRAND_TERM_AUTHORS = ["user", "sam", "mcp"] as const;
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
export type OpportunityDiagnosis = (typeof OPPORTUNITY_DIAGNOSES)[number];
export type OpportunityUrlRole = (typeof OPPORTUNITY_URL_ROLES)[number];
export type EvidencePeriod = (typeof EVIDENCE_PERIODS)[number];

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
export const BRAND_TERM_LIMIT = 20;
/** Lowercase, trimmed, 2 to 60 characters, at most 20 per project. */
export const brandTermsSchema = z
  .array(
    z
      .string()
      .transform((term) => term.trim().toLowerCase().replace(/\s+/g, " "))
      .pipe(z.string().min(2).max(60)),
  )
  .max(BRAND_TERM_LIMIT)
  .transform((terms) => [...new Set(terms)]);
export const brandTermsInputSchema = projectScope;
export const updateBrandTermsInputSchema = projectScope.extend({
  terms: brandTermsSchema,
});
export type BrandTerms = {
  terms: string[];
  /** "domain" means no saved terms, so the project domain gives one. */
  source: "saved" | "domain" | "none";
};
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

export type Ga4LandingPageMetrics = {
  period: "current" | "previous";
  landingPage: string;
  sessions: number;
  keyEvents: number;
  revenue: number | null;
  currency: string | null;
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
  diagnosis: OpportunityDiagnosis | null;
  /** Search Console rows. An empty url or query means the opportunity's own. */
  evidence: Array<{
    period: EvidencePeriod;
    url: string;
    query: string;
    metrics: OpportunityMetrics;
  }>;
  /** Set only for opportunities about two or more URLs. */
  urls: Array<{ url: string; role: OpportunityUrlRole }>;
  ga4: Ga4LandingPageMetrics[];
  // Phase 2 evidence. Only the types that read these sources set them.
  audit?: AuditIssueEvidence;
  inspection?: InspectionEvidence;
  link?: LinkEvidence;
  rank?: RankEvidence[];
};

export type AuditIssueEvidence = {
  auditId: string;
  auditIssueId: string | null;
  issueType: string;
  severity: "critical" | "warning" | "info";
  pageUrl: string;
  auditCompletedAt: string;
};

export type InspectionEvidence = {
  url: string;
  verdict: string | null;
  coverageState: string | null;
  indexingState: string | null;
  robotsTxtState: string | null;
  pageFetchState: string | null;
  googleCanonical: string | null;
  userCanonical: string | null;
  lastCrawlTime: string | null;
  inspectedAt: string;
};

export type LinkEvidence = {
  auditId: string;
  sourceUrl: string;
  targetUrl: string;
  sharedQuery: string;
  sourceImpressions: number;
  sourcePosition: number;
};

export type RankEvidence = {
  trackingKeywordId: string;
  device: "desktop" | "mobile";
  firstPosition: number | null;
  lastPosition: number | null;
  firstCheckedAt: string;
  lastCheckedAt: string;
};

export type Opportunity = Omit<
  OpportunityCandidate,
  "evidence" | "urls" | "ga4" | "audit" | "inspection" | "link" | "rank"
> & {
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
  kind: (typeof OPPORTUNITY_RUN_KINDS)[number];
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
  yearAgoPageRows: number;
  ga4PropertyId: string | null;
  auditId: string | null;
  inspectionRequests: number;
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
  period: EvidencePeriod;
  startDate: string;
  endDate: string;
  /** Empty means the opportunity's own URL or query. */
  url: string;
  query: string;
};

export type OpportunityUrl = {
  id: string;
  opportunityId: string;
  url: string;
  role: OpportunityUrlRole;
};

export type OpportunityGa4Evidence = Ga4LandingPageMetrics & {
  id: string;
  opportunityId: string;
  runId: string;
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
  urls: OpportunityUrl[];
  ga4Evidence: OpportunityGa4Evidence[];
  auditEvidence: Array<AuditIssueEvidence & RunScoped>;
  inspectionEvidence: Array<InspectionEvidence & RunScoped>;
  linkEvidence: Array<LinkEvidence & RunScoped>;
  rankEvidence: Array<RankEvidence & RunScoped>;
  decisions: OpportunityDecision[];
};
type RunScoped = { id: string; opportunityId: string; runId: string };

export type OpportunityDetectionResult = {
  outcome: "completed" | "cached" | "busy" | "not_connected" | "failed";
  run: OpportunityRun | null;
  message: string;
};
