import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { setupRun } from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { loadPerformanceSignals } from "./performanceSignals";

// RFC-0014 5.3 and 5.4: the newest field data per target, and the causes in
// the newest audit's stored Lighthouse reports.
const database = await vi.hoisted(async () => {
  const { createOpportunityTestDatabase } =
    await import("@/server/features/opportunities/repositories/opportunityRepositoryTestDb");
  return createOpportunityTestDatabase("performance-signals-test-");
});
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
const metric = { score: null, displayValue: null, numericValue: null };
vi.mock("@/server/lib/r2", () => ({
  getJsonFromR2: async () =>
    JSON.stringify({
      version: 2,
      source: "dataforseo-lighthouse",
      hasIssueDetails: true,
      metadata: {
        requestedUrl: "https://example.com/",
        finalUrl: "https://example.com/",
        strategy: "mobile",
        fetchedAt: "2026-10-18T00:00:00.000Z",
        lighthouseVersion: "13.0.0",
        taskId: null,
        cost: null,
      },
      scores: {
        performance: 61,
        accessibility: null,
        "best-practices": null,
        seo: null,
      },
      metrics: Object.fromEntries(
        [
          "firstContentfulPaint",
          "largestContentfulPaint",
          "totalBlockingTime",
          "cumulativeLayoutShift",
          "speedIndex",
          "timeToInteractive",
          "interactionToNextPaint",
          "serverResponseTime",
        ].map((name) => [name, metric]),
      ),
      issues: [
        {
          category: "performance",
          auditKey: "render-blocking-insight",
          title: "Render blocking requests",
          description: "",
          score: 0,
          scoreDisplayMode: "metricSavings",
          displayValue: null,
          impactMs: 900,
          impactBytes: null,
          severity: "critical",
          items: [],
        },
      ],
    }),
}));
beforeAll(async () => {
  await database.prepare();
  if (!database.isPostgres)
    // The real tables: the audit start time and the Lighthouse results.
    await database.client.executeMultiple(`
      ALTER TABLE audits ADD COLUMN started_at TEXT NOT NULL DEFAULT '2026-10-18T00:00:00.000Z';
      CREATE TABLE audit_lighthouse_results (id TEXT PRIMARY KEY, audit_id TEXT NOT NULL, page_id TEXT NOT NULL, strategy TEXT NOT NULL, lcp_ms REAL, inp_ms REAL, cls REAL, r2_key TEXT);
    `);
});
afterAll(() => database.close());

it("keeps the newest week per target and reads causes from the report", async () => {
  const { run } = await setupRun(database.client, "performance-signals-test-");
  const exec = (sql: string, args: Array<string | number | null>) =>
    database.client.execute({ sql, args });
  for (const [end, lcp] of [
    ["2026-10-10", 4_000],
    ["2026-10-17", 3_100],
  ] as const)
    await exec(
      "INSERT INTO cwv_snapshots (id, project_id, scope, target, form_factor, collection_end, lcp_p75_ms, source, fetched_at) VALUES (?, ?, 'url', 'https://example.com/', 'phone', ?, ?, 'crux', ?)",
      [crypto.randomUUID(), run.projectId, end, lcp, `${end}T05:00:00.000Z`],
    );
  const [auditId, pageId] = [crypto.randomUUID(), crypto.randomUUID()];
  await exec(
    "INSERT INTO audits (id, project_id, started_by_user_id, start_url, status, started_at) VALUES (?, ?, 'owner', 'https://example.com/', 'completed', ?)",
    [auditId, run.projectId, "2026-10-18T00:00:00.000Z"],
  );
  await exec(
    "INSERT INTO audit_pages (id, audit_id, url, status_code) VALUES (?, ?, 'https://example.com/', 200)",
    [pageId, auditId],
  );
  await exec(
    "INSERT INTO audit_lighthouse_results (id, audit_id, page_id, strategy, lcp_ms, r2_key) VALUES (?, ?, ?, 'mobile', 3700, 'report.json')",
    [crypto.randomUUID(), auditId, pageId],
  );
  const signals = await loadPerformanceSignals(
    run.projectId,
    new Date("2026-10-19T00:00:00Z"),
  );
  expect(signals?.field).toEqual([
    expect.objectContaining({ collectionEnd: "2026-10-17", lcpP75Ms: 3_100 }),
  ]);
  expect(signals?.lab).toEqual([
    expect.objectContaining({
      url: "https://example.com/",
      lcpMs: 3_700,
      causes: [expect.objectContaining({ id: "render_blocking" })],
    }),
  ]);
});
