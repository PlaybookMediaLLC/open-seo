import type { deployed } from "@/server/features/experiments/repositories/experimentTestFixtures";
import { DeploymentSignalService } from "@/server/features/experiments/DeploymentSignalService";
import { ExperimentService } from "@/server/features/experiments/ExperimentService";
import { MeasurementService } from "@/server/features/experiments/MeasurementService";
import { MeasurementSettingsService } from "@/server/features/experiments/MeasurementSettingsService";
import { RevertService } from "@/server/features/experiments/RevertService";
import { AutomationService } from "@/server/features/growth/AutomationService";
import { SpendLimitService } from "@/server/features/spend/SpendLimitService";
import { ContentBriefService } from "@/server/features/opportunities/services/ContentBriefService";
import { ContentGapService } from "@/server/features/opportunities/services/ContentGapService";
import { OpportunityInvestigationService } from "@/server/features/opportunities/services/opportunityInvestigation";
import { OpportunityService } from "@/server/features/opportunities/services/OpportunityService";
import { getTicket } from "@/server/features/opportunities/services/opportunityTicketService";
import { SerpCheckService } from "@/server/features/opportunities/services/SerpCheckService";
import { GithubAppService } from "@/server/features/publishing/GithubAppService";
import { GithubIssueService } from "@/server/features/publishing/GithubIssueService";
import { MetadataExecutionService } from "@/server/features/publishing/MetadataExecutionService";
import { MetadataProposalService } from "@/server/features/publishing/MetadataProposalService";
import { ProposalDraftService } from "@/server/features/publishing/ProposalDraftService";
import { PublishingConnectionService } from "@/server/features/publishing/PublishingConnectionService";
import { PublishingRecoveryService } from "@/server/features/publishing/PublishingRecoveryService";

// RFC-0007: every growth service function, called by one organization with
// another organization's ids. Used by tenancy.test.ts.
type Seed = Awaited<ReturnType<typeof deployed>>;
const sha = "a".repeat(64);
type Calls = Record<string, Record<string, () => Promise<unknown>>>;
export const INTRUDER = {
  organizationId: "tenancy-intruder",
  userId: "intruder",
  userEmail: "intruder@example.com",
  role: "owner",
};

export function tenancyCalls(seed: Seed, ctx: typeof INTRUDER): Calls {
  const { input, experiment } = seed;
  const projectId = input.projectId;
  const opportunityId = input.proposal.opportunityId;
  const proposalId = input.proposal.id;
  const experimentId = experiment.id;
  return {
    OpportunityService: {
      list: () =>
        OpportunityService.list(ctx, {
          projectId,
          minPriority: 0,
          sort: "priority",
          includeDeferred: true,
          limit: 50,
          offset: 0,
          freshness: "all",
        }),
      get: () => OpportunityService.get(ctx, projectId, opportunityId),
      detect: () => OpportunityService.detect(ctx, projectId),
      review: () =>
        OpportunityService.review(ctx, {
          projectId,
          opportunityId,
          expectedVersion: 1,
          decision: "rejected",
          note: "",
        }),
      assign: () =>
        OpportunityService.assign(ctx, {
          projectId,
          opportunityId,
          expectedVersion: 1,
          ownerUserId: null,
        }),
    },
    getTicket: { getTicket: () => getTicket(ctx, projectId, opportunityId) },
    ContentBriefService: {
      create: () =>
        ContentBriefService.create(ctx, {
          projectId,
          opportunityId,
          expectedOpportunityVersion: 1,
        }),
      list: () => ContentBriefService.list(ctx, { projectId, opportunityId }),
    },
    ContentGapService: {
      estimate: () => ContentGapService.estimate(ctx, projectId, ["a.com"]),
      detect: () =>
        ContentGapService.detect(ctx, {
          projectId,
          domains: ["a.com"],
          confirmedCredits: 1,
        }),
    },
    SerpCheckService: {
      estimate: () => SerpCheckService.estimate(ctx, projectId, opportunityId),
      check: () =>
        SerpCheckService.check(ctx, {
          projectId,
          opportunityId,
          confirmedCredits: 1,
        }),
    },
    OpportunityInvestigationService: {
      investigate: () =>
        OpportunityInvestigationService.investigate(ctx, {
          projectId,
          opportunityId,
        }),
      listInvestigations: () =>
        OpportunityInvestigationService.listInvestigations(ctx, {
          projectId,
          opportunityId,
        }),
      summarizeInvestigation: () =>
        OpportunityInvestigationService.summarizeInvestigation(ctx, {
          projectId,
          investigationId: "investigation",
        }),
    },
    PublishingConnectionService: {
      get: () => PublishingConnectionService.get(ctx, projectId),
      connect: () =>
        PublishingConnectionService.connect(ctx, {
          projectId,
          owner: "owner",
          repository: "site",
          baseBranch: "main",
          rootDirectory: "",
          token: `github_pat_${"a".repeat(30)}`,
          authorizeRepositoryAccess: true,
          productionEnvironment: "Production",
        }),
      disconnect: () => PublishingConnectionService.disconnect(ctx, projectId),
      setProductionEnvironment: () =>
        PublishingConnectionService.setProductionEnvironment(ctx, {
          projectId,
          productionEnvironment: "Production",
        }),
    },
    GithubAppService: {
      state: () => GithubAppService.state(ctx, { projectId }),
      repositories: () => GithubAppService.repositories(ctx, { projectId }),
      connect: () =>
        GithubAppService.connect(ctx, {
          projectId,
          installationRef: "installation",
          repositoryId: "123",
          baseBranch: "main",
          rootDirectory: "",
          productionEnvironment: "Production",
        }),
    },
    MetadataProposalService: {
      get: () => MetadataProposalService.get(ctx, projectId, opportunityId),
      prepare: () =>
        MetadataProposalService.prepare(ctx, {
          projectId,
          opportunityId,
          expectedOpportunityVersion: 1,
          filePath: "app/page.tsx",
          newDescription: "A new description for the page.",
        }),
    },
    MetadataExecutionService: {
      execute: () =>
        MetadataExecutionService.execute(ctx, {
          projectId,
          proposalId,
          changeHash: sha,
          authorizePullRequest: true,
          note: "",
        }),
    },
    PublishingRecoveryService: {
      recover: () =>
        PublishingRecoveryService.recover(ctx, {
          projectId,
          opportunityId,
          expectedVersion: 1,
          confirmRecovery: true,
        }),
    },
    GithubIssueService: {
      preview: () =>
        GithubIssueService.preview(ctx, { projectId, opportunityId }),
      create: () =>
        GithubIssueService.create(ctx, {
          projectId,
          opportunityId,
          textHash: sha,
          confirmExactText: true,
        }),
    },
    ProposalDraftService: {
      locate: () =>
        ProposalDraftService.locate(ctx, { projectId, opportunityId }),
      draft: () =>
        ProposalDraftService.draft(ctx, {
          projectId,
          opportunityId,
          expectedOpportunityVersion: 1,
        }),
      draftAnchor: () =>
        ProposalDraftService.draftAnchor(ctx, {
          projectId,
          opportunityId,
          expectedOpportunityVersion: 1,
        }),
      list: () => ProposalDraftService.list(ctx, { projectId, opportunityId }),
      discard: () =>
        ProposalDraftService.discard(ctx, { projectId, draftId: "draft" }),
    },
    ExperimentService: {
      list: () =>
        ExperimentService.list(ctx, { projectId, limit: 50, offset: 0 }),
      get: () => ExperimentService.get(ctx, { projectId, experimentId }),
      register: () =>
        ExperimentService.register(ctx, {
          projectId,
          executionId: input.executionId,
        }),
      refreshPull: () =>
        ExperimentService.refreshPull(ctx, { projectId, experimentId }),
      confirmDeployment: () =>
        ExperimentService.confirmDeployment(ctx, {
          projectId,
          experimentId,
          deployedAt: new Date().toISOString(),
          note: "Live.",
          confirmProductionDeployment: true,
          otherChanges: false,
          seasonalRisk: false,
        }),
      confirmVerifiedDeployment: () =>
        ExperimentService.confirmVerifiedDeployment(ctx, {
          projectId,
          experimentId,
          note: "",
          otherChanges: false,
          seasonalRisk: false,
        }),
    },
    MeasurementService: {
      refresh: () =>
        MeasurementService.refresh(ctx, { projectId, experimentId }),
    },
    MeasurementSettingsService: {
      get: () =>
        MeasurementSettingsService.get(ctx, { projectId, experimentId }),
      keyEventNames: () =>
        MeasurementSettingsService.keyEventNames(ctx, {
          projectId,
          experimentId,
        }),
      save: () =>
        MeasurementSettingsService.save(ctx, {
          projectId,
          experimentId,
          autoRefresh: false,
          keyEvents: ["contact"],
        }),
      exportCsv: () =>
        MeasurementSettingsService.exportCsv(ctx, { projectId, experimentId }),
    },
    DeploymentSignalService: {
      refresh: () =>
        DeploymentSignalService.refresh(ctx, { projectId, experimentId }),
    },
    RevertService: {
      prepare: () => RevertService.prepare(ctx, { projectId, experimentId }),
      confirmDeployed: () =>
        RevertService.confirmDeployed(ctx, {
          projectId,
          proposalId,
          deployedAt: new Date().toISOString(),
          note: "Live.",
          confirmProductionDeployment: true,
        }),
    },
    AutomationService: {
      get: () => AutomationService.get(ctx, projectId),
      save: () =>
        AutomationService.save(ctx, {
          projectId,
          kind: "traffic_watch",
          enabled: true,
          interval: "daily",
          hourUtc: 7,
        }),
      runLogs: () => AutomationService.runLogs(ctx, { projectId, runId: "x" }),
    },
    SpendLimitService: {
      project: () => SpendLimitService.project(ctx, projectId),
      save: () =>
        SpendLimitService.save(ctx, { projectId, monthlyLimitCredits: 1 }),
    },
  };
}
