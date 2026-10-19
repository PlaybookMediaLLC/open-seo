import { expect, it } from "vitest";
import { workReport } from "./workReport";

// RFC-0018 5.7: negative results are always counted and listed first, and
// the median time to approve comes from the records.
const result = (
  experimentId: string,
  outcome: "encouraging" | "inconclusive" | "negative",
) => ({
  experimentId,
  title: experimentId,
  outcome,
  explanation: "",
  conversions: null,
});

it("counts every result, lists negative ones first, and takes the median", () => {
  const report = workReport({
    changes: [],
    results: [
      result("a", "encouraging"),
      result("b", "negative"),
      result("c", "inconclusive"),
    ],
    approvals: [
      {
        preparedAt: "2026-10-01T00:00:00Z",
        approvedAt: "2026-10-01T02:00:00Z",
      },
      {
        preparedAt: "2026-10-02T00:00:00Z",
        approvedAt: "2026-10-02T10:00:00Z",
      },
      {
        preparedAt: "2026-10-03T00:00:00Z",
        approvedAt: "2026-10-04T00:00:00Z",
      },
    ],
    waiting: 2,
  });
  expect(report.results).toMatchObject({
    encouraging: 1,
    inconclusive: 1,
    negative: 1,
  });
  expect(report.results.items[0]?.experimentId).toBe("b");
  expect(report.approvals).toEqual({ count: 3, medianHours: 10, waiting: 2 });
});
