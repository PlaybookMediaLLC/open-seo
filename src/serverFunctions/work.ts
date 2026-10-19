import { createServerFn } from "@tanstack/react-start";
import { WorkReportService } from "@/server/features/work/WorkReportService";
import { WorkService } from "@/server/features/work/WorkService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  workProjectSchema,
  workReportInputSchema,
  workSettingsInputSchema,
} from "@/types/schemas/work";

// RFC-0018 5.9: "This week", its history and the cycle settings.
export const getThisWeek = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(workProjectSchema)
  .handler(({ context }) => WorkService.thisWeek(context, context.projectId));

export const getWorkHistory = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(workProjectSchema)
  .handler(({ context }) => WorkService.history(context, context.projectId));

export const saveWorkSettings = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(workSettingsInputSchema)
  .handler(({ context, data }) =>
    WorkService.saveSettings(context, {
      ...data,
      projectId: context.projectId,
    }),
  );

// RFC-0018 5.7: the monthly work report.
export const getWorkReport = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(workReportInputSchema)
  .handler(({ context, data }) =>
    WorkReportService.monthly(context, {
      ...data,
      projectId: context.projectId,
    }),
  );
