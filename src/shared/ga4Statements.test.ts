import { describe, expect, it } from "vitest";
import { GA4_THIN_DATA, ga4Statements } from "./ga4Statements";

/** 28 days per period with the given daily numbers. */
function days(
  baseline: { sessions: number; keyEvents: number; revenue?: number | null },
  observation: { sessions: number; keyEvents: number; revenue?: number | null },
  count = 28,
) {
  return (["baseline", "observation"] as const).flatMap((period) =>
    Array.from({ length: count }, () => {
      const day = period === "baseline" ? baseline : observation;
      return {
        period,
        sessions: day.sessions,
        keyEvents: day.keyEvents,
        revenue: day.revenue ?? null,
        currency: day.revenue == null ? null : "USD",
      };
    }),
  );
}

describe("ga4Statements", () => {
  it("states the session change only with all 28 dates and 100 sessions in each period", () => {
    expect(
      ga4Statements(
        days({ sessions: 5, keyEvents: 0 }, { sessions: 6, keyEvents: 0 }),
      ).statements,
    ).toEqual(["Organic sessions changed by +20%."]);
    expect(
      ga4Statements(
        days({ sessions: 5, keyEvents: 0 }, { sessions: 6, keyEvents: 0 }, 27),
      ).statements,
    ).toEqual([GA4_THIN_DATA]);
  });

  it("states the key event change with 20 key events in each period", () => {
    // 3 sessions a day is below 100 sessions, so only the event statement shows.
    expect(
      ga4Statements(
        days({ sessions: 3, keyEvents: 1 }, { sessions: 3, keyEvents: 2 }),
      ).statements,
    ).toEqual(["Key events changed by +100%."]);
  });

  it("states the key event rate only when both rules hold", () => {
    expect(
      ga4Statements(
        days({ sessions: 10, keyEvents: 1 }, { sessions: 10, keyEvents: 2 }),
      ).statements,
    ).toEqual([
      "Organic sessions changed by 0%.",
      "Key events changed by +100%.",
      "Key event rate changed from 10.0% to 20.0%.",
    ]);
  });

  it("states revenue when both periods have revenue and 20 key events", () => {
    expect(
      ga4Statements(
        days(
          { sessions: 3, keyEvents: 1, revenue: 10 },
          { sessions: 3, keyEvents: 1, revenue: 12.5 },
        ),
      ).statements,
    ).toContain("Revenue changed from 280.00 to 350.00 USD.");
    expect(
      ga4Statements(
        days(
          { sessions: 3, keyEvents: 0, revenue: 10 },
          { sessions: 3, keyEvents: 0, revenue: 12.5 },
        ),
      ).statements,
    ).toEqual([GA4_THIN_DATA]);
  });
});
