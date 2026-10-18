import { expect, it } from "vitest";
import { conversionResult } from "./conversionResult";

// RFC-0012 5.6: the directional thresholds, each at its boundary.
it("shows a direction at 1,000 sessions, 50 conversions, +20% and +10", () => {
  expect(
    conversionResult(
      { sessions: 1000, conversions: 50 },
      { sessions: 1000, conversions: 60 },
    ),
  ).toMatchObject({ label: "rate_up", reasons: [] });
});

it("is inconclusive one step below each threshold", () => {
  const label = (
    baseline: { sessions: number; conversions: number },
    observation: { sessions: number; conversions: number },
  ) => conversionResult(baseline, observation).label;
  expect(
    label(
      { sessions: 999, conversions: 50 },
      { sessions: 1000, conversions: 60 },
    ),
  ).toBe("inconclusive");
  expect(
    label(
      { sessions: 1000, conversions: 49 },
      { sessions: 1000, conversions: 60 },
    ),
  ).toBe("inconclusive");
  // +19% relative.
  expect(
    label(
      { sessions: 1000, conversions: 100 },
      { sessions: 1000, conversions: 119 },
    ),
  ).toBe("inconclusive");
  // +45% relative, but only 9 more conversions.
  expect(
    label(
      { sessions: 2000, conversions: 100 },
      { sessions: 1500, conversions: 109 },
    ),
  ).toBe("inconclusive");
});
