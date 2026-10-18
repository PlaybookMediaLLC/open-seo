import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db";
import {
  auditAccessibilityResults,
  auditAccessibilityViolations,
} from "@/db/schema";
import { setupRun } from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { runAccessibilityStep } from "./accessibilityStep";
import { saveAccessibilityTargets } from "./accessibilityTargets";

// RFC-0013 5.2: the pages that matter, axe-core on each, and billed time.
const database = await vi.hoisted(async () => {
  const { createExperimentTestDatabase } =
    await import("@/server/features/experiments/repositories/experimentTestDb");
  return createExperimentTestDatabase();
});
const mocks = vi.hoisted(() => ({
  quickAction:
    vi.fn<(action: string, options: { url: string }) => Promise<Response>>(),
  gsc: vi.fn(),
  keyPages: vi.fn(),
  settle: vi.fn(),
}));
vi.mock("cloudflare:workers", () => ({
  env: {
    DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1",
    BROWSER: { quickAction: mocks.quickAction },
  },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
vi.mock("@/server/features/gsc/services/GscService", () => ({
  GscService: { getPerformance: mocks.gsc },
}));
vi.mock(
  "@/server/features/project-context/repositories/ProjectContextRepository",
  () => ({ ProjectContextRepository: { listKeyPages: mocks.keyPages } }),
);
vi.mock("@/server/billing/spendAdmission", () => ({
  assertSpendRoom: async () => undefined,
}));
vi.mock("@/server/lib/audit/rendering-billing", () => ({
  lockRenderingCredits: async () => [{ lockId: "lock" }],
  settleRenderingLocks: mocks.settle,
}));
vi.mock("@/server/workflows/pgStep", () => ({
  pgStep: (
    _step: unknown,
    _name: string,
    _config: unknown,
    fn: () => unknown,
  ) => fn(),
}));
vi.mock("@/server/lib/audit/url-policy", () => ({
  isCrawlableUrl: () => true,
}));

beforeAll(async () => {
  await database.prepare();
  // The pinned axe-core file, as the CDN serves it.
  const axe = readFileSync("node_modules/axe-core/axe.min.js", "utf8");
  vi.stubGlobal("fetch", async () => new Response(axe));
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await database.close();
});
beforeEach(() => {
  mocks.gsc.mockResolvedValue({
    rows: [
      { keys: ["https://example.com/p3"], clicks: 5 },
      { keys: ["https://example.com/p40"], clicks: 90 },
    ],
  });
  mocks.keyPages.mockResolvedValue([
    { url: "https://example.com/pricing", role: "money" },
  ]);
  mocks.settle.mockResolvedValue(undefined);
});

async function audit(paths: string[]) {
  const { run } = await setupRun(database.client, database.slugPrefix);
  const auditId = crypto.randomUUID();
  await database.client.execute({
    sql: "INSERT INTO audits (id, project_id, started_by_user_id, start_url, status) VALUES (?, ?, 'owner', 'https://example.com/', 'running')",
    args: [auditId, run.projectId],
  });
  for (const path of paths)
    await database.client.execute({
      sql: "INSERT INTO audit_pages (id, audit_id, url, status_code) VALUES (?, ?, ?, 200)",
      args: [crypto.randomUUID(), auditId, `https://example.com${path}`],
    });
  return { auditId, projectId: run.projectId };
}

/** Runs the step; pgStep is mocked, so the Workflow step is never read. */
function checkAudit(auditId: string, projectId: string) {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  return runAccessibilityStep({} as never, {
    auditId,
    projectId,
    billingCustomer: {
      organizationId: projectId,
      userId: "owner",
      userEmail: "o@example.com",
      projectId,
    },
  });
}

it("checks key pages, then top-clicked pages, then one page per template, at most 50", async () => {
  const { auditId, projectId } = await audit([
    ...Array.from({ length: 60 }, (_, index) => `/p${index}`),
    "/pricing",
  ]);
  // The app worker saves the top-clicked pages when the audit starts.
  await saveAccessibilityTargets(auditId, projectId);
  mocks.quickAction.mockResolvedValue(
    Response.json({ result: "<html></html>" }),
  );
  await checkAudit(auditId, projectId);
  const urls = mocks.quickAction.mock.calls.map(
    ([, options]) => new URL(options.url).pathname,
  );
  expect(urls).toHaveLength(50);
  expect(urls.slice(0, 3)).toEqual(["/pricing", "/p40", "/p3"]);
});

it("stores each page's violations with cluster keys and bills each browser attempt", async () => {
  const { auditId, projectId } = await audit(["/", "/about"]);
  const json = JSON.stringify({
    version: "4.13.0",
    violations: [
      {
        id: "image-alt",
        impact: "critical",
        tags: ["wcag2a"],
        nodes: [
          { target: "img", html: '<img src="/a.png">', summary: "Add alt" },
        ],
      },
    ],
  }).replaceAll('"', "&quot;");
  mocks.quickAction.mockImplementation(async () =>
    Response.json({
      result: `<html><template id="relay-axe-results" data-json="${json}"></template></html>`,
    }),
  );
  await checkAudit(auditId, projectId);
  const results = await db
    .select({ id: auditAccessibilityResults.id })
    .from(auditAccessibilityResults)
    .where(eq(auditAccessibilityResults.auditId, auditId));
  expect(results).toHaveLength(2);
  const violations = await db
    .select({ clusterKey: auditAccessibilityViolations.clusterKey })
    .from(auditAccessibilityViolations)
    .innerJoin(
      auditAccessibilityResults,
      eq(auditAccessibilityResults.id, auditAccessibilityViolations.resultId),
    )
    .where(eq(auditAccessibilityResults.auditId, auditId));
  // The same image on two pages is one cluster.
  expect(new Set(violations.map((row) => row.clusterKey)).size).toBe(1);
  expect(mocks.settle).toHaveBeenCalledWith(
    expect.objectContaining({
      usage: { cloudflareAttempts: 2, contextCredits: 0 },
    }),
  );
});
