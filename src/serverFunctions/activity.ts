import { createServerFn } from "@tanstack/react-start";
import { ActivityService } from "@/server/features/activity/ActivityService";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";
import { activityFiltersSchema } from "@/types/schemas/activity";

// RFC-0009 5.6: the organization's audit events.
export const getActivity = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .validator(activityFiltersSchema)
  .handler(({ context, data }) => ActivityService.list(context, data));

export const exportActivityCsv = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .validator(activityFiltersSchema)
  .handler(({ context, data }) => ActivityService.exportCsv(context, data));
