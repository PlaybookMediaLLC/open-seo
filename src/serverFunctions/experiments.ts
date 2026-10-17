import { createServerFn } from "@tanstack/react-start";
import { DeploymentSignalService } from "@/server/features/experiments/DeploymentSignalService";
import { ExperimentService } from "@/server/features/experiments/ExperimentService";
import { MeasurementSettingsService } from "@/server/features/experiments/MeasurementSettingsService";
import { MeasurementService } from "@/server/features/experiments/MeasurementService";
import { RevertService } from "@/server/features/experiments/RevertService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  confirmDeploymentInputSchema,
  confirmVerifiedDeploymentInputSchema,
  experimentInputSchema,
  experimentListInputSchema,
  measurementSettingsInputSchema,
  registerExperimentInputSchema,
} from "@/types/schemas/experiments";
import { confirmRevertInputSchema } from "@/types/schemas/publishing";

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
export const refreshDeploymentSignals = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(experimentInputSchema)
  .handler(({ context, data }) =>
    DeploymentSignalService.refresh(context, {
      ...data,
      projectId: context.projectId,
    }),
  );
export const confirmVerifiedDeployment = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(confirmVerifiedDeploymentInputSchema)
  .handler(({ context, data }) =>
    ExperimentService.confirmVerifiedDeployment(context, {
      ...data,
      projectId: context.projectId,
    }),
  );
export const prepareRevertProposal = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(experimentInputSchema)
  .handler(({ context, data }) =>
    RevertService.prepare(context, { ...data, projectId: context.projectId }),
  );
export const confirmRevertDeployed = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(confirmRevertInputSchema)
  .handler(({ context, data }) =>
    RevertService.confirmDeployed(context, {
      ...data,
      projectId: context.projectId,
    }),
  );

// RFC-0006: daily refresh and GA4 key events for one experiment.
export const getMeasurementSettings = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(experimentInputSchema)
  .handler(({ context, data }) =>
    MeasurementSettingsService.get(context, {
      ...data,
      projectId: context.projectId,
    }),
  );
export const listExperimentKeyEvents = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(experimentInputSchema)
  .handler(({ context, data }) =>
    MeasurementSettingsService.keyEventNames(context, {
      ...data,
      projectId: context.projectId,
    }),
  );
export const saveMeasurementSettings = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(measurementSettingsInputSchema)
  .handler(({ context, data }) =>
    MeasurementSettingsService.save(context, {
      ...data,
      projectId: context.projectId,
    }),
  );
export const exportExperimentCsv = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(experimentInputSchema)
  .handler(({ context, data }) =>
    MeasurementSettingsService.exportCsv(context, {
      ...data,
      projectId: context.projectId,
    }),
  );
