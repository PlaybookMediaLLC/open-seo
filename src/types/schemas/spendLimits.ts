import { z } from "zod";

// RFC-0009 5.5: null removes the limit.
const monthlyLimitCredits = z.number().int().min(0).max(100_000_000).nullable();

export const saveOrganizationLimitSchema = z.object({ monthlyLimitCredits });
export const projectSpendSchema = z.object({ projectId: z.string().min(1) });
export const saveProjectLimitSchema = projectSpendSchema.extend({
  monthlyLimitCredits,
});
