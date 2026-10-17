import { z } from "zod";

// RFC-0004 phase 3: content briefs for new pages and page refreshes.
export const BRIEF_OPPORTUNITY_TYPES = [
  "content_gap",
  "declining_page",
  "striking_distance",
  "low_ctr",
] as const;

const opportunityScope = z.object({
  projectId: z.string().min(1),
  opportunityId: z.string().min(1),
});
export const listBriefsInputSchema = opportunityScope;
export const createBriefInputSchema = opportunityScope.extend({
  expectedOpportunityVersion: z.number().int().min(1),
});

export type ContentBrief = {
  id: string;
  opportunityId: string;
  status: "generated" | "rejected_by_validation";
  title: string;
  audience: string;
  searchIntent: string;
  outlineMarkdown: string;
  model: string;
  promptVersion: string;
  costUsd: number;
  createdBy: string;
  createdAt: string;
  keywords: Array<{
    keyword: string;
    searchVolume: number | null;
    role: "primary" | "secondary";
  }>;
};
