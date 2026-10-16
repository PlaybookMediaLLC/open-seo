import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GscApiError } from "@/server/lib/gscErrors";
import { OpportunityService } from "./OpportunityService";
import { opportunityRun as run } from "./opportunityTestFixtures";
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
vi.mock("@/server/auth/repositories/AuthRepository", () => ({
  AuthRepository: {
    getMembership: mocks.membership,
    getHostedUserNames: mocks.userNames,
  },
}));
vi.mock("../repositories/contentGapRepository", () => ({
  ContentGapRepository: {
    aiCitations: mocks.aiCitations,
    recentSerpChecks: mocks.serpChecks,
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

describe("OpportunityService detection", () => {
  it.each(["not_connected", "cached", "busy"] as const)(
    "returns %s without starting provider work",
    async (outcome) => {
      if (outcome === "not_connected") mocks.connection.mockResolvedValue(null);
      if (outcome === "cached") mocks.latestRun.mockResolvedValue(run());
      if (outcome === "busy") mocks.claim.mockResolvedValue(null);
      expect(await OpportunityService.detect(context, projectId)).toMatchObject(
        { outcome },
      );
      expect(mocks.performance).not.toHaveBeenCalled();
      expect(mocks.startRun).not.toHaveBeenCalled();
    },
  );

  it("uses five bounded final-data requests over 28-day Pacific windows and their year-ago windows", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T01:00:00Z"));
    const result = await OpportunityService.detect(context, projectId);
    expect(result).toMatchObject({
      outcome: "completed",
      run: {
        startDate: "2026-09-13",
        endDate: "2026-10-10",
        previousStartDate: "2026-08-16",
        previousEndDate: "2026-09-12",
        requestCount: 5,
        ga4PropertyId: null,
      },
    });
    expect(result.message).toContain("GA4 is not connected");
    const request = {
      projectId,
      rowLimit: 1000,
      type: "web",
      dataState: "final",
      dimensions: ["page"],
    };
    expect(mocks.performance.mock.calls.map(([call]) => call)).toEqual([
      {
        ...request,
        rowLimit: 5000,
        startDate: "2026-09-13",
        endDate: "2026-10-10",
        dimensions: ["query", "page"],
      },
      { ...request, startDate: "2026-09-13", endDate: "2026-10-10" },
      { ...request, startDate: "2026-08-16", endDate: "2026-09-12" },
      { ...request, startDate: "2025-09-14", endDate: "2025-10-11" },
      { ...request, startDate: "2025-08-17", endDate: "2025-09-13" },
    ]);
    expect(mocks.ga4Rows).not.toHaveBeenCalled();
  });

  it("reserves one GA4 report and degrades to page roles when it fails", async () => {
    const connection = {
      propertyId: "properties/1",
      propertyCurrencyCode: "USD",
    };
    mocks.ga4Connection.mockResolvedValue(connection);
    const completed = await OpportunityService.detect(context, projectId);
    expect(completed.run).toMatchObject({
      requestCount: 6,
      ga4PropertyId: "properties/1",
    });
    expect(mocks.ga4Rows).toHaveBeenCalledWith(
      connection,
      { startDate: completed.run!.startDate, endDate: completed.run!.endDate },
      {
        startDate: completed.run!.previousStartDate,
        endDate: completed.run!.previousEndDate,
      },
    );
    mocks.ga4Rows.mockRejectedValue(new Error("GA4 quota"));
    const degraded = await OpportunityService.detect(context, projectId);
    expect(degraded).toMatchObject({
      outcome: "completed",
      run: { requestCount: 6, ga4PropertyId: null },
    });
    expect(degraded.message).toContain("The GA4 report failed");
  });

  it("keeps identity hashes for existing types and ignores roles for a URL pair", async () => {
    const queryRow = (query: string, path: string, clicks: number) => ({
      keys: [query, `${siteUrl}${path}`],
      clicks,
      impressions: 300,
      ctr: clicks / 300,
      position: 10,
    });
    const pageRow = (clicks: number) => ({
      keys: [`${siteUrl}pricing`],
      clicks,
      impressions: 1000,
      ctr: clicks / 1000,
      position: 5,
    });
    async function identities(firstClicks: number, secondClicks: number) {
      mocks.performance
        .mockResolvedValueOnce(
          response([
            queryRow("software", "pricing", firstClicks),
            queryRow("software", "pricing-b", secondClicks),
            queryRow("tools", "pricing", firstClicks),
            queryRow("tools", "pricing-b", secondClicks),
          ]),
        )
        .mockResolvedValueOnce(response([pageRow(10)]))
        .mockResolvedValueOnce(response([pageRow(100)]));
      await OpportunityService.detect(context, projectId);
      const [{ candidates }] = mocks.completeRun.mock.lastCall!;
      return Object.fromEntries(
        candidates.map(
          (candidate: {
            type: string;
            query: string | null;
            identityKey: string;
          }) => [
            `${candidate.type}:${candidate.query ?? ""}`,
            candidate.identityKey,
          ],
        ),
      );
    }
    const first = await identities(10, 5);
    // SHA-256 of the original tuple [projectId, siteUrl, type, url, query].
    expect(first).toMatchObject({
      "striking_distance:software":
        "9cb466273910fad3f57bd718a0e058f44ad10073abcfba4aa8bb96eba58c2c1e",
      "declining_page:":
        "b2498ed88e0f8fbfdb40f5f0772fa60d7e137ca247051ddfcf3260785cc1c9e2",
    });
    const swapped = await identities(5, 10);
    expect(swapped["cannibalization:"]).toBeDefined();
    expect(swapped["cannibalization:"]).toBe(first["cannibalization:"]);
  });

  it("reads cached keyword difficulty and makes no other network call", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T01:00:00Z"));
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    mocks.difficulty.mockResolvedValue(new Map([["software", 40]]));
    mocks.performance.mockResolvedValueOnce(
      response([
        {
          keys: ["software", `${siteUrl}pricing`],
          clicks: 10,
          impressions: 1000,
          ctr: 0.01,
          position: 10,
        },
      ]),
    );
    await OpportunityService.detect(context, projectId);
    expect(mocks.difficulty).toHaveBeenCalledWith({
      projectId,
      locationCode: 2840,
      languageCode: "en",
      since: "2026-07-16T01:00:00.000Z",
    });
    expect(mocks.completeRun.mock.lastCall![0].candidates).toMatchObject([
      { type: "striking_distance", difficultyScore: 0.4 },
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("publishes no partial candidates when one upstream request fails and sanitizes the failed run", async () => {
    mocks.performance
      .mockResolvedValueOnce(
        response([
          {
            keys: ["software", `${siteUrl}pricing`],
            clicks: 10,
            impressions: 1000,
            ctr: 0.01,
            position: 10,
          },
        ]),
      )
      .mockRejectedValueOnce(
        new GscApiError(503, "Bearer secret-token", "private provider payload"),
      );
    const result = await OpportunityService.detect(context, projectId);
    expect(result).toMatchObject({
      outcome: "failed",
      run: { status: "failed" },
    });
    expect(mocks.completeRun).not.toHaveBeenCalled();
    expect(mocks.failRun).toHaveBeenCalledWith(
      projectId,
      "run-1",
      result.message,
    );
    expect(JSON.stringify(result)).not.toMatch(
      /secret-token|private provider payload/,
    );
    expect(
      mocks.performance.mock.calls.every(
        ([, options]) => options?.signal?.aborted,
      ),
    ).toBe(true);
  });

  it("starts no provider requests when the deadline expires during database setup", async () => {
    const deadline = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
    mocks.keyPages.mockImplementationOnce(async () => {
      deadline.abort();
      return [];
    });
    expect(await OpportunityService.detect(context, projectId)).toMatchObject({
      outcome: "failed",
    });
    expect(mocks.performance).not.toHaveBeenCalled();
    expect(mocks.completeRun).not.toHaveBeenCalled();
  });

  it("fails instead of waiting indefinitely for a stalled provider", async () => {
    const deadline = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
    mocks.performance.mockImplementationOnce(() => {
      deadline.abort();
      return new Promise(() => {});
    });
    expect(await OpportunityService.detect(context, projectId)).toMatchObject({
      outcome: "failed",
    });
    expect(mocks.completeRun).not.toHaveBeenCalled();
    expect(mocks.failRun).toHaveBeenCalledOnce();
  });

  it("rejects changed property responses before publishing evidence", async () => {
    mocks.performance.mockResolvedValueOnce({
      siteUrl: "https://different.example/",
      rows: [],
    });
    expect(await OpportunityService.detect(context, projectId)).toMatchObject({
      outcome: "failed",
    });
    expect(mocks.completeRun).not.toHaveBeenCalled();
  });

  it("reports a failed run when the atomic persistence fence refuses publication", async () => {
    mocks.completeRun.mockResolvedValue(false);
    const result = await OpportunityService.detect(context, projectId);
    expect(result).toMatchObject({ outcome: "failed" });
    expect(result.message).toContain("No opportunities were published");
    expect(mocks.failRun).toHaveBeenCalledOnce();
  });

  it("preserves committed success when only the cooldown update fails", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.finish.mockRejectedValue(new Error("private billing context"));
    expect(await OpportunityService.detect(context, projectId)).toMatchObject({
      outcome: "completed",
      run: { status: "completed" },
    });
    expect(mocks.failRun).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledOnce();
    expect(JSON.stringify(warning.mock.calls)).not.toContain(
      "private billing context",
    );
  });
});
