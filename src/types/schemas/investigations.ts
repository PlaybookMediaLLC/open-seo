import { z } from "zod";

// RFC-0004 phase 3: an investigation of a declining page.
export const INVESTIGATION_FINDING_KINDS = [
  "query_loss",
  "index_state",
  "audit_issue",
  "rank_change",
  "check_unavailable",
] as const;
export const INVESTIGATION_SEVERITIES = [
  "high",
  "medium",
  "low",
  "info",
] as const;

const projectScope = z.object({ projectId: z.string().min(1) });
export const investigateInputSchema = projectScope.extend({
  opportunityId: z.string().min(1),
});
export const summarizeInvestigationInputSchema = projectScope.extend({
  investigationId: z.string().min(1),
});

export type InvestigationFinding = {
  id: string;
  kind: (typeof INVESTIGATION_FINDING_KINDS)[number];
  severity: (typeof INVESTIGATION_SEVERITIES)[number];
  summary: string;
  metricBefore: number | null;
  metricAfter: number | null;
};

export type OpportunityInvestigation = {
  id: string;
  opportunityId: string;
  runId: string;
  status: "completed";
  createdBy: string;
  createdAt: string;
  summary: string | null;
  summaryModel: string | null;
  summaryCostUsd: number | null;
  summarizedAt: string | null;
  findings: InvestigationFinding[];
};
