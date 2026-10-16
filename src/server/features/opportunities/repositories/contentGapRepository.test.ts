import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ContentGapRepository as gaps } from "./contentGapRepository";
import { OpportunityRepository as repo } from "./OpportunityRepository";
import {
  candidate,
  finishRun,
  setupRun,
} from "./opportunityRepositoryTestSupport";

const PREFIX = "content-gap-test-";
const database = await vi.hoisted(async () => {
  const { createOpportunityTestDatabase } =
    await import("./opportunityRepositoryTestDb");
  // Its own cleanup prefix, so parallel Postgres test files keep their rows.
  return createOpportunityTestDatabase("content-gap-test-");
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

const run = (sql: string, args: Array<string | number | null>) =>
  client.execute({ sql, args });
const daysAgo = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString();
const market = { locationCode: 2840, languageCode: "en" };
const row = (keyword: string) => ({
  keyword,
  position: 3,
  url: "https://rival.com/crm",
  searchVolume: 120,
  keywordDifficulty: 30,
  intent: "commercial",
});

describe(`Content gap data real ${database.isPostgres ? "Postgres" : "SQLite"}`, () => {
  it("saves a paid fetch and reuses the newest snapshot of the project and market", async () => {
    const { run: own } = await setupRun(client, PREFIX);
    const { run: other } = await setupRun(client, PREFIX);
    const save = (projectId: string, fetchedAt: string, keyword: string) =>
      gaps.saveSnapshot({
        projectId,
        domain: "rival.com",
        market,
        fetchedAt,
        estimatedCredits: 30,
        rows: [row(keyword)],
      });
    await save(own.projectId, daysAgo(40), "old");
    await save(own.projectId, daysAgo(10), "older");
    const newest = await save(own.projectId, daysAgo(2), "crm pricing");
    await save(other.projectId, daysAgo(1), "foreign");
    const fresh = await gaps.freshSnapshots(
      own.projectId,
      ["rival.com", "unknown.com"],
      market,
      daysAgo(30),
    );
    expect(fresh).toEqual(new Map([["rival.com", newest]]));
    expect(
      await gaps.freshSnapshots(
        own.projectId,
        ["rival.com"],
        { ...market, languageCode: "de" },
        daysAgo(30),
      ),
    ).toEqual(new Map());
    expect(await gaps.snapshotKeywords(own.projectId, [newest])).toMatchObject([
      {
        keyword: "crm pricing",
        competitorDomain: "rival.com",
        competitorPosition: 3,
        searchVolume: 120,
        intent: "commercial",
      },
    ]);
    expect(await gaps.snapshotKeywords(other.projectId, [newest])).toEqual([]);
  });

  it("counts AI answers that cite each page, for the project's busiest tracker", async () => {
    const { run: own } = await setupRun(client, PREFIX);
    const tracker = `tracker-${own.projectId}`;
    await run(
      "INSERT INTO ai_trackers (id, project_id, created_at) VALUES (?, ?, ?)",
      [tracker, own.projectId, daysAgo(60)],
    );
    await run(
      "INSERT INTO ai_prompts (id, tracker_id, topic, text, created_at) VALUES (?, ?, 'crm', 'best crm', ?)",
      [`prompt-${tracker}`, tracker, daysAgo(60)],
    );
    for (const [index, createdAt] of [daysAgo(3), daysAgo(40)].entries()) {
      const runId = `ai-run-${index}-${tracker}`;
      await run(
        "INSERT INTO ai_runs (id, tracker_id, project_id, trigger, status, location_code, language_code, created_at) VALUES (?, ?, ?, 'manual', 'completed', 2840, 'en', ?)",
        [runId, tracker, own.projectId, createdAt],
      );
      // One answer per run, prompt and engine.
      for (const [observation, engine] of [
        ["a", "chatgpt"],
        ["b", "gemini"],
      ]) {
        const id = `${runId}-${observation}`;
        await run(
          "INSERT INTO ai_observations (id, run_id, prompt_id, engine, branded, status) VALUES (?, ?, ?, ?, FALSE, 'completed')",
          [id, runId, `prompt-${tracker}`, engine],
        );
        if (observation === "a")
          for (const url of [
            "https://example.com/pricing/",
            "https://example.com/pricing",
          ])
            await run(
              "INSERT INTO ai_sources (id, observation_id, url, domain, position) VALUES (?, ?, ?, 'example.com', 1)",
              [crypto.randomUUID(), id, url],
            );
      }
    }
    const result = await gaps.aiCitations(own.projectId, daysAgo(30));
    expect(result).toMatchObject({ trackerId: tracker, answers: 2 });
    expect(result!.citations).toEqual(
      new Map([["https://example.com/pricing", 1]]),
    );
    const { run: empty } = await setupRun(client, PREFIX);
    expect(await gaps.aiCitations(empty.projectId, daysAgo(30))).toBeNull();
  });

  it("stores keyword and AI evidence, and applies a live results check", async () => {
    const input = await setupRun(client, PREFIX);
    const { projectId } = input.run;
    const opportunity = await finishRun(input, [
      candidate({
        type: "low_ctr",
        url: "https://example.com/pricing",
        keywords: [
          {
            keyword: "crm pricing",
            ...market,
            searchVolume: 120,
            keywordDifficulty: 30,
            intent: "commercial",
            competitorDomain: "rival.com",
            competitorUrl: null,
            competitorPosition: 3,
            fetchedAt: daysAgo(1),
          },
        ],
        ai: {
          trackerId: "tracker-1",
          citations: 2,
          answers: 9,
          periodStart: daysAgo(30),
          periodEnd: daysAgo(0),
        },
      }),
    ]);
    const check = {
      id: crypto.randomUUID(),
      opportunityId: opportunity.id,
      keyword: "crm pricing",
      pagePosition: 3,
      hasAds: true,
      hasAiOverview: false,
      hasFeaturedSnippet: false,
      confidenceDelta: -0.15,
      estimatedCredits: 2,
      checkedAt: daysAgo(0),
    };
    await gaps.saveSerpCheck(projectId, check, {
      confidence: 0.4,
      priority: 31,
      scoreExplanation: "Checked",
    });
    expect(await repo.getDetail(projectId, opportunity.id)).toMatchObject({
      opportunity: { confidence: 0.4, priority: 31 },
      keywordEvidence: [{ keyword: "crm pricing", competitorPosition: 3 }],
      aiEvidence: [{ citations: 2, answers: 9 }],
      serpChecks: [{ hasAds: true, confidenceDelta: -0.15 }],
    });
    const checks = await gaps.recentSerpChecks(projectId, daysAgo(1));
    expect([...checks.keys()]).toEqual(["https://example.com/pricing"]);
    expect(checks.get("https://example.com/pricing")).toMatchObject({
      value: -0.15,
    });
    expect(checks.get("https://example.com/pricing")!.reason).toContain("ads");
    const { run: foreign } = await setupRun(client, PREFIX);
    expect(await gaps.evidenceFor(foreign.projectId, opportunity.id)).toEqual({
      keywordEvidence: [],
      aiEvidence: [],
      serpChecks: [],
    });
  });

  it("keeps a running Search Console run when a content-gap run starts", async () => {
    const input = await setupRun(client, PREFIX);
    await repo.startRun({
      ...input.run,
      id: crypto.randomUUID(),
      kind: "content_gap",
    });
    expect(
      await repo.latestRun(input.run.projectId, undefined, "search_console"),
    ).toMatchObject({ id: input.run.id, status: "running" });
  });
});
