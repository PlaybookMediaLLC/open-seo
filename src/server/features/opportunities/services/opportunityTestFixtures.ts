import type {
  OpportunityDetail,
  OpportunityRun,
  OpportunityStatus,
} from "@/types/schemas/opportunities";

export function opportunityDetail(
  status: OpportunityStatus = "discovered",
): OpportunityDetail {
  const now = new Date().toISOString();
  return {
    opportunity: {
      id: "opportunity-1",
      projectId: "project-1",
      siteUrl: "https://example.com/",
      identityKey: "identity",
      status,
      ownerUserId: null,
      evidenceRunId: "evidence-1",
      firstDetectedAt: now,
      lastDetectedAt: now,
      deferredUntil: null,
      version: 1,
      type: "striking_distance",
      url: "https://example.com/pricing",
      query: "software",
      title: "Review query",
      explanation: "Observed position 10",
      recommendedAction: "Review",
      searchIntent: "Unverified",
      confidence: 0.65,
      effortHours: 2,
      priority: 30,
      commercialScore: 1,
      demandScore: 0.5,
      visibilityScore: 0.5,
      difficultyScore: 0.5,
      effortScore: 0.5,
      scoreExplanation: "Heuristic",
      uncertainty: "Not a forecast",
    },
    evidence: [],
    decisions: [],
  };
}

export function opportunityRun(
  overrides: Partial<OpportunityRun> = {},
): OpportunityRun {
  const now = new Date().toISOString();
  return {
    id: "run-1",
    projectId: "project-1",
    siteUrl: "https://example.com/",
    status: "completed",
    requestedBy: "user-1",
    startDate: "2026-09-13",
    endDate: "2026-10-10",
    previousStartDate: "2026-08-16",
    previousEndDate: "2026-09-12",
    startedAt: now,
    finishedAt: now,
    queryRows: 0,
    currentPageRows: 0,
    previousPageRows: 0,
    requestCount: 3,
    opportunityCount: 0,
    truncated: false,
    error: null,
    ...overrides,
  };
}
