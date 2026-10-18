import { expect, it } from "vitest";
import { backtest, type PastPage } from "./splitTestBacktest";
import { seededRandom } from "./splitStats";

// RFC-0011 phase 3: on stable history the backtest finds about 10% false
// results and detects a +15% lift.
it("finds few false results and detects a +15% lift on stable history", () => {
  const random = seededRandom(21);
  const noise = () =>
    Math.exp(
      0.1 *
        Math.sqrt(-2 * Math.log(1 - random())) *
        Math.cos(2 * Math.PI * random()),
    );
  const page = (perDay: number): PastPage => ({
    baseline: perDay,
    observation: perDay * noise(),
    firstHalf: perDay * noise(),
    secondHalf: perDay * noise(),
  });
  const pairs = Array.from({ length: 40 }, (_, index): [PastPage, PastPage] => [
    page(5 + index),
    page(5 + index),
  ]);
  const report = backtest(pairs, 3);
  expect(report.runs).toBe(200);
  expect(report.falsePositiveRate).toBeLessThanOrEqual(0.15);
  expect(report.liftDetectedRate).toBeGreaterThanOrEqual(0.8);
}, 60_000);

it("reports no runs when there are too few pairs to show anything", () => {
  // Found in production: no pages with clicks once counted as 100% false.
  expect(backtest([], 1)).toEqual({
    runs: 0,
    falsePositiveRate: 0,
    liftDetectedRate: 0,
  });
});
