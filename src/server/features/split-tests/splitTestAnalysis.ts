import { sum } from "remeda";
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

/** The estimate so far, from the stored days of each pair. */
export function analyzeDays(
  test: Pick<
    Test,
    | "seed"
    | "baselineStart"
    | "baselineEnd"
    | "observationStart"
    | "observationEnd"
  >,
  pages: Array<Pick<Page, "path" | "pairIndex" | "bucket">>,
  days: Array<{ path: string; date: string; clicks: number }>,
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
  const complete = [...pairs.values()].flatMap((pair) =>
    pair.variant && pair.control
      ? [{ variant: pair.variant, control: pair.control }]
      : [],
  );
  const difference = (score: (path: string) => number) =>
    complete.map((pair) => score(pair.variant) - score(pair.control));
  const d = difference((path) =>
    growth(
      clicks(path, baselineStart, baselineEnd) / 56,
      clicks(path, observationStart, last) / observationDays,
    ),
  );
  const preD = difference((path) =>
    growth(
      clicks(path, baselineStart, shiftGa4Date(halfStart, -1)) / 28,
      clicks(path, halfStart, baselineEnd) / 28,
    ),
  );
  const seed = test.seed ?? 0;
  const result = analyze(d, seed);
  const prePeriodP = randomizationTest(preD, seed).pValue;
  const windowComplete = last >= observationEnd;
  return {
    ...result,
    observationDays,
    prePeriodP,
    windowComplete,
    label: labelOf({ windowComplete, prePeriodP, ...result }),
    harmful: harmful(observationDays, result),
  };
}
