import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db";
import {
  projectConversionEvents,
  publishingConnections,
  splitTestPages,
  splitTests,
} from "@/db/schema";
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
const mocks = vi.hoisted(() => ({
  performance: vi.fn(),
  tree: vi.fn(),
  ga4Report: vi.fn(),
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
vi.mock("@/server/features/publishing/publishingAccess", () => ({
  connectedGithub: async () => ({
    getRef: async () => ({ sha: "a".repeat(40) }),
    getCommit: async () => ({ treeSha: "b".repeat(40) }),
    request: mocks.tree,
  }),
}));
vi.mock("@/server/features/ga4/repositories/Ga4ConnectionRepository", () => ({
  Ga4ConnectionRepository: {
    getByProjectId: async () => ({
      propertyId: "properties/1",
      connectedByUserId: "owner",
      ga4AccountId: "a",
    }),
  },
}));
vi.mock("@/server/lib/ga4Client", () => ({
  createGa4DataClient: () => ({ runReport: mocks.ga4Report }),
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

const encode = (text: string) => ({
  content: Buffer.from(text).toString("base64"),
  encoding: "base64",
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
  const result = await SplitTestService.create(context, input(projectId));
  expect(result).toMatchObject({
    created: false,
    failures: [
      "9 pages match the pattern, and 9 have a click in the 56-day baseline. A test needs at least 30 with a click, so 21 more.",
    ],
  });
  // The refusal names the MDE too (10, phase 1a).
  expect(result.summary).toMatch(
    /^This group can detect a change of \d+% or more/,
  );
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
    `The pages use 2 templates: ${TEMPLATE} (40 pages), app/integrations/special/page.tsx (1 pages). A test needs pages that share one route file or one metadata helper.`,
  ]);
});

it("accepts separate static pages that share one metadata helper", async () => {
  const { projectId, context } = await project();
  mocks.performance.mockResolvedValue(rows(40));
  const pages = Array.from(
    { length: 40 },
    (_, index) => `app/(site)/integrations/p${index}/page.tsx`,
  );
  mocks.tree.mockImplementation(async (route: string) => {
    if (route.startsWith("/git/trees/"))
      return {
        truncated: false,
        tree: [
          ...pages.map((path, index) => ({
            path,
            type: "blob",
            sha: `page${index}`,
          })),
          { path: "lib/metadata.ts", type: "blob", sha: "helper" },
          { path: "tsconfig.json", type: "blob", sha: "tsconfig" },
        ],
      };
    if (route === "/git/blobs/tsconfig")
      return encode(
        JSON.stringify({ compilerOptions: { paths: { "@/*": ["./*"] } } }),
      );
    const index = Number(route.replace("/git/blobs/page", ""));
    return encode(
      `import { pageMetadata } from "@/lib/metadata";\nexport const metadata = pageMetadata("Integration ${index}", "About it", "/integrations/p${index}");\n`,
    );
  });
  const result = await SplitTestService.create(context, input(projectId));
  if (!result.created) throw new Error(result.failures.join(" "));
  const { test } = await SplitTestService.get(context, {
    projectId,
    testId: result.testId,
  });
  expect(test).toMatchObject({
    templatePath: "lib/metadata.ts",
    templateHelper: "pageMetadata",
  });
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

// RFC-0012 phase 2: a conversion test checks the MDE on the conversion.
it("checks the MDE of a conversion test on the chosen conversion", async () => {
  const { projectId, context } = await project();
  await db.insert(projectConversionEvents).values({
    projectId,
    eventName: "sign_up",
    createdBy: "owner",
    updatedAt: new Date().toISOString(),
  });
  const search = rows(61);
  mocks.performance.mockResolvedValue(search);
  // GA4 dates are YYYYMMDD, and conversions follow the conversion factor.
  const conversions = (factor: (index: number) => number) => ({
    rows: search.rows.map((row, index) => ({
      dimensionValues: [
        { value: new URL(row.keys[0]).pathname },
        { value: row.keys[1].replaceAll("-", "") },
      ],
      metricValues: [{ value: String(factor(index)) }],
    })),
  });
  const conversionInput = {
    ...input(projectId),
    metric: "conversions" as const,
  };
  mocks.ga4Report.mockResolvedValue(
    conversions((index) => (index % 97 ? 0 : 1)),
  );
  const sparse = await SplitTestService.create(context, conversionInput);
  expect(sparse.created).toBe(false);

  mocks.ga4Report.mockResolvedValue(
    conversions((index) => search.rows[index].clicks),
  );
  const result = await SplitTestService.create(context, conversionInput);
  if (!result.created) throw new Error(result.failures.join(" "));
  const [test] = await db
    .select({ metric: splitTests.metric, metricEvent: splitTests.metricEvent })
    .from(splitTests)
    .where(eq(splitTests.id, result.testId));
  expect(test).toEqual({ metric: "conversions", metricEvent: "sign_up" });
});
