import {
  ga4DateInTimeZone,
  shiftGa4Date,
} from "@/server/features/ga4/services/Ga4Dates";
import { GscService } from "@/server/features/gsc/services/GscService";
import { AppError } from "@/server/lib/errors";
import { growth, pairDifferences, type Pair } from "./splitStats";

// RFC-0011 5.2: the 56-day baseline of the pages that match a pattern, from
// one Search Console request of final data on the Pacific calendar.
const BASELINE_DAYS = 56;
const HALF = 28;
const ROW_LIMIT = 25_000;

type BaselineStats = {
  path: string;
  origin: string;
  clicks: number;
  impressions: number;
  /** Clicks in the first and the last 28 days, for the pre-period check. */
  firstHalf: number;
  secondHalf: number;
};

/** The literal start of a path pattern, for the request's contains filter. */
const literalPrefix = (pattern: string) =>
  pattern.slice(1).match(/^[^\\^$.|?*+()[\]{}]*/)?.[0] || "/";

const pathOf = (url: string) => {
  try {
    const parsed = new URL(url);
    return {
      origin: parsed.origin,
      path: parsed.pathname.replace(/\/+$/, "") || "/",
    };
  } catch {
    return null;
  }
};

export function baselineWindow(now = new Date()) {
  const end = shiftGa4Date(ga4DateInTimeZone(now, "America/Los_Angeles"), -3);
  return { start: shiftGa4Date(end, 1 - BASELINE_DAYS), end };
}

export async function loadBaseline(
  projectId: string,
  pattern: string,
  window: { start: string; end: string },
): Promise<BaselineStats[]> {
  const regex = new RegExp(pattern);
  const secondHalfStart = shiftGa4Date(window.start, HALF);
  const result = await GscService.getPerformance({
    projectId,
    dimensions: ["page", "date"],
    startDate: window.start,
    endDate: window.end,
    filters: [
      {
        dimension: "page",
        operator: "contains",
        expression: literalPrefix(pattern),
      },
    ],
    rowLimit: ROW_LIMIT,
    dataState: "final",
  });
  if (result.rows.length >= ROW_LIMIT)
    throw new AppError(
      "VALIDATION_ERROR",
      "Too many pages share the start of this pattern. Start it with a longer fixed path.",
    );
  const pages = new Map<string, BaselineStats>();
  for (const row of result.rows) {
    const [url = "", date = ""] = row.keys ?? [];
    const page = pathOf(url);
    if (!page || !regex.test(page.path)) continue;
    const entry = pages.get(page.path) ?? {
      ...page,
      clicks: 0,
      impressions: 0,
      firstHalf: 0,
      secondHalf: 0,
    };
    const clicks = row.clicks ?? 0;
    entry.clicks += clicks;
    entry.impressions += row.impressions ?? 0;
    if (date < secondHalfStart) entry.firstHalf += clicks;
    else entry.secondHalf += clicks;
    pages.set(page.path, entry);
  }
  return [...pages.values()];
}

/** 5.5 pre-period check: each pair's growth from the first 28 days to the last. */
export function prePeriodDifferences(pairs: Pair[], pages: BaselineStats[]) {
  const byPath = new Map(pages.map((page) => [page.path, page]));
  return pairDifferences(pairs, (path) => {
    const page = byPath.get(path);
    return growth(
      (page?.firstHalf ?? 0) / HALF,
      (page?.secondHalf ?? 0) / HALF,
    );
  });
}
