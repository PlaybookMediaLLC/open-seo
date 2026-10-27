import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { deployed } from "@/server/features/experiments/repositories/experimentTestFixtures";
import { AccessibilityCheckService } from "./AccessibilityCheckService";

// RFC-0013 5.5: after the deployment, axe-core runs again on the cluster's
// pages, and each page passes only when the rule no longer fails on it.
const database = await vi.hoisted(async () => {
  const { createExperimentTestDatabase } =
    await import("@/server/features/experiments/repositories/experimentTestDb");
  return createExperimentTestDatabase();
});
const mocks = vi.hoisted(() => ({
  quickAction:
    vi.fn<(action: string, options: { url: string }) => Promise<Response>>(),
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
vi.mock("@/server/features/projects/repositories/ProjectRepository", () => ({
  ProjectRepository: {
    getProjectForOrganization: async (projectId: string, orgId: string) =>
      projectId === orgId ? { id: projectId } : null,
  },
}));
vi.mock("@/server/lib/audit/rendering-billing", () => ({
  lockRenderingCredits: async () => [{ lockId: "lock" }],
  settleRenderingLocks: mocks.settle,
}));

beforeAll(async () => {
  await database.prepare();
  if (!database.isPostgres)
    // The real audits table has the start time that the trend orders by.
    await database.client.execute(
      "ALTER TABLE audits ADD COLUMN started_at TEXT NOT NULL DEFAULT '2026-10-01T00:00:00.000Z'",
    );
  // The pinned axe-core file, as the CDN serves it.
  const axe = readFileSync("node_modules/axe-core/axe.min.js", "utf8");
  vi.stubGlobal("fetch", async () => new Response(axe));
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await database.close();
});
beforeEach(() => {
  mocks.settle.mockResolvedValue(undefined);
});

/** A rendered page whose axe-core result fails these rules. */
function page(...rules: string[]) {
  const json = JSON.stringify({
    version: "4.13.0",
    violations: rules.map((id) => ({
      id,
      impact: "critical",
      tags: ["wcag2a"],
      nodes: [{ target: "main > img", html: "<img>", summary: "Fix" }],
    })),
  }).replaceAll('"', "&quot;");
  return Response.json({
    result: `<html><template id="relay-axe-results" data-json="${json}"></template></html>`,
  });
}

/** A deployed jsx_attribute fix of one image-alt cluster on two pages. */
async function deployedFix() {
  const { input, experiment } = await deployed(database);
  const run = (sql: string, args: Array<string | number | null>) =>
    database.client.execute({ sql, args });
  await run(
    "UPDATE opportunity_proposals SET change_kind = 'jsx_attribute' WHERE id = ?",
    [input.proposal.id],
  );
  const auditId = crypto.randomUUID();
  await run(
    "INSERT INTO audits (id, project_id, started_by_user_id, start_url, status) VALUES (?, ?, 'owner', 'https://example.com/', 'completed')",
    [auditId, input.projectId],
  );
  for (const path of ["/a", "/b"]) {
    const [pageId, resultId] = [crypto.randomUUID(), crypto.randomUUID()];
    await run(
      "INSERT INTO audit_pages (id, audit_id, url, status_code) VALUES (?, ?, ?, 200)",
      [pageId, auditId, `https://example.com${path}`],
    );
    await run(
      "INSERT INTO audit_accessibility_results (id, audit_id, page_id, axe_version, ran_at, violation_count) VALUES (?, ?, ?, '4.13.0', ?, 1)",
      [resultId, auditId, pageId, new Date().toISOString()],
    );
    await run(
      "INSERT INTO audit_accessibility_violations (id, result_id, rule_id, impact, wcag_tags, target_selector, html_snippet, failure_summary, cluster_key) VALUES (?, ?, 'image-alt', 'critical', 'wcag2a', 'main > img', '<img>', 'Fix', 'cluster')",
      [crypto.randomUUID(), resultId],
    );
  }
  await run(
    "INSERT INTO opportunity_accessibility_evidence (id, project_id, opportunity_id, run_id, audit_id, cluster_key, rule_id, impact, wcag_tags, pages_affected, example_url, example_selector, example_snippet) VALUES (?, ?, ?, ?, ?, 'cluster', 'image-alt', 'critical', 'wcag2a', 2, 'https://example.com/a', 'main > img', '<img>')",
    [
      crypto.randomUUID(),
      input.projectId,
      input.proposal.opportunityId,
      input.proposal.evidenceRunId,
      auditId,
    ],
  );
  return {
    context: {
      organizationId: input.organizationId,
      userId: "reviewer",
      userEmail: "reviewer@example.com",
      role: "owner",
    },
    scope: { projectId: input.projectId, experimentId: experiment.id },
  };
}

it("checks the cluster's pages again and stores the pages that still fail", async () => {
  const { context, scope } = await deployedFix();
  mocks.quickAction.mockImplementation(async (_action, options) =>
    options.url.endsWith("/a") ? page("image-alt") : page("color-contrast"),
  );
  expect(await AccessibilityCheckService.check(context, scope)).toEqual({
    ok: true,
    message: "Not fixed: image-alt still fails on 1 of 2 checked pages.",
  });
  const latest = await AccessibilityCheckService.latest(context, scope);
  expect(
    latest?.pages.map((item) => [new URL(item.url).pathname, item.outcome]),
  ).toEqual([
    ["/a", "failed"],
    ["/b", "passed"],
  ]);
  expect(mocks.settle).toHaveBeenCalledWith(
    expect.objectContaining({
      usage: { cloudflareAttempts: 2, contextCredits: 0 },
    }),
  );
});

it("counts a fix whose check passed, and each audit's serious violations", async () => {
  const { context, scope } = await deployedFix();
  mocks.quickAction.mockImplementation(async () => page("color-contrast"));
  await AccessibilityCheckService.check(context, scope);
  expect(
    await AccessibilityCheckService.trend(context, scope.projectId),
  ).toMatchObject({
    audits: [{ pagesChecked: 2, seriousViolations: 2 }],
    fixesPassed: 1,
  });
});

it("gives the statement the latest audit's pages and failing rules", async () => {
  const { context, scope } = await deployedFix();
  expect(
    await AccessibilityCheckService.statement(context, scope.projectId),
  ).toMatchObject({
    site: "https://example.com/",
    pagesChecked: 2,
    rules: [{ ruleId: "image-alt", impact: "critical", pages: 2 }],
  });
});
