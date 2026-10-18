import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { db } from "@/db";
import { ciCheckFindings, ciCheckRuns, ciCheckUrls } from "@/db/schema";
import { setupRun } from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { planCheck } from "./seoCheckPlan";
import { checkBatch, finishCheck } from "./seoCheckRun";

// RFC-0010: one run end to end, against a fake production and preview.
const database = await vi.hoisted(async () => {
  const { createExperimentTestDatabase } =
    await import("@/server/features/experiments/repositories/experimentTestDb");
  return createExperimentTestDatabase();
});
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
vi.mock("@/server/lib/audit/url-policy", () => ({
  normalizeAndValidateStartUrl: async (url: string) => url,
}));
const base = "https://example.com";
const preview = "https://pr-7.vercel.app";
vi.mock("@/server/lib/audit/discovery", () => ({
  discoverUrls: async (origin: string) => ({
    urls: ["/", "/pricing", "/docs"].map((path) => `${origin}${path}`),
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
  vi.stubGlobal("fetch", async (url: string) => {
    const onPreview = url.startsWith(preview);
    const pricing = url.endsWith("/pricing");
    const robots = onPreview && pricing ? "noindex" : "index";
    const body = `<html><head><title>Page</title><meta name="robots" content="${robots}"></head><body><h1>Page</h1><p>${words(onPreview && pricing ? 60 : 300)}</p></body></html>`;
    return new Response(body, { headers: { "content-type": "text/html" } });
  });
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await database.close();
});

it("finds the regressions, weighs them by traffic and stores the run", async () => {
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
  const plan = await planCheck(runId);
  expect(plan.urls[0]).toMatchObject({
    path: "/pricing",
    reason: "changed_file",
    impressions: 2000,
  });
  await finishCheck(plan, [await checkBatch(plan, plan.urls, 200)]);

  const [stored] = await db
    .select()
    .from(ciCheckRuns)
    .where(eq(ciCheckRuns.id, runId));
  expect(stored).toMatchObject({ status: "succeeded", urlCount: 3 });
  const findings = await db
    .select({
      path: ciCheckFindings.path,
      rule: ciCheckFindings.rule,
      severity: ciCheckFindings.severity,
    })
    .from(ciCheckFindings)
    .where(eq(ciCheckFindings.runId, runId));
  expect(findings).toEqual(
    expect.arrayContaining([
      { path: "/pricing", rule: "newly-noindex", severity: "blocking" },
      // A high-traffic page: the content drop rises to blocking.
      { path: "/pricing", rule: "content-shrunk", severity: "blocking" },
      { path: "/docs", rule: "robots-txt-blocks", severity: "blocking" },
    ]),
  );
  expect(stored?.blockingCount).toBe(3);
  const [pricing] = await db
    .select({ clicks: ciCheckUrls.clicks28d })
    .from(ciCheckUrls)
    .where(eq(ciCheckUrls.path, "/pricing"));
  expect(pricing?.clicks).toBe(40);
});
