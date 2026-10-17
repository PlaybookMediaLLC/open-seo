import { symmetricEncrypt } from "better-auth/crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { DataRefreshClaimRepository } from "@/server/features/dashboard/repositories/DataRefreshClaimRepository";
import { shiftGa4Date } from "@/server/features/ga4/services/Ga4Dates";
import { PublishingConnectionService } from "@/server/features/publishing/PublishingConnectionService";
import { gitBlobHash } from "@/server/features/publishing/proposalFingerprint";
import {
  publishingTestSecret,
  publishingTestToken,
} from "@/server/features/publishing/publishing-test-fixtures";
import { PublishingRepository } from "@/server/features/publishing/repositories/PublishingRepository";
import { ExperimentService } from "./ExperimentService";
import { MeasurementService } from "./MeasurementService";
import { succeededExecution } from "./repositories/experimentTestFixtures";

// The database must exist before hoisted module mocks wire real repositories to it.
const database = await vi.hoisted(async () => {
  const { createExperimentTestDatabase } =
    await import("./repositories/experimentTestDb");
  return createExperimentTestDatabase();
});
const mocks = vi.hoisted(() => ({
  getConnection: vi.fn(),
  getPerformance: vi.fn(),
}));
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
vi.mock("@/server/features/gsc/services/GscService", () => ({
  GscService: mocks,
}));
// No GA4 property here; GA4 measurement has its own tests.
vi.mock("@/server/features/ga4/repositories/Ga4ConnectionRepository", () => ({
  Ga4ConnectionRepository: { getByProjectId: async () => null },
}));

const transport = vi.fn<typeof fetch>();
const afterSource =
  'export const metadata = { description: "New description" };\n';
const headSha = "b".repeat(40);
const mergeSha = "c".repeat(40);
const rootTree = "d".repeat(40);
const appTree = "e".repeat(40);
const context = { userId: "reviewer", role: "owner" };
const identity = {
  id: 123,
  name: "site",
  full_name: "owner/site",
  owner: { login: "owner" },
};
let seed: Awaited<ReturnType<typeof succeededExecution>>;
let merged = false;
let mergedSource = afterSource;

beforeAll(async () => {
  await database.prepare();
  if (!database.isPostgres) {
    // Complete the harness's minimal project projection for the real org gate.
    await database.client.executeMultiple(`
      ALTER TABLE projects ADD COLUMN domain TEXT;
      ALTER TABLE projects ADD COLUMN location_code INTEGER DEFAULT 2840;
      ALTER TABLE projects ADD COLUMN language_code TEXT DEFAULT 'en';
      ALTER TABLE projects ADD COLUMN created_at TEXT;
      ALTER TABLE projects ADD COLUMN ai_research_keywords TEXT;
    `);
  }
});
afterAll(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await database.close();
});

beforeEach(async () => {
  merged = false;
  mergedSource = afterSource;
  seed = await succeededExecution(database);
  const afterBlob = await gitBlobHash(afterSource);
  // Pin the succeeded execution to real-format SHAs the GitHub client validates.
  await database.client.execute({
    sql: "UPDATE proposal_executions SET commit_sha = ? WHERE id = ?",
    args: [headSha, seed.executionId],
  });
  await database.client.execute({
    sql: "UPDATE opportunity_proposals SET after_blob_sha = ? WHERE id = ?",
    args: [afterBlob, seed.proposal.id],
  });
  // Replace the fixture connection with a decryptable token for the same repository.
  expect(
    await PublishingRepository.replaceConnection({
      ...seed,
      connection: {
        ...seed.connection,
        id: crypto.randomUUID(),
        encryptedToken: await symmetricEncrypt({
          key: publishingTestSecret,
          data: publishingTestToken,
        }),
      },
    }),
  ).toBe(true);
  await DataRefreshClaimRepository.finish(
    `publishing:${seed.projectId}`,
    seed.claimToken,
    0,
  );
  vi.stubEnv("BETTER_AUTH_SECRET", publishingTestSecret);
  vi.stubGlobal("fetch", transport);
  mocks.getConnection.mockResolvedValue({ siteUrl: seed.siteUrl });
  mocks.getPerformance.mockImplementation(
    (input: { startDate: string; endDate: string }) => {
      const rows = [];
      for (
        let date = input.startDate;
        date <= input.endDate;
        date = shiftGa4Date(date, 1)
      ) {
        const observed = date > shiftGa4Date(input.startDate, 34);
        rows.push({
          keys: [date],
          clicks: observed ? 8 : 5,
          impressions: 50,
          ctr: observed ? 0.16 : 0.1,
          position: 9,
        });
      }
      return Promise.resolve({ siteUrl: seed.siteUrl, request: input, rows });
    },
  );
  transport.mockImplementation(async (input, options) => {
    const mergedBlob = await gitBlobHash(mergedSource);
    const url = new URL(input instanceof Request ? input.url : String(input));
    expect(url.origin).toBe("https://api.github.com");
    expect(options?.method ?? "GET").toBe("GET");
    const route = url.pathname.replace("/repos/owner/site", "");
    if (route === "")
      return Response.json({
        ...identity,
        default_branch: "main",
        private: true,
        archived: false,
        permissions: { push: true },
      });
    if (route === "/pulls/42")
      return Response.json({
        number: 42,
        html_url: "https://github.com/owner/site/pull/42",
        state: merged ? "closed" : "open",
        merged,
        merged_at: merged ? mergedAt() : null,
        merge_commit_sha: merged ? mergeSha : null,
        body: "",
        head: {
          ref: `openseo/${seed.proposal.id}`,
          sha: headSha,
          repo: identity,
        },
        base: { ref: "main", sha: "a".repeat(40), repo: identity },
      });
    if (route === `/git/commits/${mergeSha}`)
      return Response.json({
        sha: mergeSha,
        tree: { sha: rootTree },
        parents: [{ sha: headSha }],
      });
    if (route === `/git/trees/${rootTree}`)
      return Response.json({
        sha: rootTree,
        truncated: false,
        tree: [{ path: "app", mode: "040000", type: "tree", sha: appTree }],
      });
    if (route === `/git/trees/${appTree}`)
      return Response.json({
        sha: appTree,
        truncated: false,
        tree: [
          { path: "page.tsx", mode: "100644", type: "blob", sha: mergedBlob },
        ],
      });
    if (route === `/git/blobs/${mergedBlob}`)
      return Response.json({
        sha: mergedBlob,
        encoding: "base64",
        content: Buffer.from(mergedSource).toString("base64"),
        size: Buffer.byteLength(mergedSource),
      });
    throw new Error(`Unexpected mocked GitHub route: ${route}`);
  });
});

function mergedAt() {
  return new Date(Date.now() - 46 * 86_400_000).toISOString();
}

async function experiment() {
  const ctx = { ...context, organizationId: seed.organizationId };
  const result = await ExperimentService.register(ctx, {
    projectId: seed.projectId,
    executionId: seed.executionId,
  });
  expect(result.ok, result.message).toBe(true);
  return { ctx, experimentId: result.experimentId! };
}

function attest(
  ctx: Awaited<ReturnType<typeof experiment>>["ctx"],
  experimentId: string,
  deployedAt: string,
) {
  return ExperimentService.confirmDeployment(ctx, {
    projectId: seed.projectId,
    experimentId,
    deployedAt,
    note: "Checked the live page source.",
    confirmProductionDeployment: true,
    otherChanges: false,
    seasonalRisk: false,
  });
}

it(`registers, verifies the merge, records deployment and measures once through real ${database.isPostgres ? "Postgres" : "SQLite"} repositories`, async () => {
  const { ctx, experimentId } = await experiment();
  expect(transport).not.toHaveBeenCalled();
  expect(mocks.getPerformance).not.toHaveBeenCalled();
  const again = await ExperimentService.register(ctx, {
    projectId: seed.projectId,
    executionId: seed.executionId,
  });
  expect(again).toMatchObject({ ok: true, experimentId });

  const early = await MeasurementService.refresh(ctx, {
    projectId: seed.projectId,
    experimentId,
  });
  expect(early.ok).toBe(false);

  const open = await ExperimentService.refreshPull(ctx, {
    projectId: seed.projectId,
    experimentId,
  });
  expect(open.message).toContain("open");
  const deployedAt = new Date(Date.now() - 45 * 86_400_000).toISOString();
  expect((await attest(ctx, experimentId, deployedAt)).ok).toBe(false);

  merged = true;
  const done = await attest(ctx, experimentId, deployedAt);
  expect(done.ok, done.message).toBe(true);
  expect((await attest(ctx, experimentId, deployedAt)).ok).toBe(false);

  // Measurement must not depend on GitHub after deployment is attested.
  const disconnected = await PublishingConnectionService.disconnect(
    ctx,
    seed.projectId,
  );
  expect(disconnected.ok, disconnected.message).toBe(true);
  const githubCalls = transport.mock.calls.length;

  const measured = await MeasurementService.refresh(ctx, {
    projectId: seed.projectId,
    experimentId,
  });
  expect(measured.ok, measured.message).toBe(true);
  expect(mocks.getPerformance).toHaveBeenCalledTimes(1);
  const detail = await ExperimentService.get(ctx, {
    projectId: seed.projectId,
    experimentId,
  });
  const { baselineStart, baselineEnd, observationStart, observationEnd } =
    detail.experiment;
  expect(mocks.getPerformance.mock.calls[0][0]).toMatchObject({
    projectId: seed.projectId,
    startDate: baselineStart,
    endDate: observationEnd,
    dimensions: ["date"],
    filters: [
      {
        dimension: "page",
        operator: "equals",
        expression: seed.proposal.targetUrl,
      },
    ],
    rowLimit: 100,
    type: "web",
    dataState: "final",
  });
  expect(shiftGa4Date(baselineEnd!, 8)).toBe(observationStart);
  expect(detail.baselineDays).toHaveLength(28);
  expect(detail.observationDays).toHaveLength(28);
  expect(detail.githubConnected).toBe(false);
  expect(detail.assessment).toMatchObject({
    outcome: "encouraging",
    clickChange: 84,
    baseline: { clicks: 140, impressions: 1400, reportedDays: 28 },
  });
  expect(detail.assessment.explanation).toContain(
    "not a statistical or causal",
  );

  const cached = await MeasurementService.refresh(ctx, {
    projectId: seed.projectId,
    experimentId,
  });
  expect(cached).toMatchObject({ ok: true });
  expect(cached.message).toContain("No Google request");
  expect(mocks.getPerformance).toHaveBeenCalledTimes(1);
  expect(transport).toHaveBeenCalledTimes(githubCalls);
  expect(JSON.stringify(detail)).not.toContain(publishingTestToken);
});

it("rejects a merged file that differs from the approved change", async () => {
  const { ctx, experimentId } = await experiment();
  merged = true;
  mergedSource = "tampered\n";
  const result = await ExperimentService.refreshPull(ctx, {
    projectId: seed.projectId,
    experimentId,
  });
  expect(result.ok).toBe(false);
  // The rejection must come from comparing the merged blob, not an earlier guard.
  expect(transport.mock.calls.at(-1)?.[0]).toBe(
    `https://api.github.com/repos/owner/site/git/blobs/${await gitBlobHash(mergedSource)}`,
  );
  const detail = await ExperimentService.get(ctx, {
    projectId: seed.projectId,
    experimentId,
  });
  expect(detail.experiment.pullRequestState).toBe("unknown");
  expect(detail.experiment.mergeCommitSha).toBeNull();
});

it("denies deployment attestation to members and hides experiments from other organizations", async () => {
  const { ctx, experimentId } = await experiment();
  merged = true;
  await expect(
    attest({ ...ctx, role: "member" }, experimentId, new Date().toISOString()),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    MeasurementService.refresh(
      { ...ctx, role: "member" },
      { projectId: seed.projectId, experimentId },
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  const listed = await ExperimentService.list(
    { ...ctx, role: "member" },
    { projectId: seed.projectId, limit: 50, offset: 0 },
  );
  expect(listed).toMatchObject({ total: 1, canManage: false });
  await expect(
    ExperimentService.get(
      { ...ctx, organizationId: "opportunity-test-foreign" },
      { projectId: seed.projectId, experimentId },
    ),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(transport).not.toHaveBeenCalled();
});

async function deployedExperiment(daysAgo: number) {
  const { ctx, experimentId } = await experiment();
  merged = true;
  const at = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
  const done = await attest(ctx, experimentId, at);
  expect(done.ok, done.message).toBe(true);
  return { ctx, experimentId };
}

it("makes no Google request for a too-recent baseline, a changed property or a busy project lease", async () => {
  const { ctx, experimentId } = await deployedExperiment(1);
  const input = { projectId: seed.projectId, experimentId };
  expect((await MeasurementService.refresh(ctx, input)).message).toContain(
    "not yet old enough",
  );
  mocks.getConnection.mockResolvedValue({ siteUrl: "sc-domain:other.com" });
  expect((await MeasurementService.refresh(ctx, input)).message).toContain(
    "original Search Console property",
  );
  mocks.getConnection.mockResolvedValue({ siteUrl: seed.siteUrl });
  const lease = await DataRefreshClaimRepository.claim(
    `publishing:${seed.projectId}`,
    seed.organizationId,
  );
  expect(lease).toBeTruthy();
  expect((await MeasurementService.refresh(ctx, input)).ok).toBe(false);
  expect(mocks.getPerformance).not.toHaveBeenCalled();
  expect((await ExperimentService.get(ctx, input)).runs).toEqual([]);
});

it("records a sanitized failed run without a baseline when Google answers for another property", async () => {
  const { ctx, experimentId } = await deployedExperiment(45);
  mocks.getPerformance.mockResolvedValueOnce({
    siteUrl: "sc-domain:other.com",
    request: {},
    rows: [],
  });
  const input = { projectId: seed.projectId, experimentId };
  const result = await MeasurementService.refresh(ctx, input);
  expect(result.ok).toBe(false);
  expect(mocks.getPerformance).toHaveBeenCalledTimes(1);
  const detail = await ExperimentService.get(ctx, input);
  expect(detail.runs).toHaveLength(1);
  expect(detail.runs[0]).toMatchObject({
    status: "failed",
    error: result.message,
  });
  expect(detail.experiment.baselineRunId).toBeNull();
  expect(detail.latestRun).toBeNull();
  // The five-minute cooldown blocks an immediate retry before any provider work.
  expect((await MeasurementService.refresh(ctx, input)).ok).toBe(false);
  expect(mocks.getPerformance).toHaveBeenCalledTimes(1);
});
