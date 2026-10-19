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

/**
 * RFC-0017 5.3: site search terms and docs page views for one 28-day window.
 * Site search counts the `view_search_results` events of enhanced measurement.
 */
export async function fetchDocsGa4(input: {
  connection: Ga4Connection;
  range: { startDate: string; endDate: string };
  /** The docs path without a trailing slash, such as "/docs". */
  docsPath: string;
}) {
  const { connection } = input;
  const client = createGa4DataClient({
    userId: connection.connectedByUserId,
    ga4AccountId: connection.ga4AccountId,
    propertyId: connection.propertyId,
  });
  const base = {
    dateRanges: [input.range],
    offset: "0",
    limit: String(ROW_LIMIT),
    keepEmptyRows: false as const,
    returnPropertyQuota: true as const,
  };
  const [searches, views] = await Promise.all([
    client.runReport({
      ...base,
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
    }),
    client.runReport({
      ...base,
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
    searches: rowsOf(searches).map((row) => ({
      term: row.key,
      searches: row.count,
    })),
    views: rowsOf(views).map((row) => ({ path: row.key, views: row.count })),
  };
}
