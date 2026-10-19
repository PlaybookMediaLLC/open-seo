import { hasOrgPermission } from "@/lib/org-permissions";
import { Ga4ConnectionRepository } from "@/server/features/ga4/repositories/Ga4ConnectionRepository";
import { GscService } from "@/server/features/gsc/services/GscService";
import {
  ensureDefaultSchedules,
  TRACKING_JOBS,
} from "@/server/features/growth/AutomationService";
import { OpportunityRepository } from "@/server/features/opportunities/repositories/OpportunityRepository";
import {
  authorizePublishing,
  publishingEncryptionKey,
  withPublishingClaim,
  type PublishingContext,
} from "@/server/features/publishing/publishingAccess";
import { PublishingRepository } from "@/server/features/publishing/repositories/PublishingRepository";
import { experimentRevenue } from "@/server/features/revenue/RevenueReportService";
import { AppError } from "@/server/lib/errors";
import {
  confirmDeploymentInputSchema,
  confirmVerifiedDeploymentInputSchema,
  experimentInputSchema,
  experimentListInputSchema,
  registerExperimentInputSchema,
  type ConfirmDeploymentInput,
  type ConfirmVerifiedDeploymentInput,
  type ExperimentInput,
  type ExperimentListInput,
  type ExperimentMutationResult,
  type GrowthExperiment,
  type RegisterExperimentInput,
} from "@/types/schemas/experiments";
import { assessMeasurement } from "./measurementAnalysis";
import { recordDeployment } from "./experimentDeployment";
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
  const [gsc, github, overlappingChanges, revenue] = await Promise.all([
    GscService.getConnection(input.projectId),
    PublishingRepository.getConnection(input.projectId),
    ExperimentRepository.hasOverlappingChanges(
      input.projectId,
      input.experimentId,
    ),
    experimentRevenue(input.projectId, detail.experiment),
  ]);
  return {
    ...detail,
    canManage: hasOrgPermission(context.role, { integration: ["manage"] }),
    configured: Boolean(await publishingEncryptionKey()),
    connected: gsc?.siteUrl === detail.experiment.siteUrl,
    revenue,
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
    const [gsc, ga4] = await Promise.all([
      GscService.getConnection(input.projectId),
      Ga4ConnectionRepository.getByProjectId(input.projectId),
    ]);
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
      deploymentBasis: null,
      otherChanges: false,
      seasonalRisk: false,
      baselineStart: null,
      baselineEnd: null,
      observationStart: null,
      observationEnd: null,
      baselineRunId: null,
      // RFC-0006: GA4 numbers come only from the property at registration.
      ga4PropertyId: ga4?.propertyId ?? null,
      autoRefresh: true,
    };
    if (
      !(await ExperimentRepository.register({
        experiment,
        claimToken,
        organizationId: context.organizationId,
        audit: {
          organizationId: context.organizationId,
          projectId: input.projectId,
          actor: context,
          action: "experiment.registered",
          targetType: "experiment",
          targetId: experiment.id,
          summary: `Started tracking ${experiment.targetUrl}`,
        },
      }))
    )
      throw new AppError("CONFLICT");
    // RFC-0008: tracking turns on the daily measurement and deployment jobs.
    await ensureDefaultSchedules(
      input.projectId,
      context.userId,
      TRACKING_JOBS,
    ).catch(() => undefined);
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

// Records the deployment time and the measurement windows around it. The
// approved change must be merged before the deployment time.
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
      const refused = await recordDeployment(
        context,
        { ...input, deployedAt, basis: "human" },
        claimToken,
        signal,
      );
      if (refused) return refused;
      await ExperimentRepository.recordSignal({
        projectId: input.projectId,
        experimentId: input.experimentId,
        claimToken,
        organizationId: context.organizationId,
        signal: {
          id: crypto.randomUUID(),
          projectId: input.projectId,
          experimentId: input.experimentId,
          kind: "human_attestation",
          observedAt: new Date().toISOString(),
          effectiveAt: deployedAt,
          environment: null,
          externalId: "human",
          detail: input.note.slice(0, 500),
          createdBy: context.userId,
        },
      });
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

// The verified basis needs two independent signals: GitHub's successful
// production deployment of the merge commit, and the approved text on the
// live page. The person still declares other changes and seasonal risk.
async function confirmVerifiedDeployment(
  context: PublishingContext,
  raw: ConfirmVerifiedDeploymentInput,
): Promise<ExperimentMutationResult> {
  await authorizePublishing(context, raw.projectId, true);
  const input = confirmVerifiedDeploymentInputSchema.parse(raw);
  return withPublishingClaim(
    context,
    input.projectId,
    async (claimToken, signal) => {
      const signals = await ExperimentRepository.listSignals(
        input.projectId,
        input.experimentId,
      );
      const github = signals.find((row) => row.kind === "github_deployment");
      const live = signals.find((row) => row.kind === "live_content_match");
      if (!github || !live)
        return {
          ok: false,
          message:
            "The verified start needs a GitHub deployment signal and a live page signal. Check signals again, or confirm the deployment yourself.",
        };
      const refused = await recordDeployment(
        context,
        {
          ...input,
          deployedAt: github.effectiveAt,
          note:
            input.note ||
            `Verified by GitHub deployment ${github.externalId} and the live page.`,
          basis: "verified",
        },
        claimToken,
        signal,
      );
      return (
        refused ?? {
          ok: true,
          message:
            "Measurement starts on the verified basis. The deployment time comes from GitHub.",
        }
      );
    },
  ).catch(() => ({
    ok: false,
    message:
      "Could not start measurement on the verified basis. Existing history was preserved.",
  }));
}

export const ExperimentService = {
  list,
  get,
  register,
  refreshPull,
  confirmDeployment,
  confirmVerifiedDeployment,
};
