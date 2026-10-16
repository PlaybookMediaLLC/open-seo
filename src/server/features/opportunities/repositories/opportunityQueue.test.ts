import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  listOpportunitiesInputSchema,
  type OpportunityRun,
} from "@/types/schemas/opportunities";
import { OpportunityRepository as repo } from "./OpportunityRepository";
import { candidate, setupRun } from "./opportunityRepositoryTestSupport";

const PREFIX = "opportunity-queue-test-";
const database = await vi.hoisted(async () => {
  const { createOpportunityTestDatabase } =
    await import("./opportunityRepositoryTestDb");
  // Its own cleanup prefix, so parallel Postgres test files keep their rows.
  return createOpportunityTestDatabase("opportunity-queue-test-");
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

const list = (projectId: string, filters: Record<string, unknown> = {}) =>
  repo.list(listOpportunitiesInputSchema.parse({ projectId, ...filters }));

const stale = (rows: Awaited<ReturnType<typeof list>>["rows"]) =>
  Object.fromEntries(rows.map((row) => [row.identityKey, row.stale]));

/** Runs detection again with a new claim token and the given candidates. */
async function rerun(
  first: { run: OpportunityRun; claimKey: string },
  identityKeys: string[],
  kind: OpportunityRun["kind"] = "search_console",
) {
  const run = {
    ...first.run,
    id: crypto.randomUUID(),
    kind,
    startedAt: new Date().toISOString(),
    status: "running" as const,
  };
  await client.execute({
    sql: "UPDATE data_refresh_claims SET token = ? WHERE key = ?",
    args: [run.id, first.claimKey],
  });
  await repo.startRun(run);
  expect(
    await repo.completeRun({
      run: { ...run, finishedAt: new Date().toISOString() },
      claimKey: first.claimKey,
      candidates: identityKeys.map((identityKey) => candidate({ identityKey })),
    }),
  ).toBe(true);
}

describe(`Opportunity queue real ${database.isPostgres ? "Postgres" : "SQLite"}`, () => {
  it("flags items that the latest run of the same kind did not find again", async () => {
    const first = await setupRun(client, PREFIX);
    const { projectId } = first.run;
    expect(
      await repo.completeRun({
        ...first,
        candidates: [
          candidate({ identityKey: "kept" }),
          candidate({ identityKey: "gone" }),
        ],
      }),
    ).toBe(true);
    await rerun(first, ["kept"]);
    expect(stale((await list(projectId)).rows)).toEqual({
      kept: false,
      gone: true,
    });
    expect(
      (await list(projectId, { freshness: "stale" })).rows.map(
        (row) => row.identityKey,
      ),
    ).toEqual(["gone"]);
    // A content-gap run never makes a Search Console item stale.
    await rerun(first, [], "content_gap");
    expect(
      (await list(projectId, { freshness: "current" })).rows.map(
        (row) => row.identityKey,
      ),
    ).toEqual(["kept"]);
    await rerun(first, ["kept", "gone"]);
    expect((await list(projectId, { freshness: "stale" })).total).toBe(0);
    const [detail] = (await list(projectId)).rows;
    expect(
      (await repo.getDetail(projectId, detail.id))?.opportunity.stale,
    ).toBe(false);
  });

  it("searches URLs and queries case-insensitively, with % and _ as literals", async () => {
    const input = await setupRun(client, PREFIX);
    const { projectId } = input.run;
    await repo.completeRun({
      ...input,
      candidates: [
        candidate({ identityKey: "a", url: "https://example.com/50%-off" }),
        candidate({ identityKey: "b", url: "https://example.com/500-off" }),
        candidate({
          identityKey: "c",
          url: "https://example.com/x",
          query: "a_b Pricing",
        }),
        candidate({
          identityKey: "d",
          url: "https://example.com/y",
          query: "axb pricing",
        }),
      ],
    });
    const keys = async (q: string) =>
      (await list(projectId, { q })).rows.map((row) => row.identityKey).sort();
    expect(await keys("50%")).toEqual(["a"]);
    expect(await keys("A_B")).toEqual(["c"]);
    expect(await keys("PRICING")).toEqual(["c", "d"]);
  });

  it("filters by owner and counts each status with the other filters", async () => {
    const input = await setupRun(client, PREFIX);
    const { projectId } = input.run;
    await repo.completeRun({
      ...input,
      candidates: ["one", "two", "three"].map((identityKey) =>
        candidate({ identityKey }),
      ),
    });
    const { rows } = await list(projectId);
    const [first, second] = rows;
    expect(
      await repo.review({
        projectId,
        opportunityId: first.id,
        expectedVersion: 1,
        actorUserId: "reviewer",
        decision: "assigned",
        ownerUserId: "user-2",
        note: "Assigned to Ada",
        fromStatus: "discovered",
        toStatus: "discovered",
        deferredUntil: null,
      }),
    ).toBe(true);
    await repo.review({
      projectId,
      opportunityId: second.id,
      expectedVersion: 1,
      actorUserId: "reviewer",
      decision: "reviewed",
      note: "",
      fromStatus: "discovered",
      toStatus: "reviewed",
      deferredUntil: null,
    });
    expect((await list(projectId, { owner: "user-2" })).rows).toMatchObject([
      { id: first.id, ownerUserId: "user-2", status: "discovered", version: 2 },
    ]);
    expect((await list(projectId, { owner: "unassigned" })).total).toBe(2);
    const all = await list(projectId);
    expect(all.statusCounts).toEqual({ discovered: 2, reviewed: 1 });
    for (const status of ["discovered", "reviewed"] as const)
      expect((await list(projectId, { status })).total).toBe(
        all.statusCounts[status],
      );
    expect(
      (await list(projectId, { status: "reviewed", owner: "user-2" }))
        .statusCounts,
    ).toEqual({ discovered: 1 });
    // A stale version loses: the assignment changed the version.
    expect(
      await repo.review({
        projectId,
        opportunityId: first.id,
        expectedVersion: 1,
        actorUserId: "other",
        decision: "assigned",
        ownerUserId: null,
        note: "Unassigned",
        fromStatus: "discovered",
        toStatus: "discovered",
        deferredUntil: null,
      }),
    ).toBe(false);
  });

  it("keeps a deferral when the owner changes", async () => {
    const input = await setupRun(client, PREFIX);
    const { projectId } = input.run;
    await repo.completeRun({ ...input, candidates: [candidate()] });
    const [row] = (await list(projectId)).rows;
    const until = "2099-01-01T00:00:00.000Z";
    await repo.review({
      projectId,
      opportunityId: row.id,
      expectedVersion: 1,
      actorUserId: "reviewer",
      decision: "deferred",
      note: "",
      fromStatus: "discovered",
      toStatus: "discovered",
      deferredUntil: until,
    });
    await repo.review({
      projectId,
      opportunityId: row.id,
      expectedVersion: 2,
      actorUserId: "reviewer",
      decision: "assigned",
      ownerUserId: "user-2",
      note: "Assigned to Ada",
      fromStatus: "discovered",
      toStatus: "discovered",
      deferredUntil: null,
    });
    expect(
      (await repo.getDetail(projectId, row.id))?.opportunity,
    ).toMatchObject({ deferredUntil: until, ownerUserId: "user-2" });
    expect((await list(projectId)).total).toBe(0);
    expect((await list(projectId, { includeDeferred: true })).total).toBe(1);
  });
});
