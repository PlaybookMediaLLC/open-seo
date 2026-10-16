import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { saveKeyPageInlinks } from "../audit/saveKeyPageInlinks";
import { OpportunityRepository as repo } from "./OpportunityRepository";
import { OpportunitySignalRepository as signals } from "./opportunitySignals";
import {
  candidate,
  finishRun,
  setupRun,
} from "./opportunityRepositoryTestSupport";

const PREFIX = "opportunity-signals-test-";
const database = await vi.hoisted(async () => {
  const { createOpportunityTestDatabase } =
    await import("./opportunityRepositoryTestDb");
  // Its own cleanup prefix, so parallel Postgres test files keep their rows.
  return createOpportunityTestDatabase("opportunity-signals-test-");
});
const { client } = database;
const mocks = vi.hoisted(() => ({ keyPages: vi.fn(), listInlinks: vi.fn() }));
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
vi.mock("@/server/features/audit/AuditScratchpad", () => ({
  getAuditScratchpad: () => ({ listInlinks: mocks.listInlinks }),
}));
vi.mock(
  "@/server/features/project-context/repositories/ProjectContextRepository",
  () => ({ ProjectContextRepository: { listKeyPages: mocks.keyPages } }),
);
beforeAll(() => database.prepare());
afterAll(() => database.close());

const page = (path: string) => `https://example.com/${path}`;
const run = (sql: string, args: Array<string | number | null>) =>
  client.execute({ sql, args });

async function addAudit(
  projectId: string,
  status: string,
  completedAt: string | null,
) {
  const id = crypto.randomUUID();
  await run(
    "INSERT INTO audits (id, project_id, started_by_user_id, start_url, status, completed_at) VALUES (?, ?, 'user', ?, ?, ?)",
    [id, projectId, page(""), status, completedAt],
  );
  return id;
}
async function addPage(auditId: string, url: string, statusCode = 200) {
  const id = crypto.randomUUID();
  await run(
    "INSERT INTO audit_pages (id, audit_id, url, status_code) VALUES (?, ?, ?, ?)",
    [id, auditId, url, statusCode],
  );
  return id;
}
async function addIssue(auditId: string, url: string, issueType: string) {
  const id = crypto.randomUUID();
  await run(
    "INSERT INTO audit_issues (id, audit_id, page_url, issue_type, severity) VALUES (?, ?, ?, ?, 'critical')",
    [id, auditId, url, issueType],
  );
  return id;
}
const daysAgo = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString();

describe(`Opportunity signals real ${database.isPostgres ? "Postgres" : "SQLite"}`, () => {
  it("reads the newest recent completed audit of the project, with its issues and inlinks", async () => {
    const { run: own } = await setupRun(client, PREFIX);
    const { run: other } = await setupRun(client, PREFIX);
    await addAudit(own.projectId, "completed", daysAgo(40));
    await addAudit(own.projectId, "running", null);
    await addAudit(other.projectId, "completed", daysAgo(0));
    await addAudit(own.projectId, "completed", daysAgo(5));
    const latest = await addAudit(own.projectId, "completed", daysAgo(2));
    const target = await addPage(latest, `${page("pricing")}/`);
    const source = await addPage(latest, page("blog"));
    await addIssue(latest, page("blog"), "noindex-page");
    await addIssue(latest, page("blog"), "missing-alt-text");
    await run(
      "INSERT INTO audit_page_inlinks (id, project_id, audit_id, target_page_id, source_page_id) VALUES (?, ?, ?, ?, ?)",
      [crypto.randomUUID(), own.projectId, latest, target, source],
    );
    const result = await signals.latestAudit(own.projectId, daysAgo(30), [
      "noindex-page",
    ]);
    expect(result).toMatchObject({
      auditId: latest,
      issues: [{ issueType: "noindex-page", pageUrl: page("blog") }],
    });
    expect(result!.pages).toHaveLength(2);
    expect(result!.inlinks).toEqual(
      new Map([[page("pricing"), new Set([page("blog")])]]),
    );
    expect(
      await signals.latestAudit(own.projectId, daysAgo(1), ["noindex-page"]),
    ).toBeNull();
  });

  it("keeps the first and last rank check per keyword and device, for the project only", async () => {
    const { run: own } = await setupRun(client, PREFIX);
    const { run: other } = await setupRun(client, PREFIX);
    const dates = [daysAgo(20), daysAgo(10), daysAgo(1)];
    // One rank check run per date: a run has one snapshot per keyword and device.
    for (const projectId of [own.projectId, other.projectId]) {
      const configId = `config-${projectId}`;
      await run(
        "INSERT INTO rank_tracking_configs (id, project_id, domain, serp_depth) VALUES (?, ?, 'example.com', 20)",
        [configId, projectId],
      );
      for (const [index, position] of [14, 11, 9].entries()) {
        const runId = `rank-run-${index}-${projectId}`;
        await run(
          "INSERT INTO rank_check_runs (id, config_id, project_id, status) VALUES (?, ?, ?, 'completed')",
          [runId, configId, projectId],
        );
        await run(
          "INSERT INTO rank_snapshots (run_id, tracking_keyword_id, keyword, device, position, checked_at) VALUES (?, ?, 'Widgets', 'mobile', ?, ?)",
          [runId, `keyword-${projectId}`, position, dates[index]],
        );
      }
    }
    expect(await signals.rankHistory(own.projectId, daysAgo(30))).toEqual(
      new Map([
        [
          "widgets",
          [
            {
              trackingKeywordId: `keyword-${own.projectId}`,
              device: "mobile",
              firstPosition: 14,
              lastPosition: 9,
              firstCheckedAt: dates[0],
              lastCheckedAt: dates[2],
            },
          ],
        ],
      ]),
    );
  });

  it("sums the URL inspections that the project's runs reserved since a time", async () => {
    const first = await setupRun(client, PREFIX);
    await repo.setRequestCount(first.run.projectId, first.run.id, 15, 10);
    const next = { ...first.run, id: crypto.randomUUID() };
    await repo.startRun(next);
    await repo.setRequestCount(next.projectId, next.id, 10, 5);
    expect(
      await signals.inspectionRequestsSince(first.run.projectId, daysAgo(1)),
    ).toBe(15);
    expect(
      await signals.inspectionRequestsSince(first.run.projectId, daysAgo(-1)),
    ).toBe(0);
  });

  it("stores and reads audit, inspection, link and rank evidence per project", async () => {
    const input = await setupRun(client, PREFIX);
    const { projectId } = input.run;
    const auditId = await addAudit(projectId, "completed", daysAgo(1));
    const issueId = await addIssue(auditId, page("a"), "noindex-page");
    const opportunity = await finishRun(input, [
      candidate({
        audit: {
          auditId,
          auditIssueId: issueId,
          issueType: "noindex-page",
          severity: "critical",
          pageUrl: page("a"),
          auditCompletedAt: daysAgo(1),
        },
        inspection: {
          url: page("a"),
          verdict: "FAIL",
          coverageState: "Excluded by noindex tag",
          indexingState: "BLOCKED_BY_META_TAG",
          robotsTxtState: "ALLOWED",
          pageFetchState: "SUCCESSFUL",
          googleCanonical: null,
          userCanonical: null,
          lastCrawlTime: null,
          inspectedAt: daysAgo(0),
        },
        link: {
          auditId,
          sourceUrl: page("blog"),
          targetUrl: page("a"),
          sharedQuery: "widgets",
          sourceImpressions: 300,
          sourcePosition: 12,
        },
        rank: [
          {
            trackingKeywordId: "keyword-1",
            device: "desktop",
            firstPosition: null,
            lastPosition: 8,
            firstCheckedAt: daysAgo(20),
            lastCheckedAt: daysAgo(1),
          },
        ],
      }),
    ]);
    expect(await repo.getDetail(projectId, opportunity.id)).toMatchObject({
      auditEvidence: [{ auditIssueId: issueId, issueType: "noindex-page" }],
      inspectionEvidence: [{ verdict: "FAIL" }],
      linkEvidence: [{ sharedQuery: "widgets", sourcePosition: 12 }],
      rankEvidence: [{ firstPosition: null, lastPosition: 8 }],
    });
    const { run: foreign } = await setupRun(client, PREFIX);
    expect(
      await signals.evidenceFor(foreign.projectId, opportunity.id),
    ).toEqual({
      auditEvidence: [],
      inspectionEvidence: [],
      linkEvidence: [],
      rankEvidence: [],
    });
    // Deleting the audit removes its evidence and keeps the run.
    await run("DELETE FROM audits WHERE id = ?", [auditId]);
    expect(
      (await repo.getDetail(projectId, opportunity.id))?.auditEvidence,
    ).toEqual([]);
    expect(await repo.latestRun(projectId)).toMatchObject({ auditId: null });
  });

  it("saves inlinks of money and hub pages once, and never fails the audit", async () => {
    const { run: own } = await setupRun(client, PREFIX);
    const auditId = await addAudit(own.projectId, "running", null);
    await addPage(auditId, page("pricing"));
    await addPage(auditId, page("guide"));
    await addPage(auditId, page("blog"));
    mocks.keyPages.mockResolvedValue([
      { url: `${page("pricing")}/`, role: "money" },
      { url: page("guide"), role: "spoke" },
    ]);
    mocks.listInlinks.mockResolvedValue([
      {
        target_url: page("pricing"),
        source_page_id: "x",
        source_url: page("blog"),
      },
      {
        target_url: page("pricing"),
        source_page_id: "y",
        source_url: page("gone"),
      },
    ]);
    const save = () =>
      saveKeyPageInlinks({ auditId, projectId: own.projectId });
    expect(await save()).toEqual({ saved: 1 });
    expect(mocks.listInlinks).toHaveBeenCalledWith([page("pricing")]);
    expect(await save()).toEqual({ saved: 1 });
    const saved = await run(
      "SELECT count(*) AS n FROM audit_page_inlinks WHERE audit_id = ?",
      [auditId],
    );
    expect(Number(saved.rows[0].n)).toBe(1);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.listInlinks.mockRejectedValue(new Error("scratchpad gone"));
    expect(await save()).toEqual({ saved: 0 });
    expect(error).toHaveBeenCalledOnce();
  });
});
