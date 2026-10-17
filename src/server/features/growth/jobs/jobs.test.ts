import { beforeEach, describe, expect, it, vi } from "vitest";
import { shiftGa4Date } from "@/server/features/ga4/services/Ga4Dates";
import { deploymentCheckJob } from "./deploymentCheck";
import {
  opportunityRefreshJob,
  recommendationRecheckJob,
} from "./opportunityJobs";
import { trafficWatchJob } from "./trafficWatch";

const mocks = vi.hoisted(() => ({
  detect: vi.fn(),
  listOpportunities: vi.fn(),
  performance: vi.fn(),
  listExperiments: vi.fn(),
  getExperiment: vi.fn(),
  refreshPull: vi.fn(),
  refreshSignals: vi.fn(),
  notify: vi.fn<(row: { kind: string; title: string }) => Promise<void>>(),
}));
vi.mock("@/server/features/opportunities/services/OpportunityService", () => ({
  OpportunityService: { detect: mocks.detect },
}));
vi.mock(
  "@/server/features/opportunities/repositories/OpportunityRepository",
  () => ({ OpportunityRepository: { list: mocks.listOpportunities } }),
);
vi.mock("@/server/features/gsc/services/GscService", () => ({
  GscService: { getPerformance: mocks.performance },
}));
vi.mock(
  "@/server/features/experiments/repositories/ExperimentRepository",
  () => ({
    ExperimentRepository: {
      list: mocks.listExperiments,
      get: mocks.getExperiment,
    },
  }),
);
vi.mock("@/server/features/experiments/ExperimentService", () => ({
  ExperimentService: { refreshPull: mocks.refreshPull },
}));
vi.mock("@/server/features/experiments/DeploymentSignalService", () => ({
  DeploymentSignalService: { refresh: mocks.refreshSignals },
}));
vi.mock("../repositories/GrowthJobRepository", () => ({
  GrowthJobRepository: { notify: mocks.notify },
}));

const context = {
  projectId: "project",
  organizationId: "org",
  actor: { organizationId: "org", userId: "owner", role: "owner" },
  now: new Date("2026-10-17T12:00:00.000Z"),
  log: vi.fn(),
};
const notified = () =>
  mocks.notify.mock.calls.map(([row]) => [row.kind, row.title]);

beforeEach(() => {
  mocks.listOpportunities.mockResolvedValue({ rows: [], total: 0 });
});

describe("opportunity refresh", () => {
  it("announces items that this run found first, with priority 50 or more", async () => {
    mocks.detect.mockResolvedValue({
      outcome: "completed",
      message: "Analysis completed.",
      run: { id: "run", finishedAt: "2026-10-17T12:01:00.000Z" },
    });
    mocks.listOpportunities.mockResolvedValue({
      rows: [
        { title: "New page", firstDetectedAt: "2026-10-17T12:01:00.000Z" },
        { title: "Old page", firstDetectedAt: "2026-10-01T00:00:00.000Z" },
      ],
    });
    await opportunityRefreshJob(context);
    expect(notified()).toEqual([["new_opportunities", "1 new opportunity"]]);
  });

  it("retries a failed analysis", async () => {
    mocks.detect.mockResolvedValue({
      outcome: "failed",
      message: "Analysis could not finish.",
      run: null,
    });
    await expect(opportunityRefreshJob(context)).rejects.toThrow(
      "Analysis could not finish.",
    );
  });
});

describe("recommendation re-check", () => {
  it("counts open items that the latest analysis no longer found", async () => {
    mocks.listOpportunities.mockImplementation(
      async (input: { status: string }) => ({
        rows: [],
        total: input.status === "discovered" ? 2 : 1,
      }),
    );
    expect(await recommendationRecheckJob(context)).toEqual({
      summary: "3 open items are not in the latest analysis.",
    });
    expect(notified()).toEqual([
      [
        "stale_recommendations",
        "3 recommendations are not in the latest analysis",
      ],
    ]);
  });
});

describe("traffic watch", () => {
  const end = "2026-10-14";
  const days = (before: number, after: number, missing?: number) =>
    Array.from({ length: 35 }, (_, index) => 34 - index)
      .filter((offset) => offset !== missing)
      .map((offset) => ({
        keys: [shiftGa4Date(end, -offset), "https://example.com/a"],
        clicks: offset <= 6 ? after : before,
      }));

  it("notifies a site drop", async () => {
    mocks.performance.mockResolvedValue({ rows: days(60, 30) });
    await trafficWatchJob(context);
    expect(mocks.performance.mock.calls[0]?.[0]).toMatchObject({
      startDate: shiftGa4Date(end, -34),
      endDate: end,
      dimensions: ["date", "page"],
    });
    expect(notified()).toEqual([
      ["traffic_drop", "Search clicks fell to 210 in the last 7 days"],
    ]);
  });

  it("skips incomplete data without a notification", async () => {
    mocks.performance.mockResolvedValue({ rows: days(60, 30, 10) });
    expect(await trafficWatchJob(context)).toEqual({
      summary: "Skipped: Search Console data has missing dates.",
    });
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});

describe("deployment check", () => {
  it("refreshes a merged change's signals and asks a person to confirm", async () => {
    mocks.listExperiments.mockResolvedValue({
      items: [
        {
          id: "e1",
          targetUrl: "https://example.com/a",
          deployedAt: null,
          pullRequestState: "open",
        },
        {
          id: "e2",
          targetUrl: "https://example.com/b",
          deployedAt: "2026-10-01",
        },
      ],
    });
    mocks.refreshPull.mockResolvedValue({ ok: true, message: "Merged." });
    mocks.refreshSignals.mockResolvedValue({ ok: true, message: "Seen." });
    mocks.getExperiment.mockResolvedValue({
      experiment: { pullRequestState: "merged" },
      signals: [{ kind: "github_deployment" }],
    });
    await deploymentCheckJob(context);
    expect(mocks.refreshPull).toHaveBeenCalledTimes(1);
    expect(notified()).toEqual([
      ["deployment_detected", "Deployment detected for /a"],
    ]);
  });
});
