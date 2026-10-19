import { z } from "zod";

// RFC-0014 5.5: the fix a person asks Relay to prepare for a performance item.
export const performanceFixInputSchema = z.object({
  projectId: z.string().min(1),
  opportunityId: z.string().min(1),
  expectedOpportunityVersion: z.number().int().positive(),
  fix: z.enum(["lcp_priority", "image_size", "script_strategy"]),
});
export type PerformanceFixInput = z.infer<typeof performanceFixInputSchema>;
