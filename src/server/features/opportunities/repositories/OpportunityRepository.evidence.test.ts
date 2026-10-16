import { sort } from "remeda";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { OpportunityRepository as repo } from "./OpportunityRepository";
import {
  candidate,
  finishRun as finish,
  pairCandidate,
  setupRun,
} from "./opportunityRepositoryTestSupport";

const database = await vi.hoisted(async () => {
  const { createOpportunityTestDatabase } =
    await import("./opportunityRepositoryTestDb");
  // Its own cleanup prefix, so parallel Postgres test files keep their rows.
  return createOpportunityTestDatabase("opportunity-evidence-test-");
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
const setup = () => setupRun(client, "opportunity-evidence-test-");

describe(`Opportunity evidence kinds real ${database.isPostgres ? "Postgres" : "SQLite"}`, () => {
  it("stores per-URL evidence, URL roles and GA4 rows, and replaces roles on refresh", async () => {
    const input = await setup();
    const opportunity = await finish(input, [pairCandidate()]);
    const detail = await repo.getDetail(input.run.projectId, opportunity.id);
    expect(
      sort(
        detail?.evidence.map(({ url, query }) => [url, query]) ?? [],
        (a, b) => (a.join() < b.join() ? -1 : 1),
      ),
    ).toEqual([
      ["", ""],
      ["https://example.com/a", "widgets"],
      ["https://example.com/b", "widgets"],
    ]);
    expect(detail?.ga4Evidence).toMatchObject([
      { period: "current", landingPage: "/a", keyEvents: 3, currency: "USD" },
    ]);
    const next = { ...input.run, id: crypto.randomUUID() };
    await client.execute({
      sql: "UPDATE data_refresh_claims SET token = ? WHERE key = ?",
      args: [next.id, input.claimKey],
    });
    await repo.startRun(next);
    expect(
      await repo.completeRun({
        run: next,
        claimKey: input.claimKey,
        candidates: [
          pairCandidate("https://example.com/b", "https://example.com/a"),
        ],
      }),
    ).toBe(true);
    expect(
      (await repo.getDetail(input.run.projectId, opportunity.id))?.urls.map(
        ({ url, role }) => [role, url],
      ),
    ).toEqual([
      ["competing", "https://example.com/a"],
      ["primary", "https://example.com/b"],
    ]);
  });

  it("dates year-ago evidence 364 days before each window", async () => {
    const input = await setup();
    const metrics = { clicks: 50, impressions: 900, ctr: 0.0556, position: 4 };
    const opportunity = await finish(input, [
      candidate({
        evidence: [
          { period: "year_ago", url: "", query: "", metrics },
          { period: "year_ago_previous", url: "", query: "", metrics },
        ],
      }),
    ]);
    const detail = await repo.getDetail(input.run.projectId, opportunity.id);
    expect(
      sort(
        detail?.evidence.map(({ period, startDate, endDate }) => [
          period,
          startDate,
          endDate,
        ]) ?? [],
        (a, b) => (a.join() < b.join() ? -1 : 1),
      ),
    ).toEqual([
      ["year_ago", "2025-09-14", "2025-10-11"],
      ["year_ago_previous", "2025-08-17", "2025-09-13"],
    ]);
  });
});
