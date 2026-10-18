import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db";
import { auditEvents, publishingConnections, splitTests } from "@/db/schema";
import { setupRun } from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { SplitTestEndService } from "./SplitTestEndService";

// RFC-0011 5.7: ending a test opens one reviewed pull request that leaves no
// split code; applying waits for the full window.
const database = await vi.hoisted(async () => {
  const { createExperimentTestDatabase } =
    await import("@/server/features/experiments/repositories/experimentTestDb");
  return createExperimentTestDatabase();
});
const github = vi.hoisted(() => ({
  getRef: vi.fn(),
  readFile: vi.fn(),
  createRef: vi.fn(),
  updateFile:
    vi.fn<(file: { path: string; source: string }) => Promise<object>>(),
  deleteFile: vi.fn<(file: { path: string }) => Promise<object>>(),
  createPullRequest: vi.fn(),
}));
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
vi.mock(
  "@/server/features/publishing/publishingAccess",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    connectedGithub: async () => github,
  }),
);
const TEMPLATE = "app/integrations/[slug]/page.tsx";
const SOURCE = `import { inSplitVariant } from "../../../relay-split";
export async function generateMetadata({ params }) {
  return { title: inSplitVariant(\`/integrations/\${params.slug}\`) ? "New" : "Old" };
}
`;

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
});
afterAll(() => database.close());
beforeEach(() => {
  github.getRef.mockResolvedValue({ sha: "a".repeat(40) });
  github.readFile.mockImplementation(async (path: string) => ({
    source: path === TEMPLATE ? SOURCE : "{}",
    blobSha: path === TEMPLATE ? "1".repeat(40) : "2".repeat(40),
  }));
  github.createRef.mockResolvedValue({});
  github.updateFile.mockResolvedValue({});
  github.deleteFile.mockResolvedValue({});
  github.createPullRequest.mockResolvedValue({
    number: 12,
    url: "https://github.com/acme/site/pull/12",
  });
});

async function runningTest() {
  const { run } = await setupRun(database.client, database.slugPrefix);
  const projectId = run.projectId;
  await db.insert(publishingConnections).values({
    id: crypto.randomUUID(),
    projectId,
    repositoryId: "1",
    owner: "acme",
    repository: "site",
    baseBranch: "main",
    rootDirectory: "",
    createdBy: "owner",
    createdAt: new Date().toISOString(),
  });
  const testId = crypto.randomUUID();
  await db.insert(splitTests).values({
    id: testId,
    projectId,
    name: "Integration titles",
    hypothesis: "Naming the product gets more clicks.",
    field: "title",
    pagePattern: "^/integrations/[^/]+$",
    origin: "https://example.com",
    status: "running",
    templatePath: TEMPLATE,
    createdBy: "owner",
    createdAt: new Date().toISOString(),
  });
  return {
    ids: { projectId, testId },
    context: {
      organizationId: projectId,
      userId: "owner",
      role: "owner" as const,
    },
  };
}

it("removes a running test with one pull request and no split code left", async () => {
  const { ids, context } = await runningTest();
  const preview = await SplitTestEndService.preview(context, {
    ...ids,
    action: "remove",
  });
  expect(preview.problems).toEqual([]);
  await SplitTestEndService.end(context, {
    ...ids,
    action: "remove",
    hash: preview.hash,
  });
  const [template] = github.updateFile.mock.calls[0] ?? [];
  expect(template?.path).toBe(TEMPLATE);
  expect(template?.source).not.toContain("inSplitVariant");
  expect(template?.source).toContain('title: "Old"');
  expect(github.deleteFile.mock.calls.map(([file]) => file.path)).toEqual([
    `relay-split/${ids.testId}.json`,
    "relay-split/index.ts",
  ]);
  const [test] = await db
    .select()
    .from(splitTests)
    .where(eq(splitTests.id, ids.testId));
  expect(test).toMatchObject({ status: "stopped", endAction: "remove" });
  expect(
    await db
      .select({ action: auditEvents.action })
      .from(auditEvents)
      .where(eq(auditEvents.projectId, ids.projectId)),
  ).toEqual([{ action: "split_test.ended" }]);
});

it("refuses to apply the variant before the window ends", async () => {
  const { ids, context } = await runningTest();
  await expect(
    SplitTestEndService.preview(context, { ...ids, action: "apply" }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  expect(github.createRef).not.toHaveBeenCalled();
});
