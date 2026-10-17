import { beforeEach, expect, it, vi } from "vitest";
import { measurementRefreshJob } from "./measurementRefresh";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  refresh: vi.fn(),
  notify: vi.fn(),
}));
vi.mock(
  "@/server/features/experiments/repositories/ExperimentRepository",
  () => ({ ExperimentRepository: { list: mocks.list, get: mocks.get } }),
);
vi.mock("@/server/features/experiments/MeasurementService", () => ({
  MeasurementService: { refresh: mocks.refresh },
}));
vi.mock("../repositories/GrowthJobRepository", () => ({
  GrowthJobRepository: { notify: mocks.notify },
}));

const now = new Date("2026-10-17T12:00:00.000Z");
const experiment = (id: string, overrides: object = {}) => ({
  id,
  targetUrl: `https://example.com/${id}`,
  deployedAt: "2026-09-01T00:00:00.000Z",
  autoRefresh: true,
  latestRun: null,
  ...overrides,
});
const context = {
  projectId: "project",
  organizationId: "org",
  actor: { organizationId: "org", userId: "owner", role: "owner" },
  now,
  log: vi.fn(),
};

beforeEach(() => {
  mocks.refresh.mockResolvedValue({ ok: true, message: "Saved." });
  mocks.get.mockResolvedValue({ latestRun: { windowComplete: false } });
});

it("refreshes only due experiments, and announces a final result once", async () => {
  mocks.list.mockResolvedValue({
    items: [
      experiment("due"),
      experiment("off", { autoRefresh: false }),
      experiment("final", {
        latestRun: { windowComplete: true, finishedAt: "2026-10-01T00:00:00Z" },
      }),
    ],
  });
  mocks.get.mockResolvedValue({
    latestRun: {
      windowComplete: true,
      outcome: "negative",
      explanation: "Clicks fell.",
    },
  });
  expect(await measurementRefreshJob(context)).toEqual({
    summary: "Refreshed 1 of 3 experiments; 1 final results.",
  });
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
  expect(mocks.refresh).toHaveBeenCalledWith(context.actor, {
    projectId: "project",
    experimentId: "due",
  });
  expect(mocks.notify).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: "result_ready",
      title: "Result ready: negative for /due",
      body: "Clicks fell. Review the page. You can prepare a revert.",
      dedupeKey: "due",
    }),
  );
});
