import { hasOrgPermission } from "@/lib/org-permissions";
import {
  ga4DateInTimeZone,
  shiftGa4Date,
} from "@/server/features/ga4/services/Ga4Dates";
import { GscService } from "@/server/features/gsc/services/GscService";
import { OpportunityRepository } from "@/server/features/opportunities/repositories/OpportunityRepository";
import {
  authorizePublishing,
  publishingEncryptionKey,
  withPublishingClaim,
  type PublishingContext,
} from "@/server/features/publishing/publishingAccess";
import { PublishingRepository } from "@/server/features/publishing/repositories/PublishingRepository";
import { AppError } from "@/server/lib/errors";
import {
  confirmDeploymentInputSchema,
  experimentInputSchema,
  experimentListInputSchema,
  registerExperimentInputSchema,
  type ConfirmDeploymentInput,
  type ExperimentInput,
  type ExperimentListInput,
  type ExperimentMutationResult,
  type GrowthExperiment,
  type RegisterExperimentInput,
} from "@/types/schemas/experiments";
import { assessMeasurement } from "./measurementAnalysis";
import { refreshPullStatus } from "./experimentPullStatus";
import { ExperimentRepository } from "./repositories/ExperimentRepository";

async function list(context: PublishingContext, raw: ExperimentListInput) {
  await authorizePublishing(context, raw.projectId);
  const input = experimentListInputSchema.parse(raw);
  return {
    ...(await ExperimentRepository.list(input)),
    canManage: hasOrgPermission(context.role, { integration: ["manage"] }),
    configured: Boolean(await publishingEncryptionKey()),
  };
}

async function get(context: PublishingContext, raw: ExperimentInput) {
  await authorizePublishing(context, raw.projectId);
  const input = experimentInputSchema.parse(raw);
  const detail = await ExperimentRepository.get(
    input.projectId,
    input.experimentId,
  );
  if (!detail) throw new AppError("NOT_FOUND");
  const [gsc, github, overlappingChanges] = await Promise.all([
    GscService.getConnection(input.projectId),
    PublishingRepository.getConnection(input.projectId),
    ExperimentRepository.hasOverlappingChanges(
      input.projectId,
      input.experimentId,
    ),
  ]);
  return {
    ...detail,
    canManage: hasOrgPermission(context.role, { integration: ["manage"] }),
    configured: Boolean(await publishingEncryptionKey()),
    connected: gsc?.siteUrl === detail.experiment.siteUrl,
    githubConnected: Boolean(
      github &&
      github.repositoryId === detail.publishing.connection.repositoryId &&
      github.baseBranch === detail.publishing.connection.baseBranch,
    ),
    assessment: assessMeasurement({
      baselineDays: detail.baselineDays,
      observationDays: detail.observationDays,
      windowComplete: detail.latestRun?.windowComplete ?? false,
      otherChanges: detail.experiment.otherChanges,
      seasonalRisk: detail.experiment.seasonalRisk,
      overlappingChanges,
    }),
  };
}

async function register(
  context: PublishingContext,
  raw: RegisterExperimentInput,
): Promise<ExperimentMutationResult> {
  await authorizePublishing(context, raw.projectId, true);
  const input = registerExperimentInputSchema.parse(raw);
  return withPublishingClaim(context, input.projectId, async (claimToken) => {
    const existing = await ExperimentRepository.getForExecution(
      input.projectId,
      input.executionId,
    );
    if (existing)
      return {
        ok: true,
        experimentId: existing.id,
        message: "Result tracking already exists for this execution.",
      };
    const history = await ExperimentRepository.getExecutionHistory(
      input.projectId,
      input.executionId,
    );
    const execution = history?.executions.find(
      (row) => row.id === input.executionId && row.status === "succeeded",
    );
    if (!history || !execution?.pullRequestNumber || !execution.commitSha)
      throw new AppError("NOT_FOUND");
    const detail = await OpportunityRepository.getDetail(
      input.projectId,
      history.proposal.opportunityId,
    );
    const gsc = await GscService.getConnection(input.projectId);
    if (!detail || gsc?.siteUrl !== detail.opportunity.siteUrl)
      throw new AppError("CONFLICT");
    const experiment: GrowthExperiment = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      opportunityId: history.proposal.opportunityId,
      proposalId: history.proposal.id,
      executionId: execution.id,
      siteUrl: detail.opportunity.siteUrl,
      targetUrl: history.proposal.targetUrl,
      createdBy: context.userId,
      createdAt: new Date().toISOString(),
      pullRequestState: "unknown",
      pullRequestCheckedAt: null,
      mergedAt: null,
      mergeCommitSha: null,
      deployedAt: null,
      deploymentConfirmedBy: null,
      deploymentNote: null,
      deploymentConfirmedAt: null,
      otherChanges: false,
      seasonalRisk: false,
      baselineStart: null,
      baselineEnd: null,
      observationStart: null,
      observationEnd: null,
      baselineRunId: null,
    };
    if (
      !(await ExperimentRepository.register({
        experiment,
        claimToken,
        organizationId: context.organizationId,
      }))
    )
      throw new AppError("CONFLICT");
    return {
      ok: true,
      experimentId: experiment.id,
      message:
        "Tracking registered. Refresh GitHub status, then confirm the actual production deployment. No provider call or deployment was made.",
    };
  }).catch(() => ({
    ok: false,
    message:
      "Could not start tracking. Check that the approved pull request and original Search Console property are still available, then retry.",
  }));
}

async function refreshPull(
  context: PublishingContext,
  raw: ExperimentInput,
): Promise<ExperimentMutationResult> {
  await authorizePublishing(context, raw.projectId, true);
  const input = experimentInputSchema.parse(raw);
  return withPublishingClaim(
    context,
    input.projectId,
    async (claimToken, signal) => {
      const detail = await ExperimentRepository.get(
        input.projectId,
        input.experimentId,
      );
      if (!detail) throw new AppError("NOT_FOUND");
      if (
        detail.experiment.pullRequestCheckedAt &&
        Date.now() - Date.parse(detail.experiment.pullRequestCheckedAt) <
          300_000
      ) {
        return {
          ok: true,
          message:
            "Using verified pull request status from the last five minutes. No GitHub request was made.",
        };
      }
      const updated = await refreshPullStatus(
        context,
        detail,
        claimToken,
        signal,
      );
      return {
        ok: true,
        message:
          updated.pullRequestState === "merged"
            ? "GitHub confirms the approved change was merged. This does not confirm production deployment."
            : `GitHub reports this pull request is ${updated.pullRequestState}. No remote changes were made.`,
      };
    },
  ).catch(() => ({
    ok: false,
    message:
      "Could not verify the original approved pull request. Check the GitHub connection. Changed commits, repositories, or merge content require review; saved deployment history is unchanged.",
  }));
}

async function confirmDeployment(
  context: PublishingContext,
  raw: ConfirmDeploymentInput,
): Promise<ExperimentMutationResult> {
  await authorizePublishing(context, raw.projectId, true);
  const input = confirmDeploymentInputSchema.parse(raw);
  const deployedAt = new Date(input.deployedAt).toISOString();
  const age = Date.now() - Date.parse(deployedAt);
  if (age < 0 || age > 90 * 86_400_000)
    return {
      ok: false,
      message:
        "Use the actual production deployment time within the past 90 days, not a future date.",
    };
  return withPublishingClaim(
    context,
    input.projectId,
    async (claimToken, signal) => {
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
      const updated = await refreshPullStatus(
        context,
        detail,
        claimToken,
        signal,
      );
      if (
        updated.pullRequestState !== "merged" ||
        !updated.mergedAt ||
        !updated.mergeCommitSha ||
        deployedAt < updated.mergedAt
      )
        return {
          ok: false,
          message:
            "The approved change must be verified as merged before the stated production deployment time.",
        };
      const day = ga4DateInTimeZone(
        new Date(deployedAt),
        "America/Los_Angeles",
      );
      const saved = await ExperimentRepository.confirmDeployment({
        projectId: input.projectId,
        experimentId: input.experimentId,
        claimToken,
        organizationId: context.organizationId,
        deployedAt,
        confirmedBy: context.userId,
        note: input.note,
        confirmedAt: new Date().toISOString(),
        otherChanges: input.otherChanges,
        seasonalRisk: input.seasonalRisk,
        baselineStart: shiftGa4Date(day, -28),
        baselineEnd: shiftGa4Date(day, -1),
        observationStart: shiftGa4Date(day, 7),
        observationEnd: shiftGa4Date(day, 34),
      });
      if (!saved) throw new AppError("CONFLICT");
      return {
        ok: true,
        message:
          "Your production-deployment attestation is recorded. It is not an independently verified deployment. Refresh measurements when finalized data is available.",
      };
    },
  ).catch(() => ({
    ok: false,
    message:
      "Could not confirm deployment. Check the approved merged change, repository access, and original Search Console property. Existing history was preserved.",
  }));
}

export const ExperimentService = {
  list,
  get,
  register,
  refreshPull,
  confirmDeployment,
};
