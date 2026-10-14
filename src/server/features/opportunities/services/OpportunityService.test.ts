import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GscService } from "@/server/features/gsc/services/GscService";
import type { GscSearchAnalyticsRow } from "@/server/lib/gscClient";
import type { OpportunityRepository } from "../repositories/OpportunityRepository";
import { GscApiError } from "@/server/lib/gscErrors";
import type {
  OpportunityDetail,
  OpportunityListInput,
  OpportunityReviewInput,
} from "@/types/schemas/opportunities";
import { OpportunityService } from "./OpportunityService";
import {
  opportunityDetail as detail,
  opportunityRun as run,
} from "./opportunityTestFixtures";

type Performance = (
  ...args: Parameters<typeof GscService.getPerformance>
) => Promise<{ siteUrl: string; rows: GscSearchAnalyticsRow[] }>;

const mocks = vi.hoisted(() => ({
  project: vi.fn(),
  connection: vi.fn(),
  performance: vi.fn<Performance>(),
  keyPages: vi.fn(),
  claim: vi.fn(),
  finish: vi.fn(),
  list: vi.fn(),
  latestRun: vi.fn(),
  listRuns: vi.fn(),
  detail: vi.fn(),
  startRun: vi.fn(),
  setRequestCount: vi.fn(),
  completeRun: vi.fn(),
  failRun: vi.fn(),
  review: vi.fn<typeof OpportunityRepository.review>(),
}));
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
  },
}));

const context = { organizationId: "org-1", userId: "user-1", role: "owner" };
const projectId = "project-1";
const siteUrl = "https://example.com/";
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
const response = (rows: GscSearchAnalyticsRow[] = []) => ({ siteUrl, rows });

beforeEach(() => {
  mocks.project.mockResolvedValue({ id: projectId });
  mocks.connection.mockResolvedValue({ siteUrl });
  mocks.performance.mockResolvedValue(response());
  mocks.keyPages.mockResolvedValue([]);
  mocks.claim.mockResolvedValue("run-1");
  mocks.finish.mockResolvedValue(undefined);
  mocks.list.mockResolvedValue({ rows: [], total: 0 });
  mocks.latestRun.mockResolvedValue(null);
  mocks.listRuns.mockResolvedValue([]);
  mocks.detail.mockResolvedValue(detail());
  mocks.startRun.mockResolvedValue(undefined);
  mocks.setRequestCount.mockResolvedValue(undefined);
  mocks.completeRun.mockResolvedValue(true);
  mocks.failRun.mockResolvedValue(undefined);
  mocks.review.mockResolvedValue(true);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

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

  it("uses exactly three bounded final-data requests over consecutive 28-day Pacific windows", async () => {
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
        requestCount: 3,
      },
    });
    expect(mocks.performance).toHaveBeenCalledTimes(3);
    expect(mocks.performance.mock.calls.map(([request]) => request)).toEqual([
      {
        projectId,
        rowLimit: 1000,
        type: "web",
        dataState: "final",
        startDate: "2026-09-13",
        endDate: "2026-10-10",
        dimensions: ["query", "page"],
      },
      {
        projectId,
        rowLimit: 1000,
        type: "web",
        dataState: "final",
        startDate: "2026-09-13",
        endDate: "2026-10-10",
        dimensions: ["page"],
      },
      {
        projectId,
        rowLimit: 1000,
        type: "web",
        dataState: "final",
        startDate: "2026-08-16",
        endDate: "2026-09-12",
        dimensions: ["page"],
      },
    ]);
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
