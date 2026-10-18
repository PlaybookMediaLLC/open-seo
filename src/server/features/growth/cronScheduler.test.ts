import { beforeEach, expect, it, vi } from "vitest";
import { runGrowthCron } from "./cronScheduler";

// RFC-0008 on the Worker cron: quarter-hour ticks only, the next attempt of
// each due window, and no fourth attempt.
const mocks = vi.hoisted(() => ({
  mode: vi.fn(),
  due: vi.fn(),
  run: vi.fn(),
  retention: vi.fn(),
  reconcile: vi.fn(),
  attempts: vi.fn(),
}));
vi.mock("./internalAuth", () => ({ growthJobsMode: mocks.mode }));
vi.mock("./GrowthJobService", () => ({
  GrowthJobService: {
    due: mocks.due,
    run: mocks.run,
    retention: mocks.retention,
  },
}));
vi.mock("./repositories/GrowthJobRepository", () => ({
  GrowthJobRepository: { attempts: mocks.attempts },
}));
vi.mock("@/server/billing/spendReconcile", () => ({
  reconcileSpend: mocks.reconcile,
}));
const at = (time: string) => Date.parse(`2026-10-18T${time}:00Z`);
const item = (windowKey: string) => ({
  kind: "measurement_refresh",
  projectId: "project",
  scheduleId: "schedule",
  windowKey,
});

beforeEach(() => {
  mocks.mode.mockResolvedValue("cron");
  mocks.due.mockResolvedValue({ items: [item("a"), item("b")] });
  mocks.run.mockResolvedValue({});
  mocks.retention.mockResolvedValue({});
  mocks.reconcile.mockResolvedValue({});
  mocks.attempts.mockImplementation(
    async (_project: string, _kind: string, windowKey: string) =>
      windowKey === "b" ? 3 : 1,
  );
});

it("runs the next attempt of each due window on a quarter-hour tick", async () => {
  expect(await runGrowthCron(at("10:15"))).toEqual({ ran: 1 });
  // Window b already used its 3 attempts; window a gets its second.
  expect(mocks.run).toHaveBeenCalledWith(
    { ...item("a"), attempt: 2, maxAttempts: 3, triggerRunId: null },
    new Date(at("10:15")),
  );
  expect(mocks.reconcile).toHaveBeenCalled();
  expect(mocks.retention).not.toHaveBeenCalled();
});

it("waits for quarter-hour ticks, and leaves the work to Trigger.dev when it is set", async () => {
  expect(await runGrowthCron(at("10:20"))).toEqual({ ran: 0 });
  mocks.mode.mockResolvedValue("trigger");
  expect(await runGrowthCron(at("10:30"))).toEqual({ ran: 0 });
  expect(mocks.due).not.toHaveBeenCalled();
});

it("deletes old history on the 03:30 tick", async () => {
  await runGrowthCron(at("03:30"));
  expect(mocks.retention).toHaveBeenCalledWith(new Date(at("03:30")));
});
