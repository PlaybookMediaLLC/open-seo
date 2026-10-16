import { z } from "zod";
import type { Ga4Connection } from "@/server/features/ga4/repositories/Ga4ConnectionRepository";
import { shiftGa4Date } from "@/server/features/ga4/services/Ga4Dates";
import { GscService } from "@/server/features/gsc/services/GscService";
import { AppError } from "@/server/lib/errors";
import { fetchGa4LandingPages } from "./opportunityGa4";

const QUERY_ROW_LIMIT = 5000;
const PAGE_ROW_LIMIT = 1000;
const YEAR_DAYS = 364;
const providerRows = z
  .array(
    z.object({
      keys: z.array(z.string()).optional(),
      clicks: z.number().nonnegative(),
      impressions: z.number().nonnegative(),
      ctr: z.number().min(0).max(1),
      position: z.number().nonnegative(),
    }),
  )
  .max(QUERY_ROW_LIMIT);

type DateRange = { startDate: string; endDate: string };

function yearAgo(range: DateRange): DateRange {
  return {
    startDate: shiftGa4Date(range.startDate, -YEAR_DAYS),
    endDate: shiftGa4Date(range.endDate, -YEAR_DAYS),
  };
}

/**
 * Five free Search Console reports and, when connected, one GA4 report. The
 * caller reserves this request count first and races it against a deadline.
 */
export async function requestDetectionData(input: {
  projectId: string;
  siteUrl: string;
  current: DateRange;
  previous: DateRange;
  ga4Connection: Ga4Connection | null;
  signal: AbortSignal;
}) {
  const { signal } = input;
  const base = {
    projectId: input.projectId,
    rowLimit: PAGE_ROW_LIMIT,
    type: "web" as const,
    dataState: "final" as const,
    dimensions: ["page" as const],
  };
  const pageWindows = [
    input.current,
    input.previous,
    yearAgo(input.current),
    yearAgo(input.previous),
  ];
  const [results, ga4Rows] = await Promise.all([
    Promise.all([
      GscService.getPerformance(
        {
          ...base,
          ...input.current,
          rowLimit: QUERY_ROW_LIMIT,
          dimensions: ["query", "page"],
        },
        { signal },
      ),
      ...pageWindows.map((range) =>
        GscService.getPerformance({ ...base, ...range }, { signal }),
      ),
    ]),
    // GA4 only adds a commercial signal, so its failure must not fail the run.
    input.ga4Connection
      ? fetchGa4LandingPages(
          input.ga4Connection,
          input.current,
          input.previous,
        ).catch(() => null)
      : null,
  ]);
  if (results.some((result) => result.siteUrl !== input.siteUrl)) {
    throw new AppError(
      "CONFLICT",
      "Search Console property changed during analysis.",
    );
  }
  const [
    queryPages,
    currentPages,
    previousPages,
    yearAgoPages,
    yearAgoPreviousPages,
  ] = results.map((result) => providerRows.parse(result.rows));
  return {
    queryPages,
    currentPages,
    previousPages,
    yearAgoPages,
    yearAgoPreviousPages,
    ga4Rows,
    truncated: results.some(
      (result, index) =>
        result.rows.length >= (index === 0 ? QUERY_ROW_LIMIT : PAGE_ROW_LIMIT),
    ),
  };
}
