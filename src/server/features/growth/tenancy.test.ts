import { count } from "drizzle-orm";
import { getTableConfig, SQLiteTable } from "drizzle-orm/sqlite-core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import * as contentBriefsSchema from "@/db/content-briefs.schema";
import * as experimentsSchema from "@/db/experiments.schema";
import * as growthJobsSchema from "@/db/growth-jobs.schema";
import * as measurementGa4Schema from "@/db/measurement-ga4.schema";
import * as opportunitiesSchema from "@/db/opportunities.schema";
import * as contentGapSchema from "@/db/opportunity-content-gap.schema";
import * as investigationsSchema from "@/db/opportunity-investigations.schema";
import * as signalsSchema from "@/db/opportunity-signals.schema";
import * as draftsSchema from "@/db/proposal-drafts.schema";
import * as publishingSchema from "@/db/publishing.schema";
import * as spendSchema from "@/db/spend.schema";
import * as seoChecksSchema from "@/db/seo-checks.schema";
import * as splitTestsSchema from "@/db/split-tests.schema";
import { DeploymentSignalService } from "@/server/features/experiments/DeploymentSignalService";
import { ExperimentService } from "@/server/features/experiments/ExperimentService";
import { MeasurementService } from "@/server/features/experiments/MeasurementService";
import { MeasurementSettingsService } from "@/server/features/experiments/MeasurementSettingsService";
import { RevertService } from "@/server/features/experiments/RevertService";
import { AutomationService } from "./AutomationService";
import { SpendLimitService } from "@/server/features/spend/SpendLimitService";
import { SeoCheckSettingsService } from "@/server/features/seo-checks/SeoCheckSettingsService";
import { SplitTestEndService } from "@/server/features/split-tests/SplitTestEndService";
import { SplitTestPullService } from "@/server/features/split-tests/SplitTestPullService";
import { SplitTestService } from "@/server/features/split-tests/SplitTestService";
import { ConversionDetectionService } from "@/server/features/conversion/ConversionDetectionService";
import { CopyDraftService } from "@/server/features/conversion/CopyDraftService";
import { CopyLocatorService } from "@/server/features/publishing/CopyLocatorService";
import { CopyProposalService } from "@/server/features/publishing/CopyProposalService";
import { ConversionGateService } from "@/server/features/conversion/ConversionGateService";
import { AccessibilityCheckService } from "@/server/features/accessibility/AccessibilityCheckService";
import { AccessibilityFixService } from "@/server/features/accessibility/AccessibilityFixService";
import { AltTextDraftService } from "@/server/features/accessibility/AltTextDraftService";
import { PerformanceFixService } from "@/server/features/performance/PerformanceFixService";
import { PerformanceResultService } from "@/server/features/performance/PerformanceResultService";
import { deployed } from "@/server/features/experiments/repositories/experimentTestFixtures";
import { INTRUDER, tenancyCalls } from "./tenancy-test-calls";
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

// Not project-scoped by design: an App installation serves many projects,
// a webhook delivery id is claimed before its project is known, and an email
// digest preference belongs to a member of the organization.
const UNSCOPED_TABLES = new Set([
  "github_app_installations",
  "ci_webhook_deliveries",
  "growth_email_preferences",
]);
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
  growthJobsSchema,
  spendSchema,
  seoChecksSchema,
  splitTestsSchema,
);

let seed: Awaited<ReturnType<typeof deployed>>;
const intruder = INTRUDER;

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
  AutomationService,
  // The organization view has no project boundary; it reads only its own.
  SpendLimitService: { ...SpendLimitService, organization: undefined },
  SeoCheckSettingsService,
  SplitTestService,
  SplitTestPullService,
  SplitTestEndService,
  ConversionGateService,
  ConversionDetectionService,
  CopyLocatorService,
  CopyProposalService,
  CopyDraftService,
  AccessibilityFixService,
  AltTextDraftService,
  AccessibilityCheckService,
  PerformanceResultService,
  PerformanceFixService,
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
    const table = tenancyCalls(seed, intruder);
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
    for (const [service, functions] of Object.entries(
      tenancyCalls(seed, intruder),
    ))
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
          !UNSCOPED_TABLES.has(config.name) &&
          !config.columns.some((column) => column.name === "project_id"),
      )
      .map((config) => config.name);
    expect(missing).toEqual([]);
  });
});
