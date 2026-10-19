import type { Ga4Connection } from "@/server/features/ga4/repositories/Ga4ConnectionRepository";
import { createGa4DataClient } from "@/server/lib/ga4Client";

// ponytail: the top 1,000 rows of each report; rarer terms and pages are
// left out.
const ROW_LIMIT = 1_000;

type Report = Awaited<
  ReturnType<ReturnType<typeof createGa4DataClient>["runReport"]>
>;
const rowsOf = (report: Report) =>
  (report.rows ?? []).map((row) => ({
    key: row.dimensionValues?.[0]?.value ?? "",
    count: Number(row.metricValues?.[0]?.value) || 0,
  }));

type Range = { startDate: string; endDate: string };
const clientOf = (connection: Ga4Connection) =>
  createGa4DataClient({
    userId: connection.connectedByUserId,
    ga4AccountId: connection.ga4AccountId,
    propertyId: connection.propertyId,
  });
const base = (range: Range) => ({
  dateRanges: [range],
  offset: "0",
  limit: String(ROW_LIMIT),
  keepEmptyRows: false as const,
  returnPropertyQuota: true as const,
});

/**
 * RFC-0017 5.3 and 5.7: site search terms, from the `view_search_results`
 * events of GA4 enhanced measurement.
 */
export async function fetchSiteSearches(
  connection: Ga4Connection,
  range: Range,
) {
  const report = await clientOf(connection).runReport({
    ...base(range),
    dimensions: [{ name: "searchTerm" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      andGroup: {
        expressions: [
          {
            filter: {
              fieldName: "eventName",
              stringFilter: {
                matchType: "EXACT",
                value: "view_search_results",
              },
            },
          },
          {
            notExpression: {
              filter: {
                fieldName: "searchTerm",
                stringFilter: { matchType: "EXACT", value: "(not set)" },
              },
            },
          },
        ],
      },
    },
    orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
  });
  return rowsOf(report).map((row) => ({ term: row.key, searches: row.count }));
}

/** RFC-0017 5.3: site search terms and docs page views for one window. */
export async function fetchDocsGa4(input: {
  connection: Ga4Connection;
  range: Range;
  /** The docs path without a trailing slash, such as "/docs". */
  docsPath: string;
}) {
  const [searches, views] = await Promise.all([
    fetchSiteSearches(input.connection, input.range),
    clientOf(input.connection).runReport({
      ...base(input.range),
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }],
      dimensionFilter: {
        filter: {
          fieldName: "pagePath",
          stringFilter: { matchType: "BEGINS_WITH", value: input.docsPath },
        },
      },
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    }),
  ]);
  return {
    searches,
    views: rowsOf(views).map((row) => ({ path: row.key, views: row.count })),
  };
}
