import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { OpportunityRepository as repo } from "./OpportunityRepository";
import { opportunityRun } from "../services/opportunityTestFixtures";
import {
  listOpportunitiesInputSchema,
  type OpportunityCandidate,
  type OpportunityRun,
} from "@/types/schemas/opportunities";

const database = await vi.hoisted(async () => {
  const { createOpportunityTestDatabase } =
    await import("./opportunityRepositoryTestDb");
  return createOpportunityTestDatabase();
});
const { client } = database;
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
beforeAll(() => database.prepare());
afterAll(() => database.close());

function candidate(
  overrides: Partial<OpportunityCandidate & { identityKey: string }> = {},
) {
  return {
    identityKey: "page-query",
    type: "striking_distance",
    url: "https://example.com/page",
    query: "widgets",
    title: "Improve widgets page",
    explanation: "Ranks near page one",
    recommendedAction: "Review the page",
    searchIntent: "commercial",
    confidence: 0.8,
    effortHours: 2,
    priority: 70,
    commercialScore: 70,
    demandScore: 80,
    visibilityScore: 60,
    difficultyScore: 50,
    effortScore: 90,
    scoreExplanation: "High impressions",
    uncertainty: "No conversion data",
    current: { clicks: 20, impressions: 1000, ctr: 0.02, position: 12 },
    previous: { clicks: 10, impressions: 900, ctr: 0.011, position: 14 },
    ...overrides,
  } satisfies OpportunityCandidate & { identityKey: string };
}

async function setup(): Promise<{ run: OpportunityRun; claimKey: string }> {
  const projectId = crypto.randomUUID();
  await client.execute({
    sql: "INSERT INTO organization (id, name, slug, created_at) VALUES (?, 'test', ?, CURRENT_TIMESTAMP)",
    args: [projectId, `opportunity-test-${projectId}`],
  });
  await client.execute({
    sql: "INSERT INTO projects (id, organization_id, name) VALUES (?, ?, 'test')",
    args: [projectId, projectId],
  });
  const run = opportunityRun({
    id: crypto.randomUUID(),
    projectId,
    siteUrl: "sc-domain:example.com",
    status: "running",
    finishedAt: null,
  });
  const claimKey = `opportunities:${projectId}`;
  await client.execute({
    sql: "INSERT INTO gsc_connections (id, project_id, site_url, organization_id, connected_by_user_id) VALUES (?, ?, ?, ?, 'test')",
    args: [projectId, projectId, run.siteUrl, projectId],
  });
  await client.execute({
    sql: "INSERT INTO data_refresh_claims VALUES (?, ?, ?, ?)",
    args: [claimKey, projectId, run.id, Date.now() + 180_000],
  });
  await repo.startRun(run);
  return { run, claimKey };
}

async function finish(
  input: Awaited<ReturnType<typeof setup>>,
  candidates = [candidate()],
) {
  expect(await repo.completeRun({ ...input, candidates })).toBe(true);
  return (
    await repo.list(
      listOpportunitiesInputSchema.parse({ projectId: input.run.projectId }),
    )
  ).rows[0];
}

function approval(projectId: string, opportunityId: string) {
  return {
    projectId,
    opportunityId,
    expectedVersion: 1,
    actorUserId: "reviewer",
    decision: "approved",
    note: "Worth doing",
    fromStatus: "discovered",
    toStatus: "approved",
    deferredUntil: null,
  } as const;
}

describe(`OpportunityRepository real ${database.isPostgres ? "Postgres" : "SQLite"}`, () => {
  it("atomically completes once and retains separate current and previous evidence", async () => {
    const input = await setup();
    const opportunity = await finish(input);
    const detail = await repo.getDetail(input.run.projectId, opportunity.id);
    expect(
      detail?.evidence.map(({ period, clicks }) => ({ period, clicks })),
    ).toEqual([
      { period: "current", clicks: 20 },
      { period: "previous", clicks: 10 },
    ]);
    expect(await repo.latestRun(input.run.projectId)).toMatchObject({
      status: "completed",
      opportunityCount: 1,
    });
    expect(
      await repo.completeRun({ ...input, candidates: [candidate()] }),
    ).toBe(false);
    expect(
      (await repo.getDetail(input.run.projectId, opportunity.id))?.opportunity
        .version,
    ).toBe(1);
    expect(
      (await repo.getDetail(input.run.projectId, opportunity.id))?.evidence,
    ).toHaveLength(2);
  });

  it("persists the fifty-opportunity boundary without oversized SQL statements", async () => {
    const input = await setup();
    const candidates = Array.from({ length: 50 }, (_, index) =>
      candidate({ identityKey: `candidate-${index}` }),
    );
    await expect(
      repo.completeRun({ ...input, candidates: [...candidates, candidate()] }),
    ).rejects.toThrow("at most 50");
    expect(await repo.completeRun({ ...input, candidates })).toBe(true);
    expect(
      (
        await repo.list(
          listOpportunitiesInputSchema.parse({
            projectId: input.run.projectId,
          }),
        )
      ).total,
    ).toBe(50);
  });

  it("preserves review state and appends evidence on rediscovery", async () => {
    const input = await setup();
    const opportunity = await finish(input);
    await repo.review(approval(input.run.projectId, opportunity.id));
    const next = {
      ...input.run,
      id: crypto.randomUUID(),
      startedAt: "2026-10-15T00:00:00.000Z",
    };
    await client.execute({
      sql: "UPDATE data_refresh_claims SET token = ? WHERE key = ?",
      args: [next.id, input.claimKey],
    });
    await repo.startRun(next);
    await repo.completeRun({
      run: next,
      claimKey: input.claimKey,
      candidates: [candidate({ priority: 90 })],
    });
    const detail = await repo.getDetail(next.projectId, opportunity.id);
    expect(detail?.opportunity).toMatchObject({
      id: opportunity.id,
      status: "approved",
      ownerUserId: "reviewer",
      version: 3,
      priority: 90,
      evidenceRunId: next.id,
    });
    expect(detail?.evidence).toHaveLength(4);
    expect(detail?.decisions).toMatchObject([
      { evidenceRunId: input.run.id, actorUserId: "reviewer" },
    ]);
  });

  it("allows only one competing review and creates no audit for a lost CAS", async () => {
    const input = await setup();
    const opportunity = await finish(input);
    const review = approval(input.run.projectId, opportunity.id);
    const results = await Promise.all([
      repo.review(review),
      repo.review({ ...review, actorUserId: "other-reviewer" }),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const detail = await repo.getDetail(input.run.projectId, opportunity.id);
    expect(detail?.decisions).toHaveLength(1);
    expect(detail?.opportunity.version).toBe(2);
    expect(
      await repo.review({
        ...review,
        expectedVersion: 2,
        fromStatus: "reviewed",
      }),
    ).toBe(false);
    expect(
      (await repo.getDetail(input.run.projectId, opportunity.id))?.decisions,
    ).toHaveLength(1);
  });

  it.each([
    "UPDATE gsc_connections SET site_url = 'sc-domain:changed.com' WHERE project_id = ?",
    "DELETE FROM gsc_connections WHERE project_id = ?",
  ])(
    "blocks stale-property approval without changing state or audit: %s",
    async (query) => {
      const input = await setup();
      const opportunity = await finish(input);
      const before = await repo.getDetail(input.run.projectId, opportunity.id);
      await client.execute({ sql: query, args: [input.run.projectId] });
      const review = approval(input.run.projectId, opportunity.id);
      expect(await repo.review(review)).toBe(false);
      expect(await repo.getDetail(input.run.projectId, opportunity.id)).toEqual(
        before,
      );
      expect(
        await repo.review({
          ...review,
          decision: "reviewed",
          toStatus: "reviewed",
        }),
      ).toBe(true);
    },
  );

  it("scopes resource IDs and run mutations to the project", async () => {
    const own = await setup();
    const foreign = await setup();
    const opportunity = await finish(own);
    expect(
      await repo.getDetail(foreign.run.projectId, opportunity.id),
    ).toBeNull();
    expect(
      await repo.review(approval(foreign.run.projectId, opportunity.id)),
    ).toBe(false);
    expect(
      (
        await repo.list(
          listOpportunitiesInputSchema.parse({
            projectId: foreign.run.projectId,
          }),
        )
      ).total,
    ).toBe(0);
    await repo.setRequestCount(own.run.projectId, foreign.run.id, 99);
    await repo.failRun(own.run.projectId, foreign.run.id, "wrong project");
    expect(await repo.latestRun(foreign.run.projectId)).toMatchObject({
      status: "running",
      requestCount: 3,
    });
    expect(
      await repo.latestRun(own.run.projectId, "sc-domain:other.com"),
    ).toBeNull();
    expect(
      (await repo.listRuns(own.run.projectId)).map(({ id }) => id),
    ).toEqual([own.run.id]);
  });

  it.each([
    [
      "replaced lease",
      "UPDATE data_refresh_claims SET token = 'replacement' WHERE key = ?",
      "claim",
    ],
    [
      "expired lease",
      "UPDATE data_refresh_claims SET next_attempt_at = 0 WHERE key = ?",
      "claim",
    ],
    [
      "foreign organization lease",
      "UPDATE data_refresh_claims SET organization_id = 'opportunity-test-foreign' WHERE key = ?",
      "claim",
    ],
    [
      "changed property",
      "UPDATE gsc_connections SET site_url = 'sc-domain:changed.com' WHERE project_id = ?",
      "project",
    ],
    [
      "archived project",
      "UPDATE projects SET archived_at = '2026-10-01' WHERE id = ?",
      "project",
    ],
  ])(
    "rejects completion after %s without publishing children",
    async (_name, query, key) => {
      const input = await setup();
      await client.execute({
        sql: query,
        args: [key === "claim" ? input.claimKey : input.run.projectId],
      });
      expect(
        await repo.completeRun({ ...input, candidates: [candidate()] }),
      ).toBe(false);
      expect(
        (
          await repo.list(
            listOpportunitiesInputSchema.parse({
              projectId: input.run.projectId,
            }),
          )
        ).total,
      ).toBe(0);
      expect(await repo.latestRun(input.run.projectId)).toMatchObject({
        status: "running",
      });
    },
  );

  it("rolls back the run and opportunities when an evidence insert fails", async () => {
    const input = await setup();
    const removeTrigger = await database.rejectEvidence();
    try {
      await expect(
        repo.completeRun({ ...input, candidates: [candidate()] }),
      ).rejects.toThrow();
    } finally {
      await removeTrigger();
    }
    expect(await repo.latestRun(input.run.projectId)).toMatchObject({
      status: "running",
    });
    expect(
      (
        await repo.list(
          listOpportunitiesInputSchema.parse({
            projectId: input.run.projectId,
          }),
        )
      ).total,
    ).toBe(0);
  });

  it("filters deferred rows before counting and paginating priority order", async () => {
    const input = await setup();
    await finish(input, [
      candidate(),
      candidate({ identityKey: "low", priority: 30 }),
      candidate({ identityKey: "high", priority: 90 }),
    ]);
    const listInput = listOpportunitiesInputSchema.parse({
      projectId: input.run.projectId,
    });
    const first = await repo.list({ ...listInput, limit: 1 });
    expect(first.total).toBe(3);
    expect(first.rows[0].priority).toBe(90);
    await repo.review({
      ...approval(input.run.projectId, first.rows[0].id),
      decision: "deferred",
      toStatus: "discovered",
      deferredUntil: "2099-01-01T00:00:00.000Z",
    });
    expect(
      (await repo.list({ ...listInput, minPriority: 50 })).rows.map(
        ({ priority }) => priority,
      ),
    ).toEqual([70]);
    expect(
      (await repo.list({ ...listInput, includeDeferred: true })).total,
    ).toBe(3);
  });

  it("retires prior running records only within the same project", async () => {
    const input = await setup();
    const foreign = await setup();
    const next = {
      ...input.run,
      id: crypto.randomUUID(),
      startedAt: "2099-01-01T00:00:00.000Z",
    };
    await repo.startRun(next);
    expect(await repo.listRuns(input.run.projectId)).toMatchObject([
      { id: next.id, status: "running" },
      { id: input.run.id, status: "failed" },
    ]);
    expect(await repo.latestRun(foreign.run.projectId)).toMatchObject({
      status: "running",
    });
  });

  it("cascades project deletion through runs, opportunities, evidence and decisions", async () => {
    const input = await setup();
    const opportunity = await finish(input);
    await repo.review(approval(input.run.projectId, opportunity.id));
    await client.execute({
      sql: "DELETE FROM projects WHERE id = ?",
      args: [input.run.projectId],
    });
    expect(await repo.listRuns(input.run.projectId)).toEqual([]);
    expect(
      await repo.getDetail(input.run.projectId, opportunity.id),
    ).toBeNull();
    for (const table of ["opportunity_evidence", "opportunity_decisions"]) {
      const result = await client.execute({
        sql: `SELECT count(*) AS n FROM ${table} WHERE project_id = ?`,
        args: [input.run.projectId],
      });
      expect(Number(result.rows[0].n)).toBe(0);
    }
  });
});
