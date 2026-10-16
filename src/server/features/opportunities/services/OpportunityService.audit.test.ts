import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpportunityService } from "./OpportunityService";
import {
  context,
  projectId,
  response,
  setServiceMockDefaults,
  siteUrl,
} from "./opportunityServiceTestMocks";

const mocks = await vi.hoisted(async () => {
  const { createServiceMocks } = await import("./opportunityServiceTestMocks");
  return createServiceMocks();
});
vi.mock("./BrandTermService", () => ({
  BrandTermService: { get: mocks.brandTerms },
}));
vi.mock("@/server/features/ga4/repositories/Ga4ConnectionRepository", () => ({
  Ga4ConnectionRepository: { getByProjectId: mocks.ga4Connection },
}));
vi.mock("./opportunityGa4", () => ({ fetchGa4LandingPages: mocks.ga4Rows }));
vi.mock("@/server/features/projects/repositories/ProjectRepository", () => ({
  ProjectRepository: { getProjectForOrganization: mocks.project },
}));
vi.mock("@/server/features/gsc/services/GscService", () => ({
  GscService: {
    getConnection: mocks.connection,
    getPerformance: mocks.performance,
    inspectUrls: mocks.inspect,
  },
}));
vi.mock("../repositories/opportunitySignals", () => ({
  OpportunitySignalRepository: {
    latestAudit: mocks.latestAudit,
    rankHistory: mocks.rankHistory,
    inspectionRequestsSince: mocks.inspectionsToday,
  },
}));
vi.mock(
  "@/server/features/project-context/repositories/ProjectContextRepository",
  () => ({ ProjectContextRepository: { listKeyPages: mocks.keyPages } }),
);
vi.mock(
  "@/server/features/dashboard/repositories/DataRefreshClaimRepository",
  () => ({
    DataRefreshClaimRepository: { claim: mocks.claim, finish: mocks.finish },
  }),
);
vi.mock("../repositories/OpportunityRepository", () => ({
  OpportunityRepository: {
    list: mocks.list,
    latestRun: mocks.latestRun,
    listRuns: mocks.listRuns,
    getDetail: mocks.detail,
    startRun: mocks.startRun,
    setRequestCount: mocks.setRequestCount,
    completeRun: mocks.completeRun,
    failRun: mocks.failRun,
    review: mocks.review,
    cachedKeywordDifficulty: mocks.difficulty,
  },
}));
beforeEach(() => setServiceMockDefaults(mocks));
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const page = (path: string) => `${siteUrl}${path}`;
const pageRow = (path: string) => ({
  keys: [page(path)],
  clicks: 0,
  impressions: 80,
  ctr: 0,
  position: 9,
});
const issue = (path: string, issueType: string) => ({
  id: `${issueType}-${path}`,
  issueType,
  severity: "critical" as const,
  pageUrl: page(path),
});

beforeEach(() => {
  mocks.latestAudit.mockResolvedValue({
    auditId: "audit-1",
    completedAt: "2026-10-10T00:00:00.000Z",
    issues: [
      issue("a", "noindex-page"),
      issue("a", "canonical-conflict"),
      issue("b", "missing-title"),
    ],
    pages: [],
    inlinks: new Map(),
  });
  mocks.performance
    .mockResolvedValueOnce(response())
    .mockResolvedValueOnce(response([pageRow("a"), pageRow("b")]));
});

describe("OpportunityService audit signals", () => {
  it("inspects indexing blockers within the daily limit and confirms them", async () => {
    mocks.inspectionsToday.mockResolvedValue(45);
    mocks.inspect.mockResolvedValue({
      results: [
        {
          url: page("a"),
          result: {
            indexStatusResult: {
              verdict: "FAIL",
              coverageState: "Excluded by noindex tag",
            },
          },
        },
      ],
    });
    const result = await OpportunityService.detect(context, projectId);
    expect(mocks.setRequestCount).toHaveBeenCalledWith(
      projectId,
      "run-1",
      10,
      5,
    );
    expect(mocks.inspect).toHaveBeenCalledWith({
      projectId,
      urls: [page("a")],
    });
    const candidates = mocks.completeRun.mock.lastCall![0].candidates;
    const blockers = candidates.filter(
      (candidate) => candidate.type === "technical_blocker",
    );
    expect(
      blockers.map((candidate) => [
        candidate.url,
        candidate.audit!.issueType,
        candidate.confidence,
      ]),
    ).toEqual(
      expect.arrayContaining([
        [page("a"), "noindex-page", 0.7],
        [page("a"), "canonical-conflict", 0.7],
        [page("b"), "missing-title", 0.5],
      ]),
    );
    // Identity includes the issue type, so one page can hold two blockers.
    expect(new Set(blockers.map((item) => item.identityKey)).size).toBe(3);
    expect(result.run).toMatchObject({ auditId: "audit-1" });
    expect(result.message).toContain(
      "The latest audit has no internal-link data.",
    );
  });

  it("skips inspection at the daily limit and says so", async () => {
    mocks.inspectionsToday.mockResolvedValue(50);
    const result = await OpportunityService.detect(context, projectId);
    expect(mocks.inspect).not.toHaveBeenCalled();
    expect(result.run).toMatchObject({ requestCount: 5 });
    expect(result.message).toContain("used its daily limit");
  });

  it("names the missing audit and inspects nothing", async () => {
    mocks.latestAudit.mockResolvedValue(null);
    const result = await OpportunityService.detect(context, projectId);
    expect(mocks.inspect).not.toHaveBeenCalled();
    expect(result.run).toMatchObject({ requestCount: 5, auditId: null });
    expect(result.message).toContain("No recent site audit.");
  });
});
