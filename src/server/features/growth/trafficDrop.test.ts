import { describe, expect, it } from "vitest";
import { shiftGa4Date } from "@/server/features/ga4/services/Ga4Dates";
import { trafficDrop } from "./trafficDrop";

const END = "2026-10-14";
/** One row per day and page: `before` clicks a day for 28 days, then `after`. */
function rows(pages: Record<string, [number, number]>, missing?: string) {
  const out = [];
  for (let offset = 34; offset >= 0; offset--) {
    const date = shiftGa4Date(END, -offset);
    if (date === missing) continue;
    for (const [page, [before, after]] of Object.entries(pages))
      out.push({ keys: [date, page], clicks: offset <= 6 ? after : before });
  }
  return out;
}

describe("trafficDrop", () => {
  it("flags a site drop of 25% and 100 clicks against the scaled baseline", () => {
    // 60 clicks a day is 420 a week; 45 a day is 315: 25% and 105 clicks.
    const result = trafficDrop(rows({ "/a": [60, 45] }), END);
    expect(result).toMatchObject({
      status: "checked",
      site: { before: 420, after: 315, dropped: true },
    });
  });

  it("does not flag a drop just under either site threshold", () => {
    // 24% fewer clicks: 420 to 320.
    expect(trafficDrop(rows({ "/a": [60, 320 / 7] }), END)).toMatchObject({
      site: { dropped: false },
    });
    // 50% fewer, but only 70 clicks: 140 to 70.
    expect(trafficDrop(rows({ "/a": [20, 10] }), END)).toMatchObject({
      site: { dropped: false },
    });
  });

  it("lists pages that lost 30% and 30 clicks, worst first", () => {
    const result = trafficDrop(
      rows({ "/big": [20, 10], "/small": [10, 5], "/steady": [30, 30] }),
      END,
    );
    expect(result.status === "checked" && result.pages).toEqual([
      { page: "/big", before: 140, after: 70 },
      { page: "/small", before: 70, after: 35 },
    ]);
  });

  it("skips the comparison when a date is missing", () => {
    expect(
      trafficDrop(rows({ "/a": [60, 45] }, shiftGa4Date(END, -10)), END),
    ).toEqual({ status: "incomplete" });
  });
});
