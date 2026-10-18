import { growth, labelOf, randomizationTest, seededRandom } from "./splitStats";

// RFC-0011 phase 3 and the phase 1a acceptance test: how the test behaves on
// the customer's own history. Each run draws the group side of every pair
// again, with no change (A/A) or with a synthetic lift on the variant side.
const RUNS = 200;
// Fewer draws than a real analysis keep 400 runs fast; the p-value is still
// resolved to 0.0005.
const BACKTEST_DRAWS = 2_000;
const LIFT = 0.15;

/** Clicks of one page in the four past windows, per day. */
export type PastPage = {
  baseline: number;
  observation: number;
  firstHalf: number;
  secondHalf: number;
};

type Oriented = Array<{ variant: PastPage; control: PastPage }>;
const MAX_REDRAWS = 20;

const orient = (pairs: Array<[PastPage, PastPage]>, random: () => number) =>
  pairs.map(([first, second]) =>
    random() < 0.5
      ? { variant: first, control: second }
      : { variant: second, control: first },
  );

const prePeriodP = (oriented: Oriented, seed: number) =>
  randomizationTest(
    oriented.map(
      ({ variant, control }) =>
        growth(variant.firstHalf, variant.secondHalf) -
        growth(control.firstHalf, control.secondHalf),
    ),
    seed,
    BACKTEST_DRAWS,
  ).pValue;

function balanced(oriented: Oriented, seed: number) {
  const variant = oriented.reduce(
    (total, pair) => total + pair.variant.baseline,
    0,
  );
  const control = oriented.reduce(
    (total, pair) => total + pair.control.baseline,
    0,
  );
  const gap = Math.abs(variant - control) / ((variant + control) / 2 || 1);
  return gap < 0.05 && prePeriodP(oriented, seed) > 0.2;
}

/**
 * `pairs` are the stored pairs with each page's past clicks per day. Returns
 * the share of A/A runs whose 90% interval excludes 0, and the share of
 * lifted runs labeled positive.
 */
export function backtest(pairs: Array<[PastPage, PastPage]>, seed: number) {
  const random = seededRandom(seed);
  let falsePositives = 0;
  let detected = 0;
  for (let run = 0; run < RUNS; run++) {
    // As in 5.3: draw the sides again until the groups balance.
    let oriented = orient(pairs, random);
    for (
      let draw = 1;
      draw < MAX_REDRAWS && !balanced(oriented, seed + run);
      draw++
    )
      oriented = orient(pairs, random);
    const d = (lift: number) =>
      oriented.map(
        ({ variant, control }) =>
          growth(variant.baseline, variant.observation * (1 + lift)) -
          growth(control.baseline, control.observation),
      );
    if (randomizationTest(d(0), seed + run, BACKTEST_DRAWS).pValue <= 0.1)
      falsePositives++;
    const lifted = randomizationTest(d(LIFT), seed + run, BACKTEST_DRAWS);
    // The interval sits above 0 exactly when the test rejects 0 and the
    // estimate is positive.
    if (
      labelOf({
        windowComplete: true,
        prePeriodP: prePeriodP(oriented, seed + run),
        ciLowPct: lifted.pValue <= 0.1 && lifted.mean > 0 ? 1 : -1,
        ciHighPct: 1,
      }) === "positive"
    )
      detected++;
  }
  return {
    runs: RUNS,
    falsePositiveRate: falsePositives / RUNS,
    liftDetectedRate: detected / RUNS,
  };
}
