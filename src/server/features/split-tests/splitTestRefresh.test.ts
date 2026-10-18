import { eq } from "drizzle-orm";
import { chunk } from "remeda";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db";
import {
  growthNotifications,
  splitTestAnalyses,
  splitTestPages,
  splitTests,
} from "@/db/schema";
import { shiftGa4Date } from "@/server/features/ga4/services/Ga4Dates";
import { setupRun } from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { refreshSplitTest } from "./splitTestRefresh";

// RFC-0011 5.5 and 5.6: verification starts a test, a page changed outside
// its group is caught, and a finished window gets its label.
const database = await vi.hoisted(async () => {
  const { createExperimentTestDatabase } =
    await import("@/server/features/experiments/repositories/experimentTestDb");
  return createExperimentTestDatabase();
});
const mocks = vi.hoisted(() => ({
  ga4Connection: vi.fn(),
  runReport: vi.fn(),
  performance: vi.fn(),
  titles: new Map<string, string>(),
}));
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
vi.mock("@/server/features/gsc/services/GscService", () => ({
  GscService: { getPerformance: mocks.performance },
}));
vi.mock("@/server/features/ga4/repositories/Ga4ConnectionRepository", () => ({
  Ga4ConnectionRepository: { getByProjectId: mocks.ga4Connection },
}));
vi.mock("@/server/lib/ga4Client", () => ({
  createGa4DataClient: () => ({ runReport: mocks.runReport }),
}));
vi.mock("@/server/lib/audit/url-policy", () => ({
  normalizeAndValidateStartUrl: async (url: string) => url,
}));
const NOW = new Date("2026-12-31T12:00:00Z");
// 16 pairs, the smallest eligible design.
const PATHS = Array.from(
  { length: 32 },
  (_, index) => `/integrations/p${index}`,
);

beforeAll(async () => {
  await database.prepare();
  vi.stubGlobal("fetch", async (url: string) => {
    const path = new URL(url).pathname;
    return new Response(
      `<title>${mocks.titles.get(path) ?? `Old ${path}`}</title>`,
      {
        headers: { "content-type": "text/html" },
      },
    );
  });
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await database.close();
});
beforeEach(() => {
  mocks.ga4Connection.mockResolvedValue(null);
  mocks.titles.clear();
  // Variant pages (even indexes) show their new title.
  for (const [index, path] of PATHS.entries())
    if (index % 2 === 0) mocks.titles.set(path, `New ${path}`);
});

async function seededTest(status: "verifying" | "running") {
  const { run } = await setupRun(database.client, database.slugPrefix);
  const testId = crypto.randomUUID();
  const test = {
    id: testId,
    projectId: run.projectId,
    name: "Integration titles",
    hypothesis: "Naming the product gets more clicks.",
    field: "title" as const,
    pagePattern: "^/integrations/[^/]+$",
    origin: "https://example.com",
    status,
    seed: 7,
    pairs: 16,
    baselineStart: "2026-09-01",
    baselineEnd: "2026-10-26",
    deployedAt: "2026-10-27T12:00:00.000Z",
    observationStart: "2026-11-03",
    observationEnd: "2026-11-30",
    createdBy: "owner",
    createdAt: NOW.toISOString(),
  };
  await db.insert(splitTests).values(test);
  const pages = PATHS.map((path, index) => ({
    id: crypto.randomUUID(),
    testId,
    projectId: run.projectId,
    path,
    pairIndex: Math.floor(index / 2),
    bucket: index % 2 === 0 ? ("variant" as const) : ("control" as const),
    baselineClicks: 100,
    baselineImpressions: 1000,
    originalTitle: `Old ${path}`,
  }));
  for (const part of chunk(pages, 8))
    await db.insert(splitTestPages).values(part);
  const [row] = await db
    .select()
    .from(splitTests)
    .where(eq(splitTests.id, testId));
  if (!row) throw new Error("no test");
  return row;
}

it("starts a verified test and catches a page changed outside its group", async () => {
  const test = await seededTest("verifying");
  mocks.titles.set(PATHS[1] ?? "", "Changed control");
  mocks.titles.delete(PATHS[2] ?? "");
  expect(await refreshSplitTest(test, test.projectId, NOW)).toBe(
    `2 of 32 pages failed live verification: ${PATHS[1]}, ${PATHS[2]}. Fix them and verify again.`,
  );
  mocks.titles.delete(PATHS[1] ?? "");
  mocks.titles.set(PATHS[2] ?? "", `New ${PATHS[2]}`);
  await refreshSplitTest(test, test.projectId, NOW);
  const [after] = await db
    .select()
    .from(splitTests)
    .where(eq(splitTests.id, test.id));
  expect(after?.status).toBe("running");
});

it("labels a finished window, concludes the test and tells the project", async () => {
  const test = await seededTest("running");
  // Variant pages gain about 30% after the deployment.
  mocks.performance.mockImplementation(
    async ({ startDate, endDate }: { startDate: string; endDate: string }) => {
      const rows = [];
      for (let date = startDate; date <= endDate; date = shiftGa4Date(date, 1))
        for (const [index, path] of PATHS.entries())
          rows.push({
            keys: [`https://example.com${path}`, date],
            clicks:
              10 +
              (index % 5) +
              (index % 2 === 0 && date >= "2026-11-03" ? 3 : 0),
            impressions: 100,
          });
      return { rows };
    },
  );
  expect(await refreshSplitTest(test, test.projectId, NOW)).toMatch(
    /^Estimated effect after 28 days: 2\d\.\d%/,
  );
  const [after] = await db
    .select()
    .from(splitTests)
    .where(eq(splitTests.id, test.id));
  expect(after).toMatchObject({ status: "concluded", contaminated: false });
  const [analysis] = await db
    .select()
    .from(splitTestAnalyses)
    .where(eq(splitTestAnalyses.testId, test.id));
  expect(analysis).toMatchObject({ observationDays: 28, notes: null });
  expect(
    await db
      .select({ title: growthNotifications.title })
      .from(growthNotifications)
      .where(eq(growthNotifications.projectId, test.projectId)),
  ).toEqual([
    { title: `Split test result: ${analysis?.label} for Integration titles` },
  ]);
});

it("adds GA4 sessions and key events beside the result", async () => {
  const test = await seededTest("running");
  mocks.performance.mockResolvedValue({ rows: [] });
  mocks.ga4Connection.mockResolvedValue({
    propertyTimeZone: "America/Los_Angeles",
    connectedByUserId: "owner",
    ga4AccountId: "account",
    propertyId: "1",
  });
  const rows = [];
  for (
    let date = "2026-09-01";
    date <= "2026-11-30";
    date = shiftGa4Date(date, 1)
  )
    for (const [index, path] of PATHS.entries())
      rows.push({
        dimensionValues: [{ value: path }, { value: date.replaceAll("-", "") }],
        metricValues: [
          {
            value: String(
              20 +
                (index % 3) +
                (index % 2 === 0 && date >= "2026-11-03" ? 4 : 0),
            ),
          },
          { value: "1" },
        ],
      });
  mocks.runReport.mockResolvedValue({ rows });
  await refreshSplitTest(test, test.projectId, NOW);
  const [analysis] = await db
    .select()
    .from(splitTestAnalyses)
    .where(eq(splitTestAnalyses.testId, test.id));
  expect(analysis?.sessionsEstimatePct).toBeGreaterThan(10);
  expect(analysis?.keyEventsEstimatePct).toBe(0);
});
