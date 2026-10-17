import { z } from "zod";

// RFC-0004: drafts written by a model and checked before a person sees them.
export const DRAFT_KINDS = [
  "meta_description",
  "meta_title",
  "internal_link_anchor",
] as const;
export const DRAFT_STATUSES = [
  "generated",
  "rejected_by_validation",
  "used",
  "discarded",
] as const;
export const DRAFT_SOURCE_KINDS = [
  "query",
  "page_text",
  "project_context",
  "current_metadata",
] as const;

const projectScope = z.object({ projectId: z.string().min(1) });
export const opportunityDraftInputSchema = projectScope.extend({
  opportunityId: z.string().min(1),
});
export const draftAnchorInputSchema = opportunityDraftInputSchema.extend({
  expectedOpportunityVersion: z.number().int().min(1),
});
export const draftProposalTextInputSchema = draftAnchorInputSchema.extend({
  kind: z.enum(["meta_description", "meta_title"]).default("meta_description"),
  /** The page file, when the locator or the person found it. */
  filePath: z.string().trim().min(1).max(512).optional(),
});
export const discardDraftInputSchema = projectScope.extend({
  draftId: z.string().min(1),
});
export type DraftProposalTextInput = z.input<
  typeof draftProposalTextInputSchema
>;
export type DraftAnchorInput = z.infer<typeof draftAnchorInputSchema>;

export type DraftSource = {
  id: string;
  kind: (typeof DRAFT_SOURCE_KINDS)[number];
  label: string;
  excerpt: string;
};

export type ProposalDraft = {
  id: string;
  opportunityId: string;
  opportunityVersion: number;
  evidenceRunId: string;
  kind: (typeof DRAFT_KINDS)[number];
  status: (typeof DRAFT_STATUSES)[number];
  targetUrl: string;
  filePath: string | null;
  valueBefore: string | null;
  valueAfter: string;
  rationale: string;
  validationSummary: string;
  model: string;
  promptVersion: string;
  inputDigest: string;
  costUsd: number;
  createdBy: string;
  createdAt: string;
  sources: DraftSource[];
  claims: Array<{
    id: string;
    claimText: string;
    sourceId: string | null;
    verified: boolean;
  }>;
};
