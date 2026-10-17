import { hasOrgPermission } from "@/lib/org-permissions";
import { Ga4ConnectionRepository } from "@/server/features/ga4/repositories/Ga4ConnectionRepository";
import {
  authorizePublishing,
  type PublishingContext,
} from "@/server/features/publishing/publishingAccess";
import { AppError } from "@/server/lib/errors";
import type {
  ExperimentInput,
  MeasurementSettingsInput,
} from "@/types/schemas/experiments";
import { experimentCsv } from "./experimentCsv";
import { growthJobsMode } from "@/server/features/growth/internalAuth";
import { fetchKeyEventNames, ga4Failure } from "./measurementGa4";
import { ExperimentRepository } from "./repositories/ExperimentRepository";
import { MeasurementGa4Repository } from "./repositories/measurementGa4Rows";

// RFC-0006: the daily refresh switch, the GA4 key events and the CSV export of
// one experiment.

async function experimentAndProperty(projectId: string, experimentId: string) {
  const detail = await ExperimentRepository.get(projectId, experimentId);
  if (!detail) throw new AppError("NOT_FOUND");
  const connection = await Ga4ConnectionRepository.getByProjectId(projectId);
  // GA4 numbers come only from the property the experiment started with.
  const property =
    connection && connection.propertyId === detail.experiment.ga4PropertyId
      ? connection
      : null;
  return { detail, property };
}

async function get(context: PublishingContext, input: ExperimentInput) {
  await authorizePublishing(context, input.projectId);
  const { detail, property } = await experimentAndProperty(
    input.projectId,
    input.experimentId,
  );
  return {
    autoRefresh: detail.experiment.autoRefresh,
    keyEvents: detail.keyEvents,
    hasGa4: Boolean(detail.experiment.ga4PropertyId),
    timeZone: property?.propertyTimeZone ?? null,
    canManage: hasOrgPermission(context.role, { integration: ["manage"] }),
    // RFC-0008: the daily refresh needs scheduled jobs on this installation.
    scheduledJobs: (await growthJobsMode()) !== "off",
  };
}

/** Key events the property counted lately, to choose from. */
async function keyEventNames(
  context: PublishingContext,
  input: ExperimentInput,
): Promise<{ names: string[]; error: string | null }> {
  await authorizePublishing(context, input.projectId, true);
  const { property } = await experimentAndProperty(
    input.projectId,
    input.experimentId,
  );
  if (!property)
    return {
      names: [],
      error: "This experiment has no GA4 property, or the property changed.",
    };
  try {
    return { names: await fetchKeyEventNames(property), error: null };
  } catch (error) {
    return { names: [], error: ga4Failure(error) };
  }
}

async function save(
  context: PublishingContext,
  input: MeasurementSettingsInput,
) {
  await authorizePublishing(context, input.projectId, true);
  // The key-event rows reference the experiment, so check it is this project's.
  await experimentAndProperty(input.projectId, input.experimentId);
  await MeasurementGa4Repository.saveSettings(input);
}

/** The stored daily rows as CSV. It makes no Google request. */
async function exportCsv(context: PublishingContext, input: ExperimentInput) {
  await authorizePublishing(context, input.projectId);
  const detail = await ExperimentRepository.get(
    input.projectId,
    input.experimentId,
  );
  if (!detail) throw new AppError("NOT_FOUND");
  return {
    filename: `experiment-${detail.experiment.createdAt.slice(0, 10)}-${detail.experiment.id.slice(0, 8)}.csv`,
    csv: experimentCsv({
      targetUrl: detail.experiment.targetUrl,
      days: [...detail.baselineDays, ...detail.observationDays],
      ga4Days: detail.ga4Days,
    }),
  };
}

export const MeasurementSettingsService = {
  get,
  keyEventNames,
  save,
  exportCsv,
};
