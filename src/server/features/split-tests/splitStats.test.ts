import { describe, expect, it } from "vitest";
import {
  analyze,
  assign,
  eligibility,
  harmful,
  labelOf,
  minimumDetectableEffect,
  pairPages,
  randomizationTest,
  seededRandom,
} from "./splitStats";

// RFC-0011 5.2 to 5.5, checked against scripts/split-test-reference.py and
// by simulation. Every run is seeded, so the results never change.
const pages = (count: number, clicks = (index: number) => 100 - index) =>
  Array.from({ length: count }, (_, index) => ({
    path: `/integrations/${index}`,
    clicks: clicks(index),
  }));

// Thousands of seeded runs; slow when the whole suite shares the CPU.
const SIMULATION_TIMEOUT = 60_000;
const round = (value: number, places = 2) =>
  Math.round(value * 10 ** places) / 10 ** places;

function normals(seed: number) {
  const random = seededRandom(seed);
  return () =>
    Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
}

describe("assignment", () => {
  it("pairs neighbours by clicks and gives the same groups for the same seed", () => {
    const group = pages(31);
    const pairs = pairPages(group, 42);
    expect(pairs).toHaveLength(15);
    expect(pairs).toEqual(pairPages(group, 42));
    expect(pairs).not.toEqual(pairPages(group, 43));
    // Pages 0 and 1 have the most clicks; the 31st page is dropped.
    expect([pairs[0].variant, pairs[0].control]).toEqual(
      expect.arrayContaining(["/integrations/0", "/integrations/1"]),
    );
  });

  it("draws again until the groups balance, at most 20 times", () => {
    const group = pages(40);
    let calls = 0;
    const balanced = assign(group, 7, () => (++calls < 3 ? 0.1 : 0.9));
    expect(balanced).toMatchObject({ balanced: true });
    expect(balanced.seed).not.toBe(7);
    calls = 0;
    expect(assign(group, 7, () => (calls++, 0))).toMatchObject({
      balanced: false,
    });
    expect(calls).toBe(20);
  });
});

it("refuses each threshold with its gap and accepts the boundary", () => {
  const busy = (count: number) => pages(count, () => 50);
  expect(eligibility(busy(30), 15).eligible).toBe(true);
  expect(eligibility(busy(29), 15).failures).toEqual([
    "29 pages have a click in the 56-day baseline. A test needs at least 30, so 1 more.",
  ]);
  expect(eligibility(busy(201), 15).failures).toEqual([
    "201 pages match. A test takes at most 200. Narrow the pattern.",
  ]);
  expect(
    eligibility(
      pages(30, () => 33),
      15,
    ).failures,
  ).toEqual([
    "The pages have 990 clicks in the 56-day baseline. A test needs at least 1,000, so 10 more.",
  ]);
  expect(eligibility(busy(30), 15.6).failures).toEqual([
    "This group can detect a change of 16% or more. A test needs 15% or less.",
  ]);
});

it("matches the reference implementation on five fixed datasets", () => {
  const expected = [
    [1, 15, 0, 0.6, 1.52, -6.61, 10.25, 0.743, 0.1174, 12.81],
    [2, 25, 0.1, 0.5, 8.25, 2.74, 14.06, 0.017, 0.7734, 10.98],
    [3, 40, -0.08, 0.4, -7.95, -10.68, -5.14, 0, 0.0496, 4.42],
    [4, 60, 0.05, 0.8, 7.92, 2.69, 13.46, 0.0138, 0.1361, 9.11],
    [5, 100, 0.2, 1, 21.92, 16.01, 28.06, 0, 0.1383, 7.66],
  ] as const;
  for (const [seed, pairs, shift, spread, ...numbers] of expected) {
    const random = seededRandom(seed);
    const d = Array.from(
      { length: pairs },
      () => shift + (random() - 0.5) * spread,
    );
    const pre = Array.from({ length: pairs }, () => (random() - 0.5) * spread);
    const result = analyze(d, seed);
    expect([
      round(result.estimatePct),
      round(result.ciLowPct),
      round(result.ciHighPct),
      round(result.pValue, 4),
      round(randomizationTest(pre, seed).pValue, 4),
      round(minimumDetectableEffect(pre)),
    ]).toEqual(numbers);
  }
});

describe("simulation", () => {
  it(
    "excludes 0 from the 90% interval in 8% to 12% of 1,000 A/A runs",
    () => {
      const normal = normals(11);
      let falsePositives = 0;
      for (let run = 0; run < 1000; run++) {
        const d = Array.from({ length: 25 }, () => 0.2 * normal());
        if (randomizationTest(d, run).pValue <= 0.1) falsePositives++;
      }
      expect(falsePositives).toBeGreaterThanOrEqual(80);
      expect(falsePositives).toBeLessThanOrEqual(120);
    },
    SIMULATION_TIMEOUT,
  );

  it(
    "labels an effect equal to the reported MDE positive in 80% or more",
    () => {
      const normal = normals(12);
      let positives = 0;
      for (let run = 0; run < 300; run++) {
        const mde = minimumDetectableEffect(
          Array.from({ length: 25 }, () => 0.2 * normal()),
        );
        const d = Array.from(
          { length: 25 },
          () => Math.log1p(mde / 100) + 0.2 * normal(),
        );
        const result = analyze(d, run);
        if (
          labelOf({ windowComplete: true, prePeriodP: 1, ...result }) ===
          "positive"
        )
          positives++;
      }
      expect(positives / 300).toBeGreaterThanOrEqual(0.8);
    },
    SIMULATION_TIMEOUT,
  );

  it(
    "labels a true +15% effect on an eligible design positive in 80% or more",
    () => {
      const normal = normals(13);
      // 40 pairs at this spread: an MDE near 12%.
      let positives = 0;
      for (let run = 0; run < 300; run++) {
        const d = Array.from(
          { length: 40 },
          () => Math.log1p(0.15) + 0.2 * normal(),
        );
        const result = analyze(d, run);
        if (
          labelOf({ windowComplete: true, prePeriodP: 1, ...result }) ===
          "positive"
        )
          positives++;
      }
      expect(positives / 300).toBeGreaterThanOrEqual(0.8);
    },
    SIMULATION_TIMEOUT,
  );
});

it("never labels positive before the window ends or on an imbalanced pre-period", () => {
  const clear = { prePeriodP: 0.8, ciLowPct: 4, ciHighPct: 20 };
  expect(labelOf({ ...clear, windowComplete: true })).toBe("positive");
  expect(labelOf({ ...clear, windowComplete: false })).toBe("inconclusive");
  expect(labelOf({ ...clear, windowComplete: true, prePeriodP: 0.2 })).toBe(
    "inconclusive",
  );
  expect(
    labelOf({
      windowComplete: false,
      prePeriodP: 0.8,
      ciLowPct: -20,
      ciHighPct: -3,
    }),
  ).toBe("negative");
});

it("stops early for harm only after 14 days, at -10% with p below 0.05", () => {
  const harm = {
    estimatePct: -12,
    ciLowPct: -20,
    ciHighPct: -4,
    pValue: 0.04,
    harmP: 0.02,
  };
  expect(harmful(14, harm)).toBe(true);
  expect(harmful(13, harm)).toBe(false);
  expect(harmful(20, { ...harm, estimatePct: -9 })).toBe(false);
  expect(harmful(20, { ...harm, harmP: 0.06 })).toBe(false);
});
