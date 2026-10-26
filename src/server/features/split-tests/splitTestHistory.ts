import { sortBy } from "remeda";
import { shiftGa4Date } from "@/server/features/ga4/services/Ga4Dates";
import { GscService } from "@/server/features/gsc/services/GscService";
import { literalPrefix } from "./splitTestBaseline";
import { createPathMatcher } from "@/shared/path-pattern";
import type { PastPage } from "./splitTestBacktest";

// RFC-0011 phase 3: the 91 past days that a backtest replays, from one
// Search Console request: a 56-day baseline, 7 excluded days, 28 days of
// observation. Clicks are per day of each window.
export async function pastClicks(
  projectId: string,
  pattern: string,
  end: string,
) {
  const start = shiftGa4Date(end, -90);
  const half = shiftGa4Date(start, 28);
  const baselineEnd = shiftGa4Date(start, 55);
  const observation = shiftGa4Date(start, 63);
  const matchesPath = createPathMatcher(pattern);
  const result = await GscService.getPerformance({
    projectId,
    dimensions: ["page", "date"],
    startDate: start,
    endDate: end,
    filters: [
      {
        dimension: "page",
        operator: "contains",
        expression: literalPrefix(pattern),
      },
    ],
    rowLimit: 25_000,
    dataState: "final",
  });
  const past = new Map<string, PastPage>();
  for (const row of result.rows) {
    const [url = "", date = ""] = row.keys ?? [];
    let path: string;
    try {
      path = new URL(url).pathname.replace(/\/+$/, "") || "/";
    } catch {
      continue;
    }
    if (!matchesPath(path)) continue;
    const entry = past.get(path) ?? {
      baseline: 0,
      observation: 0,
      firstHalf: 0,
      secondHalf: 0,
    };
    const clicks = row.clicks ?? 0;
    if (date <= baselineEnd) {
      entry.baseline += clicks / 56;
      if (date < half) entry.firstHalf += clicks / 28;
      else entry.secondHalf += clicks / 28;
    } else if (date >= observation) entry.observation += clicks / 28;
    past.set(path, entry);
  }
  return { start, end, past };
}

/** Pages with baseline clicks, paired with their neighbour by clicks (5.3). */
export function neighbourPairs(past: Map<string, PastPage>) {
  const sorted = sortBy(
    [...past.values()].filter((page) => page.baseline > 0),
    [(page) => page.baseline, "desc"],
  );
  const pairs: Array<[PastPage, PastPage]> = [];
  for (let index = 0; index + 1 < sorted.length; index += 2)
    pairs.push([sorted[index], sorted[index + 1]]);
  return pairs;
}
