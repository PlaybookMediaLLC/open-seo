import { sort } from "remeda";
import {
  ga4DateInTimeZone,
  shiftGa4Date,
} from "@/server/features/ga4/services/Ga4Dates";
import { Ga4ConnectionRepository } from "@/server/features/ga4/repositories/Ga4ConnectionRepository";
import {
  authorize,
  type OpportunityContext,
} from "@/server/features/opportunities/services/opportunityAccess";
import { createGa4DataClient } from "@/server/lib/ga4Client";
import {
  PERFORMANCE_METRICS,
  type PerformanceMetric,
} from "@/shared/performance";

// RFC-0014 5.7: the snippet's events, read from the site's own GA4. GA4 has
// no percentile of an event value, so the report counts loads by
// web-vitals' rating: 75% or more "good" is the same test as a good p75.
const PAGES = 20;
const ROW_LIMIT = 10_000;

type VitalsPage = {
  pagePath: string;
  loads: number;
  good: Record<PerformanceMetric, number | null>;
};

type Counts = { good: number; total: number };
const share = (counts: Counts) =>
  counts.total ? counts.good / counts.total : null;

/** The share of good loads per page and metric, busiest pages first. */
export function vitalsPages(
  rows: Array<{
    pagePath: string;
    eventName: string;
    rating: string;
    count: number;
  }>,
): VitalsPage[] {
  const pages = new Map<string, Record<PerformanceMetric, Counts>>();
  for (const row of rows) {
    const metric = PERFORMANCE_METRICS.find(
      (item) => item === row.eventName.toLowerCase(),
    );
    if (!metric) continue;
    const page = pages.get(row.pagePath) ?? {
      lcp: { good: 0, total: 0 },
      inp: { good: 0, total: 0 },
      cls: { good: 0, total: 0 },
    };
    page[metric].total += row.count;
    if (row.rating === "good") page[metric].good += row.count;
    pages.set(row.pagePath, page);
  }
  return sort(
    [...pages].map(([pagePath, page]) => ({
      pagePath,
      loads: Math.max(page.lcp.total, page.inp.total, page.cls.total),
      good: {
        lcp: share(page.lcp),
        inp: share(page.inp),
        cls: share(page.cls),
      },
    })),
    (a, b) => b.loads - a.loads || a.pagePath.localeCompare(b.pagePath),
  ).slice(0, PAGES);
}

async function report(context: OpportunityContext, projectId: string) {
  await authorize(context, projectId);
  const connection = await Ga4ConnectionRepository.getByProjectId(projectId);
  if (!connection) return { status: "not_connected" as const };
  const endDate = shiftGa4Date(
    ga4DateInTimeZone(new Date(), connection.propertyTimeZone),
    -1,
  );
  try {
    const response = await createGa4DataClient({
      userId: connection.connectedByUserId,
      ga4AccountId: connection.ga4AccountId,
      propertyId: connection.propertyId,
    }).runReport({
      dateRanges: [{ startDate: shiftGa4Date(endDate, -27), endDate }],
      dimensions: [
        { name: "pagePath" },
        { name: "eventName" },
        { name: "customEvent:metric_rating" },
      ],
      metrics: [{ name: "eventCount" }],
      orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          inListFilter: { values: ["LCP", "INP", "CLS"] },
        },
      },
      offset: "0",
      limit: String(ROW_LIMIT),
      keepEmptyRows: false,
      returnPropertyQuota: true,
    });
    const pages = vitalsPages(
      (response.rows ?? []).map((row) => ({
        pagePath: row.dimensionValues?.[0]?.value ?? "",
        eventName: row.dimensionValues?.[1]?.value ?? "",
        rating: row.dimensionValues?.[2]?.value ?? "",
        count: Number(row.metricValues?.[0]?.value) || 0,
      })),
    );
    return pages.length
      ? { status: "ready" as const, endDate, pages }
      : { status: "no_events" as const };
  } catch {
    // GA4 refuses the report until metric_rating is a custom dimension.
    return { status: "not_ready" as const };
  }
}

export const PerformanceVitalsService = { report };
