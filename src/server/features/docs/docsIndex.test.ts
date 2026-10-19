import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db";
import { docsPageHeadings, docsPages, docsSettings } from "@/db/schema";
import { setupRun } from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { indexDocs } from "./docsIndex";

// RFC-0017 5.2: the docs index reads changed files only, within its caps.
const database = await vi.hoisted(async () => {
  const { createOpportunityTestDatabase } =
    await import("@/server/features/opportunities/repositories/opportunityRepositoryTestDb");
  return createOpportunityTestDatabase("docs-index-test-");
});
const github = vi.hoisted(() => ({
  files: [] as Array<{ path: string; sha: string; size: number }>,
  reads: [] as string[],
}));
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
vi.mock(
  "@/server/features/publishing/repositories/PublishingRepository",
  () => ({
    PublishingRepository: {
      getConnection: async () => ({ baseBranch: "main" }),
    },
  }),
);
vi.mock("@/server/features/publishing/publishingAccess", () => ({
  connectedGithub: async () => ({
    getRef: async () => ({ sha: "c".repeat(40) }),
    listFiles: async () => ({
      paths: github.files.map((file) => file.path),
      files: github.files,
      truncated: false,
    }),
    readFile: async (path: string) => {
      github.reads.push(path);
      return {
        source: `---\ntitle: ${path}\n---\n\n## Install\n`,
        blobSha: "",
      };
    },
  }),
}));

const NOW = new Date("2026-10-19T00:00:00Z");
const file = (path: string, sha: string, size = 100) => ({ path, sha, size });

beforeAll(() => database.prepare());
afterAll(() => database.close());
beforeEach(() => {
  github.reads = [];
});

async function project() {
  const { run } = await setupRun(database.client, "docs-index-test-");
  await db.insert(docsSettings).values({
    projectId: run.projectId,
    pathPrefix: "/docs/",
    directory: "content/docs",
    updatedBy: "owner",
    updatedAt: NOW.toISOString(),
  });
  return run.projectId;
}

it("reads changed Markdown files once and drops removed files", async () => {
  const projectId = await project();
  github.files = [
    file("content/docs/guides/index.mdx", "a".repeat(40)),
    file("content/docs/setup.md", "b".repeat(40)),
    file("content/docs/meta.json", "c".repeat(40)),
    file("content/docs/huge.mdx", "d".repeat(40), 40_000),
  ];
  expect(await indexDocs(projectId, NOW)).toMatchObject({
    files: 3,
    read: 3,
    unreadable: 1,
  });
  expect(github.reads).toEqual([
    "content/docs/guides/index.mdx",
    "content/docs/setup.md",
  ]);
  const [guide] = await db
    .select()
    .from(docsPages)
    .where(eq(docsPages.blobSha, "a".repeat(40)));
  expect(guide).toMatchObject({
    urlPath: "/docs/guides",
    title: "content/docs/guides/index.mdx",
  });
  expect(
    await db
      .select({ text: docsPageHeadings.text, anchor: docsPageHeadings.anchor })
      .from(docsPageHeadings)
      .where(eq(docsPageHeadings.pageId, guide?.id ?? "")),
  ).toEqual([{ text: "Install", anchor: "install" }]);

  github.reads = [];
  github.files = github.files.filter(
    (item) => item.path !== "content/docs/setup.md",
  );
  expect(await indexDocs(projectId, NOW)).toMatchObject({
    read: 0,
    removed: 1,
  });
  expect(github.reads).toEqual([]);
  expect(
    await db.select().from(docsPages).where(eq(docsPages.projectId, projectId)),
  ).toHaveLength(2);
});

it("keeps 500 files and 10 MB, and reads 200 files a run", async () => {
  github.files = Array.from({ length: 501 }, (_, index) =>
    file(
      `content/docs/${String(index).padStart(3, "0")}.md`,
      `${index}`.padStart(40, "e"),
    ),
  );
  expect(await indexDocs(await project(), NOW)).toMatchObject({
    files: 500,
    read: 200,
    remaining: 300,
    overCap: 1,
  });
  github.files = [
    file("content/docs/a.md", "f".repeat(40), 6 * 1024 * 1024),
    file("content/docs/b.md", "9".repeat(40), 6 * 1024 * 1024),
  ];
  expect(await indexDocs(await project(), NOW)).toMatchObject({
    files: 1,
    overCap: 1,
  });
});
