import { z } from "zod";

// RFC-0012 5.4: the text picker and the copy locator.
const opportunity = z.object({
  projectId: z.string().min(1),
  opportunityId: z.string().min(1),
});
export const pageTextsInputSchema = opportunity;
export const locateCopyInputSchema = opportunity.extend({
  text: z.string().trim().min(1).max(500),
  filePath: z.string().trim().min(1).max(500).optional(),
});
export const prepareCopyInputSchema = opportunity.extend({
  expectedOpportunityVersion: z.number().int().positive(),
  edits: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(500),
        newText: z.string().trim().min(1).max(500),
      }),
    )
    .min(1)
    .max(5),
  // The person confirmed that the listed pages that share the text change too.
  confirmSharedPages: z.boolean().default(false),
  filePath: z.string().trim().min(1).max(500).optional(),
  // RFC-0012 5.5: the AI draft the new text started from, if any.
  draftId: z.string().min(1).optional(),
});
export const draftCopyInputSchema = opportunity.extend({
  expectedOpportunityVersion: z.number().int().positive(),
  text: z.string().trim().min(1).max(500),
  blockKind: z.enum(["heading", "button", "link", "label", "paragraph"]),
});
export type PrepareCopyInput = z.infer<typeof prepareCopyInputSchema>;
