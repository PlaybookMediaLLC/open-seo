import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db";
import { publishingConnections, splitTestPages, splitTests } from "@/db/schema";
import { shiftGa4Date } from "@/server/features/ga4/services/Ga4Dates";
import { setupRun } from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { baselineWindow } from "./splitTestBaseline";
import { SplitTestService } from "./SplitTestService";

// RFC-0011 5.2 and 5.3: from a page pattern to a stored, balanced test.
const database = await vi.hoisted(async () => {
  const { createExperimentTestDatabase } =
    await import("@/server/features/experiments/repositories/experimentTestDb");
  return createExperimentTestDatabase();
});
const mocks = vi.hoisted(() => ({ performance: vi.fn(), tree: vi.fn() }));
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
vi.mock("@/server/features/gsc/services/GscService", () => ({
  GscService: { getPerformance: mocks.performance },
}));
vi.mock("@/server/features/publishing/publishingAccess", () => ({
  connectedGithub: async () => ({
    getRef: async () => ({ sha: "a".repeat(40) }),
    getCommit: async () => ({ treeSha: "b".repeat(40) }),
    request: mocks.tree,
  }),
}));
vi.mock("@/server/lib/audit/url-policy", () => ({
  normalizeAndValidateStartUrl: async (url: string) => url,
}));
const TEMPLATE = "app/integrations/[slug]/page.tsx";

beforeAll(async () => {
  await database.prepare();
  if (!database.isPostgres)
    // Complete the harness's minimal project projection for the real org gate.
    await database.client.executeMultiple(`
      ALTER TABLE projects ADD COLUMN domain TEXT;
      ALTER TABLE projects ADD COLUMN location_code INTEGER DEFAULT 2840;
      ALTER TABLE projects ADD COLUMN language_code TEXT DEFAULT 'en';
      ALTER TABLE projects ADD COLUMN created_at TEXT;
      ALTER TABLE projects ADD COLUMN ai_research_keywords TEXT;
    `);
  vi.stubGlobal(
    "fetch",
    async (url: string) =>
      new Response(
        `<html><head><title>Old ${new URL(url).pathname}</title></head></html>`,
        {
          headers: { "content-type": "text/html" },
        },
      ),
  );
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await database.close();
});
beforeEach(() => {
  mocks.tree.mockResolvedValue({
    truncated: false,
    tree: [{ path: TEMPLATE, type: "blob" }],
  });
});

/** Daily rows for `count` integration pages over the baseline window. */
function rows(count: number, extra: string[] = []) {
  const { start } = baselineWindow();
  const paths = [
    ...Array.from({ length: count }, (_, index) => `/integrations/p${index}`),
    ...extra,
  ];
  return {
    rows: paths.flatMap((path, index) =>
      Array.from({ length: 56 }, (_, day) => ({
        keys: [`https://example.com${path}`, shiftGa4Date(start, day)],
        clicks: 2 + (index % 7) + ((index + day) % 3),
        impressions: 40,
      })),
    ),
  };
}

async function project() {
  const { run } = await setupRun(database.client, database.slugPrefix);
  await db.insert(publishingConnections).values({
    id: crypto.randomUUID(),
    projectId: run.projectId,
    repositoryId: "1",
    owner: "acme",
    repository: "site",
    baseBranch: "main",
    rootDirectory: "",
    createdBy: "owner",
    createdAt: new Date().toISOString(),
  });
  return {
    projectId: run.projectId,
    context: {
      organizationId: run.projectId,
      userId: "owner",
      role: "owner" as const,
    },
  };
}
const input = (projectId: string) => ({
  projectId,
  name: "Integration titles",
  hypothesis: "Naming the product gets more clicks.",
  field: "title" as const,
  pagePattern: "^/integrations/[^/]+$",
});

it("refuses a small group with the gap and creates nothing", async () => {
  const { projectId, context } = await project();
  mocks.performance.mockResolvedValue(rows(9));
  expect(await SplitTestService.create(context, input(projectId))).toEqual({
    created: false,
    failures: [
      "9 pages have a click in the 56-day baseline. A test needs at least 30, so 21 more.",
    ],
    summary: null,
  });
  expect(
    await db
      .select()
      .from(splitTests)
      .where(eq(splitTests.projectId, projectId)),
  ).toEqual([]);
});

it("backtests a group that cannot run a test, and stores nothing", async () => {
  const { projectId, context } = await project();
  const { end } = baselineWindow();
  mocks.performance.mockResolvedValue({
    rows: Array.from({ length: 9 }, (_, index) => ({
      keys: [
        `https://example.com/integrations/p${index}`,
        shiftGa4Date(end, -80),
      ],
      clicks: 10 + index,
      impressions: 50,
    })),
  });
  const report = await SplitTestService.backtestPattern(context, {
    projectId,
    pagePattern: "^/integrations/[^/]+$",
  });
  // 9 pages make 4 pairs, too few for the test to ever reject.
  expect(report).toMatchObject({ pairs: 4, runs: 200, falsePositiveRate: 0 });
  expect(
    await db
      .select()
      .from(splitTests)
      .where(eq(splitTests.projectId, projectId)),
  ).toEqual([]);
});

it("refuses pages that do not share one template", async () => {
  const { projectId, context } = await project();
  mocks.performance.mockResolvedValue(rows(40, ["/integrations/special"]));
  mocks.tree.mockResolvedValue({
    truncated: false,
    tree: [
      { path: TEMPLATE, type: "blob" },
      { path: "app/integrations/special/page.tsx", type: "blob" },
    ],
  });
  const result = await SplitTestService.create(context, input(projectId));
  expect(result).toMatchObject({ created: false });
  expect(result.created ? [] : result.failures).toEqual([
    `The pages use 2 templates: ${TEMPLATE} (40 pages), app/integrations/special/page.tsx (1 pages). A test needs pages that share one template.`,
  ]);
});

it("stores a balanced test with its pairs and the original titles", async () => {
  const { projectId, context } = await project();
  mocks.performance.mockResolvedValue(rows(61));
  const result = await SplitTestService.create(context, input(projectId));
  if (!result.created) throw new Error(result.failures.join(" "));
  const { test, pages, variantClicks, controlClicks } =
    await SplitTestService.get(context, { projectId, testId: result.testId });
  expect(test).toMatchObject({
    status: "eligible",
    pairs: 30,
    origin: "https://example.com",
  });
  expect(test.mdePct).toBeLessThanOrEqual(15);
  // The page with the fewest clicks drops out of the odd count.
  expect(pages.filter((page) => page.bucket === "variant")).toHaveLength(30);
  expect(Math.abs(variantClicks - controlClicks) / controlClicks).toBeLessThan(
    0.05,
  );
  const [first] = await db
    .select()
    .from(splitTestPages)
    .where(eq(splitTestPages.testId, result.testId))
    .limit(1);
  expect(first?.originalTitle).toBe(`Old ${first?.path}`);
});
