import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db";
import { cwvSnapshots } from "@/db/schema";
import { setupRun } from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { refreshFieldData } from "./fieldData";

// RFC-0014 5.2: the origin, key pages and top pages, on phones and
// desktops, at most 70 requests, and one row per week and target.
const database = await vi.hoisted(async () => {
  const { createOpportunityTestDatabase } =
    await import("@/server/features/opportunities/repositories/opportunityRepositoryTestDb");
  return createOpportunityTestDatabase("field-data-test-");
});
const mocks = vi.hoisted(() => ({
  fetch: vi.fn<(url: string, init: { body: string }) => Promise<Response>>(),
}));
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
vi.mock("@/server/lib/runtime-env", () => ({
  getOptionalEnvValue: async () => "crux-test-key",
}));
vi.mock("@/server/features/gsc/services/GscService", () => ({
  GscService: {
    getConnection: async () => ({ siteUrl: "sc-domain:example.com" }),
    getPerformance: async () => ({
      rows: Array.from({ length: 40 }, (_, index) => ({
        keys: [`https://example.com/p${index}`],
      })),
    }),
  },
}));
vi.mock(
  "@/server/features/project-context/repositories/ProjectContextRepository",
  () => ({
    ProjectContextRepository: {
      listKeyPages: async () => [{ url: "https://example.com/pricing" }],
    },
  }),
);
beforeAll(async () => {
  await database.prepare();
  vi.stubGlobal("fetch", mocks.fetch);
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await database.close();
});
beforeEach(() => {
  // CrUX has data for the origin and the pricing page only.
  mocks.fetch.mockImplementation(async (_url, init) => {
    const hasData =
      init.body.includes('"origin"') ||
      init.body.includes('"url":"https://example.com/pricing"');
    if (!hasData) return new Response("{}", { status: 404 });
    return Response.json({
      record: {
        metrics: {
          largest_contentful_paint: { percentiles: { p75: 3100 } },
          interaction_to_next_paint: { percentiles: { p75: 180 } },
          cumulative_layout_shift: { percentiles: { p75: "0.12" } },
        },
        collectionPeriod: { lastDate: { year: 2026, month: 10, day: 17 } },
      },
    });
  });
});

it("reads the origin, key pages and top pages, and stores one row per week", async () => {
  const { run } = await setupRun(database.client, "field-data-test-");
  const now = new Date("2026-10-19T05:00:00Z");
  expect(await refreshFieldData(run.projectId, now)).toEqual({
    configured: true,
    stored: 4,
    noData: 66,
    failed: 0,
  });
  const bodies = mocks.fetch.mock.calls.map(([, init]) => init.body);
  expect(bodies.slice(0, 4)).toEqual([
    '{"origin":"https://example.com","formFactor":"PHONE","metrics":["largest_contentful_paint","interaction_to_next_paint","cumulative_layout_shift"]}',
    expect.stringContaining('"formFactor":"DESKTOP"'),
    expect.stringContaining('"url":"https://example.com/pricing"'),
    expect.stringContaining('"url":"https://example.com/pricing"'),
  ]);
  // A second run in the same week updates the rows.
  await refreshFieldData(run.projectId, now);
  const rows = await db
    .select({ clsP75: cwvSnapshots.clsP75, end: cwvSnapshots.collectionEnd })
    .from(cwvSnapshots)
    .where(eq(cwvSnapshots.projectId, run.projectId));
  expect(rows).toHaveLength(4);
  expect(rows[0]).toEqual({ clsP75: 0.12, end: "2026-10-17" });
});
