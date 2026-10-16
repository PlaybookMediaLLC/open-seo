import type { Ga4Connection } from "@/server/features/ga4/repositories/Ga4ConnectionRepository";
import { createGa4DataClient } from "@/server/lib/ga4Client";
import type { Ga4LandingPageRow } from "./detectors/shared";

// ponytail: one page of rows ordered by sessions. Pages past it count as 0 key
// events; page through the report if large sites need them.
const GA4_ROW_LIMIT = 10_000;
const PERIODS = { date_range_0: "current", date_range_1: "previous" } as const;

type DateRange = { startDate: string; endDate: string };

/** One GA4 report: organic sessions, key events and revenue by landing page. */
export async function fetchGa4LandingPages(
  connection: Ga4Connection,
  current: DateRange,
  previous: DateRange,
): Promise<Ga4LandingPageRow[]> {
  const client = createGa4DataClient({
    userId: connection.connectedByUserId,
    ga4AccountId: connection.ga4AccountId,
    propertyId: connection.propertyId,
  });
  const response = await client.runReport({
    dateRanges: [current, previous],
    dimensions: [{ name: "hostName" }, { name: "landingPage" }],
    metrics: [
      { name: "sessions" },
      { name: "keyEvents" },
      { name: "purchaseRevenue" },
    ],
    dimensionFilter: {
      filter: {
        fieldName: "sessionDefaultChannelGroup",
        stringFilter: { matchType: "EXACT", value: "Organic Search" },
      },
    },
    offset: "0",
    limit: String(GA4_ROW_LIMIT),
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    keepEmptyRows: false,
    returnPropertyQuota: true,
  });
  // GA4 adds a dateRange dimension when a report has two date ranges.
  const names = response.dimensionHeaders?.map((header) => header.name) ?? [];
  return (response.rows ?? []).flatMap((row) => {
    const values = row.dimensionValues?.map((value) => value.value) ?? [];
    const hostName = values[names.indexOf("hostName")];
    const landingPage = values[names.indexOf("landingPage")];
    const range = values[names.indexOf("dateRange")];
    const period =
      range === "date_range_0" || range === "date_range_1"
        ? PERIODS[range]
        : null;
    const [sessions, keyEvents, revenue] = (row.metricValues ?? []).map(
      (value) => Number(value.value),
    );
    if (!period || !hostName || !landingPage?.startsWith("/")) return [];
    if (!Number.isFinite(sessions) || !Number.isFinite(keyEvents)) return [];
    return [
      {
        period,
        hostName,
        landingPage,
        sessions,
        keyEvents,
        revenue: Number.isFinite(revenue) ? revenue : null,
      },
    ];
  });
}
