import { sortBy, sum } from "remeda";
import type { splitTestPages, splitTests } from "@/db/schema";
import { shiftGa4Date } from "@/server/features/ga4/services/Ga4Dates";
import {
  analyze,
  growth,
  harmful,
  labelOf,
  randomizationTest,
} from "./splitStats";

// RFC-0011 5.5: the estimate from the stored days. Baseline: 56 days before
// the deployment; observation: from day 8 after it, through the last final
// day, at most 28 days.
const DAY_MS = 86_400_000;

type Test = typeof splitTests.$inferSelect;
type Page = typeof splitTestPages.$inferSelect;

const daysBetween = (start: string, end: string) =>
  Math.round((Date.parse(end) - Date.parse(start)) / DAY_MS) + 1;

type Windows = Pick<
  Test,
  | "seed"
  | "baselineStart"
  | "baselineEnd"
  | "observationStart"
  | "observationEnd"
>;
type PageRow = Pick<Page, "path" | "pairIndex" | "bucket">;
type Day = { path: string; date: string; clicks: number };

/** Each pair's observation and pre-period differences, through `through`. */
function pairDifferences(
  test: Windows,
  pages: PageRow[],
  days: Day[],
  through: string,
) {
  const { baselineStart, baselineEnd, observationStart, observationEnd } = test;
  if (!baselineStart || !baselineEnd || !observationStart || !observationEnd)
    return null;
  const last = through < observationEnd ? through : observationEnd;
  if (last < observationStart) return null;
  const observationDays = daysBetween(observationStart, last);
  const halfStart = shiftGa4Date(baselineStart, 28);
  const clicks = (path: string, from: string, to: string) =>
    sum(
      days
        .filter(
          (day) => day.path === path && day.date >= from && day.date <= to,
        )
        .map((day) => day.clicks),
    );
  const pairs = new Map<number, { variant?: string; control?: string }>();
  for (const page of pages)
    pairs.set(page.pairIndex, {
      ...pairs.get(page.pairIndex),
      [page.bucket]: page.path,
    });
  return {
    observationDays,
    windowComplete: last >= observationEnd,
    rows: [...pairs.values()].flatMap((pair) => {
      const { variant, control } = pair;
      if (!variant || !control) return [];
      const score = (path: string) =>
        growth(
          clicks(path, baselineStart, baselineEnd) / 56,
          clicks(path, observationStart, last) / observationDays,
        );
      const preScore = (path: string) =>
        growth(
          clicks(path, baselineStart, shiftGa4Date(halfStart, -1)) / 28,
          clicks(path, halfStart, baselineEnd) / 28,
        );
      return [
        {
          variant,
          control,
          d: score(variant) - score(control),
          preD: preScore(variant) - preScore(control),
        },
      ];
    }),
  };
}

/** The estimate so far, from the stored days of each pair. */
export function analyzeDays(
  test: Windows,
  pages: PageRow[],
  days: Day[],
  through: string,
) {
  const differences = pairDifferences(test, pages, days, through);
  if (!differences) return null;
  const { observationDays, windowComplete, rows } = differences;
  const seed = test.seed ?? 0;
  const result = analyze(
    rows.map((row) => row.d),
    seed,
  );
  const prePeriodP = randomizationTest(
    rows.map((row) => row.preD),
    seed,
  ).pValue;
  return {
    ...result,
    observationDays,
    prePeriodP,
    windowComplete,
    label: labelOf({ windowComplete, prePeriodP, ...result }),
    harmful: harmful(observationDays, result),
  };
}

const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;

/**
 * One row per pair with the columns scripts/split-test-reference.py reads,
 * so an owner can recompute the estimate, the interval and the p-value.
 */
export function pairCsv(
  test: Windows,
  pages: PageRow[],
  days: Day[],
  through: string,
) {
  const differences = pairDifferences(test, pages, days, through);
  return [
    "variant,control,d,pre_d,seed",
    ...(differences?.rows ?? []).map((row) =>
      [
        quote(row.variant),
        quote(row.control),
        row.d,
        row.preD,
        test.seed ?? 0,
      ].join(","),
    ),
  ].join("\n");
}

/**
 * 5.9 step 4: each group's daily clicks indexed to its baseline mean (100),
 * as a 7-day trailing average.
 */
export function groupSeries(
  test: Pick<Test, "baselineStart" | "baselineEnd">,
  pages: PageRow[],
  days: Day[],
) {
  if (!test.baselineStart || !test.baselineEnd) return [];
  const bucketOf = new Map(pages.map((page) => [page.path, page.bucket]));
  const totals = new Map<string, { variant: number; control: number }>();
  for (const day of days) {
    const bucket = bucketOf.get(day.path);
    if (!bucket) continue;
    const entry = totals.get(day.date) ?? { variant: 0, control: 0 };
    entry[bucket] += day.clicks;
    totals.set(day.date, entry);
  }
  const dates = sortBy([...totals.keys()], (date) => date);
  const baseline = dates.filter(
    (date) =>
      date >= (test.baselineStart ?? "") && date <= (test.baselineEnd ?? ""),
  );
  const mean = (bucket: "variant" | "control") =>
    sum(baseline.map((date) => totals.get(date)?.[bucket] ?? 0)) /
      (baseline.length || 1) || 1;
  const base = { variant: mean("variant"), control: mean("control") };
  return dates.map((date, index) => {
    const window = dates.slice(Math.max(0, index - 6), index + 1);
    const average = (bucket: "variant" | "control") =>
      Math.round(
        (100 * sum(window.map((day) => totals.get(day)?.[bucket] ?? 0))) /
          window.length /
          base[bucket],
      );
    return { date, variant: average("variant"), control: average("control") };
  });
}
