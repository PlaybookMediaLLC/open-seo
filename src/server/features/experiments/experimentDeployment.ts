import {
  ga4DateInTimeZone,
  shiftGa4Date,
} from "@/server/features/ga4/services/Ga4Dates";
import type { PublishingContext } from "@/server/features/publishing/publishingAccess";
import { AppError } from "@/server/lib/errors";
import type {
  ExperimentInput,
  ExperimentMutationResult,
} from "@/types/schemas/experiments";
import { refreshPullStatus } from "./experimentPullStatus";
import { ExperimentRepository } from "./repositories/ExperimentRepository";

// RFC-0005 5.11 and RFC-0006: records a confirmed production deployment,
// with its measurement windows and its RFC-0009 audit event.
export async function recordDeployment(
  context: PublishingContext,
  input: ExperimentInput & {
    deployedAt: string;
    note: string;
    otherChanges: boolean;
    seasonalRisk: boolean;
    basis: "human" | "verified";
  },
  claimToken: string,
  signal: AbortSignal,
): Promise<ExperimentMutationResult | null> {
  const detail = await ExperimentRepository.get(
    input.projectId,
    input.experimentId,
  );
  if (!detail) throw new AppError("NOT_FOUND");
  if (detail.experiment.deployedAt)
    return {
      ok: false,
      message:
        "Deployment is already confirmed. The recorded deployment and measurement windows cannot be overwritten.",
    };
  const updated = await refreshPullStatus(context, detail, claimToken, signal);
  if (
    updated.pullRequestState !== "merged" ||
    !updated.mergedAt ||
    !updated.mergeCommitSha ||
    input.deployedAt < updated.mergedAt
  )
    return {
      ok: false,
      message:
        "The approved change must be verified as merged before the stated production deployment time.",
    };
  const day = ga4DateInTimeZone(
    new Date(input.deployedAt),
    "America/Los_Angeles",
  );
  const saved = await ExperimentRepository.confirmDeployment({
    projectId: input.projectId,
    experimentId: input.experimentId,
    claimToken,
    organizationId: context.organizationId,
    deployedAt: input.deployedAt,
    confirmedBy: context.userId,
    note: input.note,
    confirmedAt: new Date().toISOString(),
    otherChanges: input.otherChanges,
    seasonalRisk: input.seasonalRisk,
    basis: input.basis,
    baselineStart: shiftGa4Date(day, -28),
    baselineEnd: shiftGa4Date(day, -1),
    observationStart: shiftGa4Date(day, 7),
    observationEnd: shiftGa4Date(day, 34),
    audit: {
      organizationId: context.organizationId,
      projectId: input.projectId,
      actor: context,
      action: "experiment.deployment_confirmed",
      targetType: "experiment",
      targetId: input.experimentId,
      summary: `Confirmed the production deployment (${input.basis === "verified" ? "verified signals" : "stated by a person"}) at ${input.deployedAt}`,
    },
  });
  if (!saved) throw new AppError("CONFLICT");
  return null;
}
