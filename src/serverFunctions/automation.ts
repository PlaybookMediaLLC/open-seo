import { createServerFn } from "@tanstack/react-start";
import { AutomationService } from "@/server/features/growth/AutomationService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  automationProjectInputSchema,
  runLogsInputSchema,
  saveScheduleInputSchema,
} from "@/types/schemas/growthJobs";

// RFC-0008 5.10: the Automation tab.
export const getAutomation = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(automationProjectInputSchema)
  .handler(({ context }) => AutomationService.get(context, context.projectId));

export const saveGrowthSchedule = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(saveScheduleInputSchema)
  .handler(({ context, data }) =>
    AutomationService.save(context, { ...data, projectId: context.projectId }),
  );

export const getGrowthRunLogs = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(runLogsInputSchema)
  .handler(({ context, data }) =>
    AutomationService.runLogs(context, {
      ...data,
      projectId: context.projectId,
    }),
  );
