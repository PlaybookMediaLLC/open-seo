import { describe, expect, it } from "vitest";
import { causesFor, fieldResult, PERFORMANCE_CAUSES } from "./performance";

// RFC-0014 5.4: one test per Lighthouse id in the cause table.
describe("causesFor", () => {
  it.each(
    PERFORMANCE_CAUSES.flatMap((cause) =>
      cause.lighthouseIds.map((id) => [id, cause.id] as const),
    ),
  )("maps %s to %s", (id, cause) => {
    expect(causesFor([id]).map((item) => item.id)).toContain(cause);
  });

  it("names no cause for an id outside the table", () => {
    expect(causesFor(["uses-text-compression"])).toEqual([]);
  });
});

const weeks = (from: string, values: Array<number | null>) =>
  values.map((value, index) => ({
    collectionEnd: new Date(
      new Date(`${from}T00:00:00Z`).getTime() + index * 7 * 86_400_000,
    )
      .toISOString()
      .slice(0, 10),
    value,
  }));

// RFC-0014 5.6: 4 weekly points before against 4 points from 4 weeks after.
describe("fieldResult", () => {
  const before = weeks("2026-08-01", [3_000, 3_100, 2_900, 3_000]);

  it("waits until the 4th point that starts 4 weeks after the change", () => {
    expect(
      fieldResult(
        [...before, ...weeks("2026-09-01", [2_000, 2_000])],
        "2026-08-29",
        "lcp",
      ),
    ).toEqual({ status: "waiting", readyOn: "2026-10-17" });
  });

  it.each([
    ["becomes good", [2_400, 2_300, 2_450, 2_400], "improved"],
    ["moves by less than 15%", [2_800, 2_700, 2_800, 2_900], "no clear change"],
    ["gets 15% slower", [3_500, 3_600, 3_500, 3_400], "worse"],
  ] as const)("labels a value that %s", (_name, values, label) => {
    expect(
      fieldResult(
        [...before, ...weeks("2026-09-26", [...values])],
        "2026-08-29",
        "lcp",
      ),
    ).toMatchObject({ status: "measured", before: 3_000, label });
  });

  it("needs 4 measured weeks on each side", () => {
    expect(
      fieldResult(
        [...before, ...weeks("2026-09-26", [2_000, null, 2_000, 2_000])],
        "2026-08-29",
        "lcp",
      ),
    ).toEqual({ status: "not_enough_data" });
  });
});
