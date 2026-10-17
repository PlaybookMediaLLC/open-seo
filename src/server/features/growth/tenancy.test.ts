import { count } from "drizzle-orm";
import { getTableConfig, SQLiteTable } from "drizzle-orm/sqlite-core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import * as contentBriefsSchema from "@/db/content-briefs.schema";
import * as experimentsSchema from "@/db/experiments.schema";
import * as measurementGa4Schema from "@/db/measurement-ga4.schema";
import * as opportunitiesSchema from "@/db/opportunities.schema";
import * as contentGapSchema from "@/db/opportunity-content-gap.schema";
import * as investigationsSchema from "@/db/opportunity-investigations.schema";
import * as signalsSchema from "@/db/opportunity-signals.schema";
import * as draftsSchema from "@/db/proposal-drafts.schema";
import * as publishingSchema from "@/db/publishing.schema";
import { DeploymentSignalService } from "@/server/features/experiments/DeploymentSignalService";
import { ExperimentService } from "@/server/features/experiments/ExperimentService";
import { MeasurementService } from "@/server/features/experiments/MeasurementService";
import { MeasurementSettingsService } from "@/server/features/experiments/MeasurementSettingsService";
import { RevertService } from "@/server/features/experiments/RevertService";
import { deployed } from "@/server/features/experiments/repositories/experimentTestFixtures";
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

// RFC-0007 section 4: organization A must never reach organization B's
// growth data through any service, for reads or writes.
const database = await vi.hoisted(async () => {
  const { createExperimentTestDatabase } =
    await import("@/server/features/experiments/repositories/experimentTestDb");
  return createExperimentTestDatabase();
});
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));

// Organization-level by design: an App installation serves many projects.
const ORGANIZATION_TABLES = new Set(["github_app_installations"]);
const tablesOf = (...schemas: object[]) =>
  schemas.flatMap((schema) =>
    Object.values(schema).filter((value) => value instanceof SQLiteTable),
  );
const growthTables = tablesOf(
  opportunitiesSchema,
  signalsSchema,
  contentGapSchema,
  investigationsSchema,
  contentBriefsSchema,
  publishingSchema,
  draftsSchema,
  experimentsSchema,
  measurementGa4Schema,
);

let seed: Awaited<ReturnType<typeof deployed>>;
const intruder = {
  organizationId: "tenancy-intruder",
  userId: "intruder",
  userEmail: "intruder@example.com",
  role: "owner",
};
const sha = "a".repeat(64);

beforeAll(async () => {
  await database.prepare();
  if (!database.isPostgres)
    // The real project lookup selects every column of the full table.
    await database.client.executeMultiple(`
      ALTER TABLE projects ADD COLUMN domain TEXT;
      ALTER TABLE projects ADD COLUMN location_code INTEGER DEFAULT 2840;
      ALTER TABLE projects ADD COLUMN language_code TEXT DEFAULT 'en';
      ALTER TABLE projects ADD COLUMN created_at TEXT;
      ALTER TABLE projects ADD COLUMN ai_research_keywords TEXT;
    `);
  seed = await deployed(database);
  await database.client.execute({
    sql: "INSERT INTO organization (id, name, slug, created_at) VALUES (?, 'intruder', ?, CURRENT_TIMESTAMP)",
    args: [intruder.organizationId, `${database.slugPrefix}intruder`],
  });
  await database.client.execute({
    sql: "INSERT INTO projects (id, organization_id, name) VALUES (?, ?, 'intruder')",
    args: ["tenancy-intruder-project", intruder.organizationId],
  });
  vi.stubGlobal("fetch", () => {
    throw new Error("A tenancy check must not reach the network.");
  });
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await database.close();
});

type Calls = Record<string, Record<string, () => Promise<unknown>>>;

/** Every growth service function, called by A with B's ids. */
function calls(): Calls {
  const { input, experiment } = seed;
  const projectId = input.projectId;
  const opportunityId = input.proposal.opportunityId;
  const proposalId = input.proposal.id;
  const experimentId = experiment.id;
  const ctx = intruder;
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
  };
}

// Functions without a project boundary of their own: a signed App callback,
// and the brand-term store, which its entry points authorize.
const services: Record<string, Record<string, unknown>> = {
  OpportunityService,
  getTicket: { getTicket },
  ContentBriefService,
  ContentGapService,
  SerpCheckService,
  OpportunityInvestigationService,
  PublishingConnectionService,
  GithubAppService: { ...GithubAppService, handleSetup: undefined },
  MetadataProposalService,
  MetadataExecutionService,
  PublishingRecoveryService,
  GithubIssueService,
  ProposalDraftService,
  ExperimentService,
  MeasurementService,
  MeasurementSettingsService,
  DeploymentSignalService,
  RevertService,
};

async function growthRowCount() {
  let total = 0;
  for (const table of growthTables) {
    const [row] = await db.select({ total: count() }).from(table);
    total += Number(row?.total ?? 0);
  }
  return total;
}

describe(`Growth tenancy real ${database.isPostgres ? "Postgres" : "SQLite"}`, () => {
  it("covers every growth service function", () => {
    const table = calls();
    for (const [name, service] of Object.entries(services))
      expect(new Set(Object.keys(table[name] ?? {})), name).toEqual(
        new Set(
          Object.entries(service)
            .filter(([, value]) => typeof value === "function")
            .map(([key]) => key),
        ),
      );
  });

  it("answers not found to another organization, and changes no row", async () => {
    const before = await growthRowCount();
    for (const [service, functions] of Object.entries(calls()))
      for (const [name, call] of Object.entries(functions))
        await expect(call(), `${service}.${name}`).rejects.toMatchObject({
          code: "NOT_FOUND",
        });
    expect(await growthRowCount()).toBe(before);
  });

  it("keeps project_id on every growth table", () => {
    const missing = growthTables
      .map((table) => getTableConfig(table))
      .filter(
        (config) =>
          !ORGANIZATION_TABLES.has(config.name) &&
          !config.columns.some((column) => column.name === "project_id"),
      )
      .map((config) => config.name);
    expect(missing).toEqual([]);
  });
});
