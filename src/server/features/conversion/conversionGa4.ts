import type { Ga4Connection } from "@/server/features/ga4/repositories/Ga4ConnectionRepository";
import { createGa4DataClient } from "@/server/lib/ga4Client";
import type { ConversionPage } from "./conversionDetectors";

// ponytail: one page of rows ordered by sessions; pages past it are left out.
// Page through the report if large sites need them.
const ROW_LIMIT = 10_000;
const ORGANIC = {
  filter: {
    fieldName: "sessionDefaultChannelGroup",
    stringFilter: { matchType: "EXACT", value: "Organic Search" },
  },
};

type DateRange = { startDate: string; endDate: string };
type Rows = Awaited<
  ReturnType<ReturnType<typeof createGa4DataClient>["runReport"]>
>;

/** Each row as dimension and metric values by header name. */
function rowsOf(response: Rows) {
  const dimensions = response.dimensionHeaders?.map((header) => header.name);
  const metrics = response.metricHeaders?.map((header) => header.name);
  return (response.rows ?? []).map((row) => ({
    dimension: (name: string) =>
      row.dimensionValues?.[dimensions?.indexOf(name) ?? -1]?.value ?? "",
    metric: (index: number) => {
      const value = Number(row.metricValues?.[index]?.value);
      return metrics && Number.isFinite(value) ? value : 0;
    },
  }));
}

/**
 * RFC-0012 5.3: sessions, engaged sessions and the chosen key event by
 * landing page and device, plus form events by page, for one 28-day window.
 */
export async function fetchConversionPages(input: {
  connection: Ga4Connection;
  range: DateRange;
  eventName: string;
  channel: "organic_search" | "all";
  formsMeasured: boolean;
}): Promise<ConversionPage[]> {
  const { connection, range, eventName, channel } = input;
  const client = createGa4DataClient({
    userId: connection.connectedByUserId,
    ga4AccountId: connection.ga4AccountId,
    propertyId: connection.propertyId,
  });
  const base = {
    dateRanges: [range],
    offset: "0",
    limit: String(ROW_LIMIT),
    keepEmptyRows: false as const,
    returnPropertyQuota: true as const,
  };
  const formFilter = {
    filter: {
      fieldName: "eventName",
      inListFilter: { values: ["form_start", "form_submit"] },
    },
  };
  const [landing, forms] = await Promise.all([
    client.runReport({
      ...base,
      dimensions: [
        { name: "hostName" },
        { name: "landingPage" },
        { name: "deviceCategory" },
      ],
      metrics: [
        { name: "sessions" },
        { name: "engagedSessions" },
        { name: `keyEvents:${eventName}` },
      ],
      dimensionFilter: channel === "organic_search" ? ORGANIC : undefined,
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    }),
    input.formsMeasured
      ? client.runReport({
          ...base,
          dimensions: [
            { name: "hostName" },
            { name: "pagePath" },
            { name: "eventName" },
          ],
          metrics: [{ name: "eventCount" }],
          dimensionFilter:
            channel === "organic_search"
              ? { andGroup: { expressions: [ORGANIC, formFilter] } }
              : formFilter,
          orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
        })
      : null,
  ]);
  const pages = new Map<string, ConversionPage>();
  for (const row of rowsOf(landing)) {
    const hostName = row.dimension("hostName").toLowerCase();
    const landingPage = row.dimension("landingPage");
    if (!hostName || !landingPage.startsWith("/")) continue;
    const key = `${hostName}${landingPage}`;
    const page = pages.get(key) ?? {
      hostName,
      landingPage,
      sessions: 0,
      conversions: 0,
      engagedSessions: 0,
      mobile: { sessions: 0, conversions: 0 },
      desktop: { sessions: 0, conversions: 0 },
      forms: null,
    };
    const visits = { sessions: row.metric(0), conversions: row.metric(2) };
    page.sessions += visits.sessions;
    page.conversions += visits.conversions;
    page.engagedSessions += row.metric(1);
    const device = row.dimension("deviceCategory");
    if (device === "mobile" || device === "desktop") {
      page[device].sessions += visits.sessions;
      page[device].conversions += visits.conversions;
    }
    pages.set(key, page);
  }
  for (const row of forms ? rowsOf(forms) : []) {
    const page = pages.get(
      `${row.dimension("hostName").toLowerCase()}${row.dimension("pagePath")}`,
    );
    if (!page) continue;
    page.forms ??= { starts: 0, submits: 0 };
    if (row.dimension("eventName") === "form_start")
      page.forms.starts += row.metric(0);
    else page.forms.submits += row.metric(0);
  }
  return [...pages.values()];
}
