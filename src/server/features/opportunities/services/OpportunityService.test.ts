import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  OpportunityDetail,
  OpportunityListInput,
  OpportunityReviewInput,
} from "@/types/schemas/opportunities";
import { OpportunityService } from "./OpportunityService";
import { opportunityDetail as detail } from "./opportunityTestFixtures";
import {
  context,
  projectId,
  setServiceMockDefaults,
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

const listInput: OpportunityListInput = {
  projectId,
  minPriority: 0,
  sort: "priority",
  includeDeferred: false,
  limit: 50,
  offset: 0,
};
const reviewInput: OpportunityReviewInput = {
  projectId,
  opportunityId: "opportunity-1",
  expectedVersion: 1,
  decision: "reviewed",
  note: "",
};
function reviewedDetail(): OpportunityDetail {
  const result = detail("reviewed");
  result.decisions.push({
    id: "decision-1",
    opportunityId: result.opportunity.id,
    evidenceRunId: "evidence-1",
    actorUserId: "user-1",
    decision: "reviewed",
    fromStatus: "discovered",
    toStatus: "reviewed",
    note: "",
    createdAt: new Date().toISOString(),
  });
  return result;
}

describe("OpportunityService authorization", () => {
  it.each(["list", "get", "detect", "review"] as const)(
    "denies a foreign project before %s reads or collection",
    async (method) => {
      mocks.project.mockResolvedValue(null);
      const calls = {
        list: () => OpportunityService.list(context, listInput),
        get: () => OpportunityService.get(context, projectId, "opportunity-1"),
        detect: () => OpportunityService.detect(context, projectId),
        review: () => OpportunityService.review(context, reviewInput),
      };
      await expect(calls[method]()).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(mocks.connection).not.toHaveBeenCalled();
      expect(mocks.performance).not.toHaveBeenCalled();
      expect(mocks.list).not.toHaveBeenCalled();
      expect(mocks.detail).not.toHaveBeenCalled();
      expect(mocks.claim).not.toHaveBeenCalled();
      expect(mocks.review).not.toHaveBeenCalled();
    },
  );
  it("allows member reads but refuses review decisions", async () => {
    const member = { ...context, role: "member" };
    expect(await OpportunityService.list(member, listInput)).toMatchObject({
      canReview: false,
    });
    await expect(
      OpportunityService.review(member, reviewInput),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.review).not.toHaveBeenCalled();
    expect(mocks.detail).not.toHaveBeenCalled();
  });
});

describe("OpportunityService review", () => {
  it.each([
    ["discovered", "reviewed", "reviewed"],
    ["reviewed", "reviewed", "reviewed"],
    ["reviewed", "approved", "approved"],
    ["discovered", "rejected", "rejected"],
    ["reviewed", "deferred", "reviewed"],
  ] as const)(
    "permits %s -> %s with an attributed decision",
    async (from, decision, to) => {
      mocks.detail.mockResolvedValue(
        decision === "approved" ? reviewedDetail() : detail(from),
      );
      await OpportunityService.review(context, { ...reviewInput, decision });
      expect(mocks.review).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: context.userId,
          fromStatus: from,
          toStatus: to,
          expectedVersion: 1,
        }),
      );
      const saved = mocks.review.mock.calls[0][0];
      expect(saved.deferredUntil === null).toBe(decision !== "deferred");
    },
  );

  it.each(["discovered", "implemented"] as const)(
    "rejects direct approval from %s",
    async (status) => {
      mocks.detail.mockResolvedValue(detail(status));
      await expect(
        OpportunityService.review(context, {
          ...reviewInput,
          decision: "approved",
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
      expect(mocks.review).not.toHaveBeenCalled();
    },
  );

  it("rejects a stale version before making a review mutation", async () => {
    await expect(
      OpportunityService.review(context, {
        ...reviewInput,
        expectedVersion: 2,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.review).not.toHaveBeenCalled();
  });

  it("rejects approval when the reviewed decision belongs to older evidence", async () => {
    const stale = reviewedDetail();
    stale.decisions[0].evidenceRunId = "old-evidence";
    mocks.detail.mockResolvedValue(stale);
    await expect(
      OpportunityService.review(context, {
        ...reviewInput,
        decision: "approved",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.review).not.toHaveBeenCalled();
  });

  it.each(["property", "age"] as const)(
    "requires current connected evidence for approval (%s)",
    async (reason) => {
      const reviewed = reviewedDetail();
      if (reason === "age")
        reviewed.opportunity.lastDetectedAt = new Date(
          Date.now() - 15 * 86_400_000,
        ).toISOString();
      else
        mocks.connection.mockResolvedValue({
          siteUrl: "https://other.example/",
        });
      mocks.detail.mockResolvedValue(reviewed);
      await expect(
        OpportunityService.review(context, {
          ...reviewInput,
          decision: "approved",
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(mocks.review).not.toHaveBeenCalled();
    },
  );

  it("surfaces a concurrent version conflict from the atomic review write", async () => {
    mocks.review.mockResolvedValue(false);
    await expect(
      OpportunityService.review(context, reviewInput),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
