import { sortBy, sum } from "remeda";

// RFC-0011 5.2, 5.3 and 5.5: eligibility, assignment and the paired
// randomization test. Pure and seeded: the same inputs and seed always give
// the same result, and scripts/split-test-reference.py reproduces it.
const DRAWS = 10_000;
const MIN_PAGES = 30;
const MAX_PAGES = 200;
const MIN_CLICKS = 1000;
const MAX_MDE_PCT = 15;
const MAX_REDRAWS = 20;
const ALPHA = 0.1;

/** mulberry32, a small seeded generator with the same output in Python. */
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

type BaselinePage = { path: string; clicks: number };
export type Pair = { index: number; variant: string; control: string };

/** 5.3 steps 1 to 3: sort by clicks, pair neighbours, draw a side per pair. */
export function pairPages(pages: BaselinePage[], seed: number): Pair[] {
  const sorted = sortBy(
    pages,
    [(page) => page.clicks, "desc"],
    [(page) => page.path, "asc"],
  );
  const random = seededRandom(seed);
  const pairs: Pair[] = [];
  for (let index = 0; index + 1 < sorted.length; index += 2) {
    const first = sorted[index].path;
    const second = sorted[index + 1].path;
    const firstIsVariant = random() < 0.5;
    pairs.push({
      index: index / 2,
      variant: firstIsVariant ? first : second,
      control: firstIsVariant ? second : first,
    });
  }
  return pairs;
}

/** ln(1 + clicks per day) after, minus before. */
export const growth = (beforePerDay: number, afterPerDay: number) =>
  Math.log1p(afterPerDay) - Math.log1p(beforePerDay);

/** d for each pair: the variant's growth minus the control's. */
export const pairDifferences = (
  pairs: Pair[],
  growthOf: (path: string) => number,
) => pairs.map((pair) => growthOf(pair.variant) - growthOf(pair.control));

const mean = (values: number[]) => sum(values) / values.length;

function sampleSd(values: number[]) {
  const average = mean(values);
  return Math.sqrt(
    sum(values.map((value) => (value - average) ** 2)) / (values.length - 1),
  );
}

/**
 * The exact sign-flip test: under no effect each d is equally likely to be
 * positive or negative. One generator output gives 32 signs, bit by bit.
 * Each draw's mean of (d − δ) is a − δ·b, so a p-value at any δ costs one
 * pass over the draws.
 */
export function randomizationTest(d: number[], seed: number, draws = DRAWS) {
  // No pairs, no evidence: the test never rejects.
  if (!d.length) return { mean: 0, pValue: 1, harmP: 1, pAt: () => 1 };
  const random = seededRandom(seed);
  const a = new Float64Array(draws);
  const b = new Float64Array(draws);
  for (let draw = 0; draw < draws; draw++) {
    let signedSum = 0;
    let signs = 0;
    let bits = 0;
    for (let index = 0; index < d.length; index++) {
      if (index % 32 === 0) bits = Math.floor(random() * 4_294_967_296);
      const sign = (bits >>> (index % 32)) & 1 ? 1 : -1;
      signedSum += sign * d[index];
      signs += sign;
    }
    a[draw] = signedSum / d.length;
    b[draw] = signs / d.length;
  }
  const observed = mean(d);
  const pAt = (delta: number) => {
    const bound = Math.abs(observed - delta) - 1e-12;
    let hits = 0;
    for (let draw = 0; draw < draws; draw++)
      if (Math.abs(a[draw] - delta * b[draw]) >= bound) hits++;
    return hits / draws;
  };
  let harmHits = 0;
  for (let draw = 0; draw < draws; draw++)
    if (a[draw] <= observed + 1e-12) harmHits++;
  return { mean: observed, pValue: pAt(0), harmP: harmHits / draws, pAt };
}

/** The 90% interval by inverting the test: the δ where p stays above 0.10. */
function invertInterval(test: ReturnType<typeof randomizationTest>) {
  const edge = (direction: -1 | 1) => {
    let inside = test.mean;
    let step = 1e-3;
    let outside = test.mean + direction * step;
    for (let tries = 0; test.pAt(outside) > ALPHA && tries < 60; tries++) {
      inside = outside;
      step *= 2;
      outside = test.mean + direction * step;
    }
    for (let iteration = 0; iteration < 50; iteration++) {
      const middle = (inside + outside) / 2;
      if (test.pAt(middle) > ALPHA) inside = middle;
      else outside = middle;
    }
    return inside;
  };
  return { low: edge(-1), high: edge(1) };
}

const pct = (logEffect: number) => Math.expm1(logEffect) * 100;

/** Student t quantile, by the Cornish-Fisher expansion of the normal one. */
function tQuantile(z: number, freedom: number) {
  return (
    z +
    (z ** 3 + z) / (4 * freedom) +
    (5 * z ** 5 + 16 * z ** 3 + 3 * z) / (96 * freedom ** 2)
  );
}

/**
 * The minimum detectable effect at 80% power and a two-sided 90% interval,
 * from the pre-period differences. Two changes from the RFC's formula keep
 * "can detect" true for 15 to 100 pairs: t quantiles replace 1.645 and
 * 0.842, and the spread is its 80% upper confidence bound, because a low
 * estimate of it would overstate the power.
 */
export function minimumDetectableEffect(prePeriodD: number[]) {
  const freedom = prePeriodD.length - 1;
  const multiplier = tQuantile(1.6449, freedom) + tQuantile(0.8416, freedom);
  // Wilson-Hilferty: the 20% quantile of chi-square with `freedom` degrees.
  const chiSquare =
    freedom *
    (1 - 2 / (9 * freedom) - 0.8416 * Math.sqrt(2 / (9 * freedom))) ** 3;
  const spread = sampleSd(prePeriodD) * Math.sqrt(freedom / chiSquare);
  return pct((multiplier * spread) / Math.sqrt(prePeriodD.length));
}

type Analysis = {
  estimatePct: number;
  ciLowPct: number;
  ciHighPct: number;
  pValue: number;
  harmP: number;
};

export function analyze(d: number[], seed: number): Analysis {
  const test = randomizationTest(d, seed);
  const interval = invertInterval(test);
  return {
    estimatePct: pct(test.mean),
    ciLowPct: pct(interval.low),
    ciHighPct: pct(interval.high),
    pValue: test.pValue,
    harmP: test.harmP,
  };
}

/** 5.5 labels. An imbalanced pre-period is never positive or negative. */
export function labelOf(input: {
  windowComplete: boolean;
  prePeriodP: number;
  ciLowPct: number;
  ciHighPct: number;
}) {
  if (input.prePeriodP <= 0.2) return "inconclusive" as const;
  if (input.windowComplete && input.ciLowPct > 0) return "positive" as const;
  if (input.ciHighPct < 0) return "negative" as const;
  return "inconclusive" as const;
}

/** 5.5 early stop, for harm only, after 14 observation days. */
export const harmful = (observationDays: number, analysis: Analysis) =>
  observationDays >= 14 && analysis.estimatePct <= -10 && analysis.harmP < 0.05;

/**
 * 5.3 step 4: the click totals differ by less than 5% and the pre-period
 * test has p > 0.2; otherwise draw again, at most 20 times.
 */
export function assign(
  pages: BaselinePage[],
  firstSeed: number,
  prePeriodP: (pairs: Pair[], seed: number) => number,
) {
  const clicks = new Map(pages.map((page) => [page.path, page.clicks]));
  // Seeds stay below 2^31, so both databases store them as an integer.
  let seed = firstSeed & 0x7f_ff_ff_ff;
  let pairs = pairPages(pages, seed);
  for (let attempt = 1; attempt <= MAX_REDRAWS; attempt++) {
    const variant = sum(pairs.map((pair) => clicks.get(pair.variant) ?? 0));
    const control = sum(pairs.map((pair) => clicks.get(pair.control) ?? 0));
    const gap = Math.abs(variant - control) / ((variant + control) / 2 || 1);
    if (gap < 0.05 && prePeriodP(pairs, seed) > 0.2)
      return { seed, pairs, balanced: true };
    if (attempt === MAX_REDRAWS) break;
    seed = (seed + 0x9e_37_79_b9) & 0x7f_ff_ff_ff;
    pairs = pairPages(pages, seed);
  }
  return { seed, pairs, balanced: false };
}

/** 5.2 step 4: the thresholds, each failure with its gap in numbers. */
export function eligibility(pages: BaselinePage[], mdePct: number | null) {
  const active = pages.filter((page) => page.clicks >= 1);
  const clicks = sum(active.map((page) => page.clicks));
  const failures: string[] = [];
  if (active.length < MIN_PAGES)
    failures.push(
      `${pages.length} pages match the pattern, and ${active.length} have a click in the 56-day baseline. A test needs at least ${MIN_PAGES} with a click, so ${MIN_PAGES - active.length} more.`,
    );
  if (active.length > MAX_PAGES)
    failures.push(
      `${active.length} pages match. A test takes at most ${MAX_PAGES}. Narrow the pattern.`,
    );
  if (clicks < MIN_CLICKS)
    failures.push(
      `The pages have ${clicks.toLocaleString("en-US")} clicks in the 56-day baseline. A test needs at least ${MIN_CLICKS.toLocaleString("en-US")}, so ${(MIN_CLICKS - clicks).toLocaleString("en-US")} more.`,
    );
  if (mdePct !== null && mdePct > MAX_MDE_PCT)
    failures.push(
      `This group can detect a change of ${Math.round(mdePct)}% or more. A test needs ${MAX_MDE_PCT}% or less.`,
    );
  return {
    eligible: failures.length === 0,
    failures,
    summary:
      mdePct === null
        ? null
        : `This group can detect a change of ${Math.round(mdePct)}% or more. Smaller effects will show as inconclusive.`,
  };
}
