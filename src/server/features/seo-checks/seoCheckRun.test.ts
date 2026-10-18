import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { db } from "@/db";
import {
  ciCheckFindings,
  ciCheckRuns,
  ciCheckUrls,
  ciProjectSettings,
} from "@/db/schema";
import { setupRun } from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { planCheck } from "./seoCheckPlan";
import { checkBatch, finishCheck } from "./seoCheckRun";

// RFC-0010: one run end to end, against a fake production and preview.
const database = await vi.hoisted(async () => {
  const { createExperimentTestDatabase } =
    await import("@/server/features/experiments/repositories/experimentTestDb");
  return createExperimentTestDatabase();
});
const quickAction = vi.hoisted(() => vi.fn());
vi.mock("cloudflare:workers", () => ({
  env: {
    DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1",
    BROWSER: { quickAction },
  },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
vi.mock("@/server/lib/audit/url-policy", () => ({
  normalizeAndValidateStartUrl: async (url: string) => url,
  isCrawlableUrl: () => true,
}));
const base = "https://example.com";
// A trailing-slash site lists /pricing/ and redirects /pricing (bug found
// on the Relay Lab live check).
const site = vi.hoisted(() => ({ slash: false }));
const preview = "https://pr-7.vercel.app";
vi.mock("@/server/lib/audit/discovery", () => ({
  discoverUrls: async (origin: string) => ({
    urls: ["/", "/pricing", "/docs"].map(
      (path) => `${origin}${path}${site.slash && path !== "/" ? "/" : ""}`,
    ),
    robotsText:
      origin === preview ? "User-agent: Googlebot\nDisallow: /docs" : "",
  }),
}));
vi.mock("@/server/features/gsc/services/GscService", () => ({
  GscService: {
    getPerformance: async () => ({
      rows: [{ keys: [`${base}/pricing`], clicks: 40, impressions: 2000 }],
    }),
  },
}));
const words = (count: number) => "word ".repeat(count);
const html = (robots: string, count: number) =>
  `<html><head><title>Page</title><meta name="robots" content="${robots}"></head><body><h1>Page</h1><p>${words(count)}</p></body></html>`;

const pageFetch = vi.fn(async (url: string) => {
  const { pathname } = new URL(url);
  if (site.slash && pathname !== "/" && !pathname.endsWith("/"))
    return new Response(null, {
      status: 301,
      headers: { location: `${url}/` },
    });
  const onPreview = url.startsWith(preview);
  const pricing = url.endsWith("/pricing");
  const body = html(
    onPreview && pricing ? "noindex" : "index",
    onPreview && pricing ? 60 : 300,
  );
  return new Response(body, { headers: { "content-type": "text/html" } });
});

beforeAll(async () => {
  await database.prepare();
  if (!database.isPostgres)
    // The run reads key pages; take only their statements from 0042.
    for (const statement of readFileSync(
      "drizzle/sqlite/0042_project_memory.sql",
      "utf8",
    )
      .split("--> statement-breakpoint")
      .filter((sql) => sql.includes("`project_key_pages`")))
      await database.client.execute(statement);
  vi.stubGlobal("fetch", pageFetch);
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await database.close();
});

async function queuedRun() {
  const { run } = await setupRun(database.client, database.slugPrefix);
  const runId = crypto.randomUUID();
  await db.insert(ciCheckRuns).values({
    id: runId,
    projectId: run.projectId,
    repository: "acme/site",
    headSha: "a".repeat(40),
    previewOrigin: preview,
    baseOrigin: base,
    changedFiles: "app/pricing/page.tsx",
    status: "queued",
    createdAt: new Date().toISOString(),
  });
  return { runId, projectId: run.projectId };
}
const stored = (runId: string) =>
  db
    .select({
      path: ciCheckFindings.path,
      rule: ciCheckFindings.rule,
      severity: ciCheckFindings.severity,
    })
    .from(ciCheckFindings)
    .where(eq(ciCheckFindings.runId, runId));
const budget = { links: 200, renders: 5 };

it("finds the regressions, weighs them by traffic and stores the run", async () => {
  const { runId } = await queuedRun();
  const plan = await planCheck(runId);
  expect(plan.urls[0]).toMatchObject({
    path: "/pricing",
    reason: "changed_file",
    impressions: 2000,
  });
  await finishCheck(plan, [await checkBatch(plan, plan.urls, budget)]);
  // 5.4: at most 2 page requests per URL; no new links to check here.
  expect(pageFetch).toHaveBeenCalledTimes(2 * plan.urls.length);

  const [run] = await db
    .select()
    .from(ciCheckRuns)
    .where(eq(ciCheckRuns.id, runId));
  expect(run).toMatchObject({ status: "succeeded", urlCount: 3 });
  expect(await stored(runId)).toEqual(
    expect.arrayContaining([
      { path: "/pricing", rule: "newly-noindex", severity: "blocking" },
      // A high-traffic page: the content drop rises to blocking.
      { path: "/pricing", rule: "content-shrunk", severity: "blocking" },
      { path: "/docs", rule: "robots-txt-blocks", severity: "blocking" },
    ]),
  );
  expect(run?.blockingCount).toBe(3);
  expect(quickAction).not.toHaveBeenCalled();
  const [pricing] = await db
    .select({ clicks: ciCheckUrls.clicks28d })
    .from(ciCheckUrls)
    .where(eq(ciCheckUrls.path, "/pricing"));
  expect(pricing?.clicks).toBe(40);
});

it("compares the rendered HTML of a flagged page in rendered mode", async () => {
  const { runId, projectId } = await queuedRun();
  await db.insert(ciProjectSettings).values({
    projectId,
    renderedMode: true,
    updatedAt: new Date().toISOString(),
  });
  // In a browser, the preview's thin /pricing renders in full.
  quickAction.mockImplementation(async (_action, options: { url: string }) =>
    Response.json({
      success: true,
      result: html("index", 300),
      meta: { status: 200, finalUrl: options.url },
    }),
  );
  const plan = await planCheck(runId);
  await finishCheck(plan, [await checkBatch(plan, plan.urls, budget)]);
  expect(quickAction).toHaveBeenCalledTimes(2);
  expect(await stored(runId)).toEqual([
    { path: "/docs", rule: "robots-txt-blocks", severity: "blocking" },
  ]);
});

it("fetches a trailing-slash site in its own style instead of skipping redirects", async () => {
  site.slash = true;
  const { runId } = await queuedRun();
  const plan = await planCheck(runId);
  expect(plan.trailingSlash).toBe(true);
  await finishCheck(plan, [await checkBatch(plan, plan.urls, budget)]);
  const statuses = await db
    .select({ status: ciCheckUrls.baseStatus })
    .from(ciCheckUrls)
    .where(eq(ciCheckUrls.runId, runId));
  expect(statuses.map((row) => row.status)).toEqual([200, 200, 200]);
  site.slash = false;
});
