import { beforeEach, expect, it, vi } from "vitest";
import { AppError } from "@/server/lib/errors";
import { runLabChecks } from "./labChecks";

// RFC-0014 5.6: three runs, one after another, that stop when refused.
const live = vi.hoisted(() => vi.fn());
vi.mock("@/server/lib/dataforseo/client", () => ({
  createDataforseoClient: () => ({ lighthouse: { live } }),
}));
const report = (lcp: number) => ({
  scores: { performance: 61 },
  metrics: {
    largestContentfulPaint: { numericValue: lcp },
    cumulativeLayoutShift: { numericValue: 0.02 },
    totalBlockingTime: { numericValue: 250 },
  },
});
const input = {
  url: "https://example.com/blog",
  customer: {
    organizationId: "org",
    userId: "owner",
    userEmail: "owner@example.com",
    projectId: "project",
  },
};
beforeEach(() => {
  live.mockResolvedValue(report(3_000));
});

it("runs Lighthouse three times on a phone and keeps only the metrics", async () => {
  live.mockRejectedValueOnce(new Error("timeout"));
  expect(await runLabChecks(input)).toEqual({
    runs: [
      null,
      { lcpMs: 3_000, cls: 0.02, tbtMs: 250, score: 61 },
      { lcpMs: 3_000, cls: 0.02, tbtMs: 250, score: 61 },
    ],
    refused: null,
  });
  expect(live).toHaveBeenCalledWith({
    url: "https://example.com/blog",
    strategy: "mobile",
  });
});

it("stops when credits run out", async () => {
  live
    .mockResolvedValueOnce(report(3_000))
    .mockRejectedValueOnce(new AppError("INSUFFICIENT_CREDITS"));
  expect(await runLabChecks(input)).toMatchObject({
    runs: [expect.anything()],
    refused: "INSUFFICIENT_CREDITS",
  });
  expect(live).toHaveBeenCalledTimes(2);
});
