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
