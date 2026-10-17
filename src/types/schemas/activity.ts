import { z } from "zod";
import { AUDIT_ACTIONS } from "@/shared/auditActions";

// RFC-0009 5.6: the Activity page filters.
export const activityFiltersSchema = z.object({
  projectId: z.string().min(1).optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  actorId: z.string().min(1).optional(),
});
export type ActivityFilters = z.infer<typeof activityFiltersSchema>;
