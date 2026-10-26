import { beforeEach, expect, it, vi } from "vitest";
import { backtestPatternSchema } from "@/types/schemas/splitTests";
import { loadBaseline } from "./splitTestBaseline";
import { pastClicks } from "./splitTestHistory";

const mocks = vi.hoisted(() => ({ performance: vi.fn() }));
vi.mock("@/server/features/gsc/services/GscService", () => ({
  GscService: { getPerformance: mocks.performance },
}));
beforeEach(() => {
  mocks.performance.mockResolvedValue({
    rows: [
      {
        keys: ["https://example.com/integrations/slack", "2026-01-10"],
        clicks: 56,
        impressions: 100,
      },
      {
        keys: ["https://example.com/" + "a".repeat(10_000) + "!", "2026-01-10"],
        clicks: 1,
      },
    ],
  });
});

it("keeps supported page patterns working in baseline and backtest queries", async () => {
  const pattern = "^/integrations/[^/]+$";
  expect(
    backtestPatternSchema.safeParse({
      projectId: "project",
      pagePattern: pattern,
    }).success,
  ).toBe(true);
  const baseline = await loadBaseline("project", pattern, {
    start: "2026-01-01",
    end: "2026-02-25",
  });
  expect(baseline.map((row) => row.path)).toEqual(["/integrations/slack"]);
  const { past } = await pastClicks("project", pattern, "2026-04-01");
  expect([...past.keys()]).toEqual(["/integrations/slack"]);
});

it("evaluates nested repetition without catastrophic backtracking", async () => {
  expect(
    await loadBaseline("project", "^/(a+)+$", {
      start: "2026-01-01",
      end: "2026-02-25",
    }),
  ).toEqual([]);
  expect(
    (await pastClicks("project", "^/(a+)+$", "2026-04-01")).past.size,
  ).toBe(0);
});

it.each(["^/(a+)\\1$", "^/(?=a)a$"])(
  "rejects unsupported backtracking features: %s",
  (pagePattern) => {
    expect(
      backtestPatternSchema.safeParse({ projectId: "project", pagePattern })
        .success,
    ).toBe(false);
  },
);
