import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db";
import {
  auditEvents,
  publishingConnections,
  splitTestPages,
  splitTests,
} from "@/db/schema";
import { setupRun } from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { SplitTestPullService } from "./SplitTestPullService";

// RFC-0011 5.4: the reviewed files become a pull request, and the windows
// start only from a confirmed deployment of a checked merge commit.
const database = await vi.hoisted(async () => {
  const { createExperimentTestDatabase } =
    await import("@/server/features/experiments/repositories/experimentTestDb");
  return createExperimentTestDatabase();
});
const github = vi.hoisted(() => ({
  getRef: vi.fn(),
  createRef: vi.fn(),
  updateFile: vi.fn<(file: { path: string }) => Promise<object>>(),
  createPullRequest: vi.fn(),
  getPullRequest: vi.fn(),
  request: vi.fn(),
  readFile: vi.fn(),
  listDeployments: vi.fn(),
  listDeploymentStatuses: vi.fn(),
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
const HEAD = "c".repeat(40);
const MERGE = "d".repeat(40);
const page = `import { inSplitVariant } from "../../../relay-split";
export async function generateMetadata({ params }) {
  return { title: inSplitVariant(\`/integrations/\${params.slug}\`) ? "A" : "B" };
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
  github.createRef.mockResolvedValue({ sha: "a".repeat(40) });
  github.updateFile.mockResolvedValue({});
  github.createPullRequest.mockResolvedValue({
    number: 9,
    url: "https://github.com/acme/site/pull/9",
  });
  github.listDeployments.mockResolvedValue([]);
});

async function seededTest(status: "eligible" | "awaiting_deploy") {
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
    status,
    pairs: 1,
    templatePath: TEMPLATE,
    pullRequestNumber: status === "eligible" ? null : 9,
    createdBy: "owner",
    createdAt: new Date().toISOString(),
  });
  await db.insert(splitTestPages).values(
    (["variant", "control"] as const).map((bucket, index) => ({
      id: crypto.randomUUID(),
      testId,
      projectId,
      path: `/integrations/p${index}`,
      pairIndex: 0,
      bucket,
      baselineClicks: 10,
      baselineImpressions: 100,
    })),
  );
  return {
    ids: { projectId, testId },
    context: {
      organizationId: projectId,
      userId: "owner",
      role: "owner" as const,
    },
  };
}

it("opens the reviewed files as a pull request and records the approval", async () => {
  const { ids, context } = await seededTest("eligible");
  const preview = await SplitTestPullService.preview(context, ids);
  expect(preview.body).toContain(TEMPLATE);
  await SplitTestPullService.open(context, { ...ids, hash: preview.hash });
  expect(github.updateFile.mock.calls.map(([file]) => file.path)).toEqual([
    `relay-split/${ids.testId}.json`,
    "relay-split/index.ts",
  ]);
  const [test] = await db
    .select()
    .from(splitTests)
    .where(eq(splitTests.id, ids.testId));
  expect(test).toMatchObject({
    status: "awaiting_deploy",
    pullRequestNumber: 9,
  });
  expect(
    await db
      .select({ action: auditEvents.action })
      .from(auditEvents)
      .where(eq(auditEvents.projectId, ids.projectId)),
  ).toEqual([{ action: "split_test.pr_opened" }]);
});

it("refuses files that changed since the review", async () => {
  const { ids, context } = await seededTest("eligible");
  await expect(
    SplitTestPullService.open(context, { ...ids, hash: "0".repeat(64) }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  expect(github.createRef).not.toHaveBeenCalled();
});

it("confirms only a checked merge commit and starts the windows from its deployment", async () => {
  const { ids, context } = await seededTest("awaiting_deploy");
  const { files } = await SplitTestPullService.preview(context, ids);
  github.getPullRequest.mockResolvedValue({
    merged: true,
    headSha: HEAD,
    mergeCommitSha: MERGE,
  });
  github.request.mockResolvedValue(
    [...files.map((file) => file.path), TEMPLATE].map((filename) => ({
      filename,
    })),
  );
  // First the template edit is missing, so the check fails.
  github.readFile.mockImplementation(async (path: string) => {
    if (path === TEMPLATE) throw new Error("missing");
    return { source: files[0]?.source };
  });
  expect((await SplitTestPullService.check(context, ids)).problems).toEqual([
    `Edit ${TEMPLATE} in this pull request, as the description shows.`,
  ]);
  expect(
    await SplitTestPullService.confirmDeployment(context, {
      ...ids,
      attest: true,
    }),
  ).toMatchObject({ ok: false });

  github.readFile.mockImplementation(async (path: string) => ({
    source: path === TEMPLATE ? page : files[0]?.source,
  }));
  expect((await SplitTestPullService.check(context, ids)).problems).toEqual([]);
  github.listDeployments.mockResolvedValue([
    { id: 5, environment: "Production", sha: MERGE },
  ]);
  github.listDeploymentStatuses.mockResolvedValue([
    { state: "success", created_at: "2026-10-01T18:00:00Z" },
  ]);
  expect(
    await SplitTestPullService.confirmDeployment(context, {
      ...ids,
      attest: false,
    }),
  ).toMatchObject({ ok: true });
  const [test] = await db
    .select()
    .from(splitTests)
    .where(eq(splitTests.id, ids.testId));
  // The deployment day and the next 6 days are excluded; then 28 days.
  expect(test).toMatchObject({
    status: "verifying",
    deploymentBasis: "github_deployment",
    observationStart: "2026-10-08",
    observationEnd: "2026-11-04",
  });
});
