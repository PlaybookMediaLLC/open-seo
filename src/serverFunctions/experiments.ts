import { createServerFn } from "@tanstack/react-start";
import { ExperimentService } from "@/server/features/experiments/ExperimentService";
import { MeasurementService } from "@/server/features/experiments/MeasurementService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  confirmDeploymentInputSchema,
  experimentInputSchema,
  experimentListInputSchema,
  registerExperimentInputSchema,
} from "@/types/schemas/experiments";

export const listExperiments = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(experimentListInputSchema)
  .handler(({ context, data }) =>
    ExperimentService.list(context, { ...data, projectId: context.projectId }),
  );
export const getExperiment = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(experimentInputSchema)
  .handler(({ context, data }) =>
    ExperimentService.get(context, { ...data, projectId: context.projectId }),
  );
export const registerExperiment = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(registerExperimentInputSchema)
  .handler(({ context, data }) =>
    ExperimentService.register(context, {
      ...data,
      projectId: context.projectId,
    }),
  );
export const refreshExperimentPullRequest = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(experimentInputSchema)
  .handler(({ context, data }) =>
    ExperimentService.refreshPull(context, {
      ...data,
      projectId: context.projectId,
    }),
  );
export const confirmExperimentDeployment = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(confirmDeploymentInputSchema)
  .handler(({ context, data }) =>
    ExperimentService.confirmDeployment(context, {
      ...data,
      projectId: context.projectId,
    }),
  );
export const refreshExperimentMeasurements = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(experimentInputSchema)
  .handler(({ context, data }) =>
    MeasurementService.refresh(context, {
      ...data,
      projectId: context.projectId,
    }),
  );
