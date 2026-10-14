import { describe, expect, it } from "vitest";
import { shiftGa4Date } from "@/server/features/ga4/services/Ga4Dates";
import type { GscSearchAnalyticsRow } from "@/server/lib/gscClient";
import type { MeasurementDay } from "@/types/schemas/experiments";
import { assessMeasurement, parseMeasurementDays } from "./measurementAnalysis";

const scope = {
  projectId: "project-1",
  experimentId: "experiment-1",
  runId: "run-1",
  baselineStart: "2026-09-01",
  baselineEnd: "2026-09-28",
  observationStart: "2026-10-06",
  observationEnd: "2026-11-02",
  observationThrough: "2026-11-02",
};
const flags = {
  windowComplete: true,
  otherChanges: false,
  seasonalRisk: false,
  overlappingChanges: false,
};
function row(date: string): GscSearchAnalyticsRow {
  return { keys: [date], clicks: 5, impressions: 50, ctr: 0.1, position: 10 };
}
function days(
  period: MeasurementDay["period"],
  clicks = 140,
  impressions = 1400,
): MeasurementDay[] {
  const start =
    period === "baseline" ? scope.baselineStart : scope.observationStart;
  return Array.from({ length: 28 }, (_, index) => {
    const dailyClicks = Math.floor(clicks / 28) + (index < clicks % 28 ? 1 : 0);
    const dailyImpressions =
      Math.floor(impressions / 28) + (index < impressions % 28 ? 1 : 0);
    return {
      id: `${period}-${index}`,
      projectId: scope.projectId,
      experimentId: scope.experimentId,
      runId: scope.runId,
      period,
      date: shiftGa4Date(start, index),
      clicks: dailyClicks,
      impressions: dailyImpressions,
      ctr: dailyImpressions > 0 ? dailyClicks / dailyImpressions : 0,
      position: 10,
    };
  });
}

function expectInvalid(
  rows: GscSearchAnalyticsRow[],
  input = scope,
  message = "Search Console returned invalid daily measurement rows.",
) {
  expect(() => parseMeasurementDays(rows, input)).toThrowError(
    expect.objectContaining({
      name: "AppError",
      code: "VALIDATION_ERROR",
      message,
    }),
  );
}

describe("parseMeasurementDays", () => {
  it("partitions exact daily windows, skips washout, and attaches unique scoped row identities", () => {
    const rows = [
      row(scope.observationEnd),
      row("2026-10-05"),
      row(scope.baselineStart),
      row(scope.observationStart),
      row("2026-09-29"),
      row(scope.baselineEnd),
    ];
    const result = parseMeasurementDays(rows, scope);
    expect(result.map(({ date, period }) => ({ date, period }))).toEqual([
      { date: "2026-09-01", period: "baseline" },
      { date: "2026-09-28", period: "baseline" },
      { date: "2026-10-06", period: "observation" },
      { date: "2026-11-02", period: "observation" },
    ]);
    expect(new Set(result.map((day) => day.id)).size).toBe(4);
    for (const day of result)
      expect(day).toMatchObject({
        projectId: scope.projectId,
        experimentId: scope.experimentId,
        runId: scope.runId,
        clicks: 5,
        impressions: 50,
      });
    expect(rows[0].keys).toEqual([scope.observationEnd]);
  });

  it("preserves only reported days instead of filling missing dates with zero", () => {
    const result = parseMeasurementDays(
      [row("2026-09-01"), row("2026-09-03")],
      scope,
    );
    expect(result.map((day) => day.date)).toEqual(["2026-09-01", "2026-09-03"]);
    expect(parseMeasurementDays([], scope)).toEqual([]);
  });

  it("retains baseline but ignores washout when no observation day is eligible", () => {
    const result = parseMeasurementDays(
      [row(scope.baselineEnd), row("2026-10-05")],
      { ...scope, observationThrough: null },
    );
    expect(result.map((day) => day.period)).toEqual(["baseline"]);
    expect(() =>
      parseMeasurementDays([row(scope.observationStart)], {
        ...scope,
        observationThrough: null,
      }),
    ).toThrow("outside the measurement request");
  });

  it.each(["2026-08-31", "2026-10-11"])(
    "rejects dates outside the exact requested coverage: %s",
    (date) => {
      expectInvalid(
        [row(date)],
        { ...scope, observationThrough: "2026-10-10" },
        "Search Console returned a date outside the measurement request.",
      );
    },
  );

  it.each([scope.baselineStart, "2026-09-29"])(
    "rejects duplicate dates even when the day would be ignored: %s",
    (date) => {
      expectInvalid(
        [row(date), row(date)],
        scope,
        "Search Console returned duplicate daily measurement rows.",
      );
    },
  );

  it("rejects provider rows that cannot be safely interpreted as one finite daily observation", () => {
    expectInvalid([
      {
        ...row(scope.baselineStart),
        keys: [scope.baselineStart, "unexpected dimension"],
      },
    ]);
    expectInvalid([
      { ...row(scope.baselineStart), impressions: Number.POSITIVE_INFINITY },
    ]);
    expectInvalid([row("2026-09-31")]);
  });

  it("rejects an off-by-one baseline before interpreting provider data", () => {
    expectInvalid(
      [],
      { ...scope, baselineEnd: "2026-09-27" },
      "Measurement date windows are invalid.",
    );
  });
});

describe("assessMeasurement", () => {
  it.each([
    [100, 120, "encouraging"],
    [100, 80, "negative"],
    [100, 119, "inconclusive"],
    [200, 220, "inconclusive"],
    [100, 100, "inconclusive"],
  ] as const)(
    "classifies %i to %i clicks conservatively as %s",
    (baselineClicks, observationClicks, outcome) => {
      const result = assessMeasurement({
        ...flags,
        baselineDays: days("baseline", baselineClicks, 1000),
        observationDays: days("observation", observationClicks, 1000),
      });
      expect(result.outcome).toBe(outcome);
      expect(result.clickChange).toBe(observationClicks - baselineClicks);
      expect(result.clickChangePercent).toBeCloseTo(
        ((observationClicks - baselineClicks) / baselineClicks) * 100,
      );
      if (outcome !== "inconclusive")
        expect(result.explanation).toContain(
          "not a statistical or causal claim",
        );
    },
  );

  it.each(["otherChanges", "seasonalRisk", "overlappingChanges"] as const)(
    "withholds a directional outcome when %s is flagged",
    (risk) => {
      const result = assessMeasurement({
        ...flags,
        [risk]: true,
        baselineDays: days("baseline"),
        observationDays: days("observation", 280),
      });
      expect(result.outcome).toBe("inconclusive");
      expect(result.explanation).toContain("cannot be attributed");
    },
  );

  it("does not classify an unfinished window even with otherwise sufficient reported rows", () => {
    const result = assessMeasurement({
      ...flags,
      windowComplete: false,
      baselineDays: days("baseline"),
      observationDays: days("observation", 280),
    });
    expect(result.outcome).toBe("inconclusive");
    expect(result.explanation).toContain("not available yet");
  });

  it.each(["missing", "duplicate", "gap"])(
    "does not mistake %s daily coverage for a complete comparison",
    (problem) => {
      const observationDays = days("observation", 280);
      if (problem === "missing") observationDays.pop();
      if (problem === "duplicate")
        observationDays[27].date = observationDays[0].date;
      if (problem === "gap")
        observationDays[27].date = shiftGa4Date(scope.observationEnd, 1);
      const result = assessMeasurement({
        ...flags,
        baselineDays: days("baseline"),
        observationDays,
      });
      expect(result.outcome).toBe("inconclusive");
      expect(result.explanation).toContain(
        "Missing days are unknown, not zero",
      );
    },
  );

  it.each([
    [99, 1400, 1400],
    [140, 999, 1400],
    [140, 1400, 999],
  ])(
    "withholds a comparison below traffic floors (%i clicks, %i/%i impressions)",
    (baselineClicks, baselineImpressions, observationImpressions) => {
      const result = assessMeasurement({
        ...flags,
        baselineDays: days("baseline", baselineClicks, baselineImpressions),
        observationDays: days("observation", 280, observationImpressions),
      });
      expect(result.outcome).toBe("inconclusive");
      expect(result.explanation).toContain("not enough reported traffic");
    },
  );

  it("weights position by impressions and computes CTR from total clicks, not daily averages", () => {
    const baselineDays = days("baseline").slice(0, 2);
    Object.assign(baselineDays[0], {
      clicks: 10,
      impressions: 100,
      ctr: 0.1,
      position: 2,
    });
    Object.assign(baselineDays[1], {
      clicks: 20,
      impressions: 900,
      ctr: 20 / 900,
      position: 10,
    });
    const result = assessMeasurement({
      ...flags,
      baselineDays,
      observationDays: [],
    });
    expect(result.baseline).toEqual({
      reportedDays: 2,
      clicks: 30,
      impressions: 1000,
      ctr: 0.03,
      position: 9.2,
    });
    expect(result.observation).toEqual({
      reportedDays: 0,
      clicks: 0,
      impressions: 0,
      ctr: null,
      position: null,
    });
    expect(result.outcome).toBe("inconclusive");
  });

  it("does not invent a relative uplift when baseline clicks are zero", () => {
    const result = assessMeasurement({
      ...flags,
      baselineDays: days("baseline", 0),
      observationDays: days("observation", 140),
    });
    expect(result.clickChangePercent).toBeNull();
    expect(result.outcome).toBe("inconclusive");
  });
});
