import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/server/lib/errors";
import { ContentGapService } from "./ContentGapService";
import { opportunityDetail } from "./opportunityTestFixtures";
import { SerpCheckService } from "./SerpCheckService";

const mocks = vi.hoisted(() => ({
  project: vi.fn(),
  competitors: vi.fn(),
  keyPages: vi.fn(),
  fresh: vi.fn(),
  saveSnapshot: vi.fn(),
  snapshotKeywords: vi.fn(),
  aiCitations: vi.fn(),
  saveSerpCheck: vi.fn(),
  latestRun: vi.fn(),
  listRuns: vi.fn(),
  startRun: vi.fn(),
  completeRun: vi.fn(),
  failRun: vi.fn(),
  detail: vi.fn(),
  rankHistory: vi.fn(),
  claim: vi.fn(),
  finish: vi.fn(),
  connection: vi.fn(),
  performance: vi.fn(),
  ga4: vi.fn(),
  client: vi.fn(),
  rankedKeywords: vi.fn(),
  serpLive: vi.fn(),
}));
vi.mock("cloudflare:workers", () => ({ env: {}, waitUntil: vi.fn() }));
vi.mock("./opportunityGa4", () => ({ fetchGa4LandingPages: vi.fn() }));
vi.mock("@/server/features/projects/repositories/ProjectRepository", () => ({
  ProjectRepository: { getProjectForOrganization: mocks.project },
}));
vi.mock(
  "@/server/features/project-context/repositories/ProjectContextRepository",
  () => ({
    ProjectContextRepository: {
      listCompetitors: mocks.competitors,
      listKeyPages: mocks.keyPages,
    },
  }),
);
vi.mock("../repositories/contentGapRepository", () => ({
  ContentGapRepository: {
    freshSnapshots: mocks.fresh,
    saveSnapshot: mocks.saveSnapshot,
    snapshotKeywords: mocks.snapshotKeywords,
    aiCitations: mocks.aiCitations,
    saveSerpCheck: mocks.saveSerpCheck,
  },
  serpReason: () => "a live results check found ads above the page",
}));
vi.mock("../repositories/OpportunityRepository", () => ({
  OpportunityRepository: {
    latestRun: mocks.latestRun,
    listRuns: mocks.listRuns,
    startRun: mocks.startRun,
    completeRun: mocks.completeRun,
    failRun: mocks.failRun,
    getDetail: mocks.detail,
  },
}));
vi.mock("../repositories/opportunitySignals", () => ({
  OpportunitySignalRepository: { rankHistory: mocks.rankHistory },
}));
vi.mock(
  "@/server/features/dashboard/repositories/DataRefreshClaimRepository",
  () => ({
    DataRefreshClaimRepository: { claim: mocks.claim, finish: mocks.finish },
  }),
);
vi.mock("@/server/features/gsc/services/GscService", () => ({
  GscService: {
    getConnection: mocks.connection,
    getPerformance: mocks.performance,
  },
}));
vi.mock("@/server/features/ga4/repositories/Ga4ConnectionRepository", () => ({
  Ga4ConnectionRepository: { getByProjectId: mocks.ga4 },
}));
// The metered client: its own tests prove the hold before the call, the
// refusal without a call and the settlement at the provider's billed cost.
vi.mock("@/server/lib/dataforseo/client", () => ({
  createDataforseoClient: mocks.client,
}));

const context = {
  organizationId: "org-1",
  userId: "user-1",
  userEmail: "owner@example.com",
  role: "owner",
};
const projectId = "project-1";
const siteUrl = "sc-domain:example.com";
const rankedItem = (keyword: string) => ({
  keyword_data: {
    keyword,
    keyword_info: { search_volume: 120 },
    keyword_properties: { keyword_difficulty: 30 },
    search_intent_info: { main_intent: "commercial" },
  },
  ranked_serp_element: {
    serp_item: { rank_group: 4, url: "https://rival.com/crm" },
  },
});

beforeEach(() => {
  mocks.project.mockResolvedValue({
    id: projectId,
    locationCode: 2840,
    languageCode: "en",
  });
  mocks.competitors.mockResolvedValue([
    { domain: "rival.com" },
    { domain: "other.com" },
  ]);
  mocks.keyPages.mockResolvedValue([]);
  mocks.fresh.mockResolvedValue(new Map());
  mocks.saveSnapshot.mockResolvedValue("snapshot-new");
  mocks.snapshotKeywords.mockResolvedValue([]);
  mocks.aiCitations.mockResolvedValue(null);
  mocks.latestRun.mockResolvedValue(null);
  mocks.listRuns.mockResolvedValue([]);
  mocks.startRun.mockResolvedValue(undefined);
  mocks.completeRun.mockResolvedValue(true);
  mocks.failRun.mockResolvedValue(undefined);
  mocks.rankHistory.mockResolvedValue(new Map());
  mocks.claim.mockResolvedValue("run-1");
  mocks.finish.mockResolvedValue(undefined);
  mocks.connection.mockResolvedValue({ siteUrl });
  mocks.performance.mockResolvedValue({ siteUrl, rows: [] });
  mocks.ga4.mockResolvedValue(null);
  mocks.client.mockReturnValue({
    domain: { rankedKeywords: mocks.rankedKeywords },
    serp: { live: mocks.serpLive },
  });
  mocks.rankedKeywords.mockResolvedValue({
    items: [rankedItem("crm pricing")],
    totalCount: 1,
  });
});

describe("ContentGapService", () => {
  it("estimates each competitor before any paid call, and saved data is free", async () => {
    mocks.fresh.mockResolvedValue(new Map([["other.com", "snapshot-1"]]));
    const estimate = await ContentGapService.estimate(context, projectId, [
      "rival.com",
      "other.com",
    ]);
    expect(estimate.domains).toMatchObject([
      { domain: "rival.com", cached: false },
      { domain: "other.com", cached: true, credits: 0 },
    ]);
    expect(estimate.totalCredits).toBe(estimate.domains[0].credits);
    expect(estimate.totalCredits).toBeGreaterThan(0);
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("refuses competitors outside the project context, or more than three", async () => {
    await expect(
      ContentGapService.estimate(context, projectId, ["stranger.com"]),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      ContentGapService.estimate(context, projectId, ["a", "b", "c", "d"]),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("buys nothing when the estimate rose above the confirmed credits", async () => {
    await expect(
      ContentGapService.detect(context, {
        projectId,
        domains: ["rival.com"],
        confirmedCredits: 0,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.rankedKeywords).not.toHaveBeenCalled();
  });

  it("buys through the metered client, saves the rows and finds the gaps", async () => {
    const { totalCredits } = await ContentGapService.estimate(
      context,
      projectId,
      ["rival.com"],
    );
    const result = await ContentGapService.detect(context, {
      projectId,
      domains: ["rival.com"],
      confirmedCredits: totalCredits,
    });
    expect(result.outcome).toBe("completed");
    expect(mocks.client).toHaveBeenCalledWith({ ...context, projectId });
    expect(mocks.rankedKeywords).toHaveBeenCalledWith(
      expect.objectContaining({
        target: "rival.com",
        locationCode: 2840,
        limit: 1000,
        creditFeature: "domain_overview",
      }),
    );
    expect(mocks.saveSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: "rival.com",
        estimatedCredits: totalCredits,
        rows: [
          {
            keyword: "crm pricing",
            position: 4,
            url: "https://rival.com/crm",
            searchVolume: 120,
            keywordDifficulty: 30,
            intent: "commercial",
          },
        ],
      }),
    );
    expect(mocks.snapshotKeywords).toHaveBeenCalledWith(projectId, [
      "snapshot-new",
    ]);
    expect(mocks.finish).toHaveBeenCalledWith(
      "opportunities:content-gap:project-1",
      "run-1",
      86_400_000,
    );
  });

  it("reuses data younger than 30 days without a second purchase", async () => {
    mocks.fresh.mockResolvedValue(new Map([["rival.com", "snapshot-1"]]));
    const result = await ContentGapService.detect(context, {
      projectId,
      domains: ["rival.com"],
      confirmedCredits: 0,
    });
    expect(result.outcome).toBe("completed");
    expect(mocks.rankedKeywords).not.toHaveBeenCalled();
    expect(mocks.snapshotKeywords).toHaveBeenCalledWith(projectId, [
      "snapshot-1",
    ]);
    expect(result.run).toMatchObject({ kind: "content_gap", requestCount: 1 });
  });

  it("explains a refused credit hold and keeps nothing half-bought", async () => {
    mocks.rankedKeywords.mockRejectedValue(
      new AppError("INSUFFICIENT_CREDITS"),
    );
    const result = await ContentGapService.detect(context, {
      projectId,
      domains: ["rival.com"],
      confirmedCredits: 1_000,
    });
    expect(result).toMatchObject({ outcome: "failed" });
    expect(result.message).toContain("Not enough credits");
    expect(mocks.saveSnapshot).not.toHaveBeenCalled();
    expect(mocks.completeRun).not.toHaveBeenCalled();
    expect(mocks.finish).toHaveBeenCalledWith(
      "opportunities:content-gap:project-1",
      "run-1",
      300_000,
    );
  });
});

describe("SerpCheckService", () => {
  function lowCtr() {
    const detail = opportunityDetail();
    detail.opportunity.type = "low_ctr";
    detail.opportunity.url = "https://example.com/pricing";
    detail.evidence = [
      {
        id: "e1",
        opportunityId: detail.opportunity.id,
        runId: detail.opportunity.evidenceRunId,
        source: "google_search_console",
        period: "current",
        startDate: "2026-09-13",
        endDate: "2026-10-10",
        url: "",
        query: "crm pricing",
        clicks: 1,
        impressions: 900,
        ctr: 0.001,
        position: 4,
      },
    ];
    return detail;
  }

  it.each([
    [
      "ads above the page lower confidence by 0.15",
      [
        { type: "paid", rank_absolute: 1 },
        {
          type: "organic",
          rank_absolute: 2,
          url: "https://example.com/pricing/",
        },
      ],
      -0.15,
      0.4,
    ],
    [
      "a clean results page raises confidence by 0.10",
      [
        {
          type: "organic",
          rank_absolute: 1,
          url: "https://example.com/pricing",
        },
        { type: "paid", rank_absolute: 5 },
      ],
      0.1,
      0.65,
    ],
  ])("%s", async (_name, items, delta, confidence) => {
    mocks.detail.mockResolvedValue(lowCtr());
    mocks.serpLive.mockResolvedValue(items);
    const { credits } = await SerpCheckService.estimate(
      context,
      projectId,
      "opportunity-1",
    );
    const check = await SerpCheckService.check(context, {
      projectId,
      opportunityId: "opportunity-1",
      confirmedCredits: credits,
    });
    expect(check).toMatchObject({
      keyword: "crm pricing",
      confidenceDelta: delta,
    });
    expect(mocks.saveSerpCheck.mock.lastCall![2]).toMatchObject({
      confidence,
    });
  });

  it("reuses a check from the last 24 hours without a paid call", async () => {
    const detail = lowCtr();
    detail.serpChecks = [
      {
        id: "check-1",
        opportunityId: detail.opportunity.id,
        keyword: "crm pricing",
        pagePosition: 3,
        hasAds: true,
        hasAiOverview: false,
        hasFeaturedSnippet: false,
        confidenceDelta: -0.15,
        estimatedCredits: 2,
        checkedAt: new Date(Date.now() - 3_600_000).toISOString(),
      },
    ];
    mocks.detail.mockResolvedValue(detail);
    expect(
      await SerpCheckService.estimate(context, projectId, "opportunity-1"),
    ).toMatchObject({ credits: 0 });
    expect(
      await SerpCheckService.check(context, {
        projectId,
        opportunityId: "opportunity-1",
        confirmedCredits: 0,
      }),
    ).toMatchObject({ id: "check-1" });
    expect(mocks.serpLive).not.toHaveBeenCalled();
  });

  it("checks only low click-through opportunities", async () => {
    mocks.detail.mockResolvedValue(opportunityDetail());
    await expect(
      SerpCheckService.estimate(context, projectId, "opportunity-1"),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
