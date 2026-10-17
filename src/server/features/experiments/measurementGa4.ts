import type { Ga4Connection } from "@/server/features/ga4/repositories/Ga4ConnectionRepository";
import {
  ga4DateInTimeZone,
  shiftGa4Date,
} from "@/server/features/ga4/services/Ga4Dates";
import { createGa4DataClient } from "@/server/lib/ga4Client";
import {
  Ga4DataApiError,
  Ga4MalformedResponseError,
  Ga4TokenError,
} from "@/server/lib/ga4Errors";
import type {
  MeasurementGa4Day,
  MeasurementGa4EventTotal,
} from "@/types/schemas/experiments";

// RFC-0006 5.1: at most two GA4 requests per measurement run, for organic
// sessions that started on the changed page. GA4 reports in the property's
// time zone on the same calendar dates as Search Console.
type Windows = {
  baselineStart: string;
  baselineEnd: string;
  observationStart: string;
  observationThrough: string | null;
};
type Ids = { projectId: string; experimentId: string; runId: string };

const isoDate = (value: string) =>
  /^\d{8}$/.test(value)
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
    : null;

function periodOf(date: string, windows: Windows) {
  if (date >= windows.baselineStart && date <= windows.baselineEnd)
    return "baseline" as const;
  if (
    windows.observationThrough &&
    date >= windows.observationStart &&
    date <= windows.observationThrough
  )
    return "observation" as const;
  return null;
}

/** A safe reason for the results page; never a provider body. */
export function ga4Failure(error: unknown) {
  return error instanceof Ga4DataApiError ||
    error instanceof Ga4TokenError ||
    error instanceof Ga4MalformedResponseError
    ? error.message
    : "GA4 data could not be read.";
}

export async function fetchMeasurementGa4(input: {
  connection: Ga4Connection;
  targetUrl: string;
  windows: Windows;
  keyEvents: string[];
  ids: Ids;
}) {
  const { connection, windows, ids } = input;
  // GA4 can still change its last days, so stop 3 days before today.
  const settled = shiftGa4Date(
    ga4DateInTimeZone(new Date(), connection.propertyTimeZone),
    -3,
  );
  const wanted = windows.observationThrough ?? windows.baselineEnd;
  const endDate = wanted < settled ? wanted : settled;
  const client = createGa4DataClient({
    userId: connection.connectedByUserId,
    ga4AccountId: connection.ga4AccountId,
    propertyId: connection.propertyId,
  });
  const pageFilter = [
    {
      filter: {
        fieldName: "sessionDefaultChannelGroup",
        stringFilter: { matchType: "EXACT", value: "Organic Search" },
      },
    },
    {
      filter: {
        fieldName: "landingPage",
        stringFilter: {
          matchType: "EXACT",
          value: new URL(input.targetUrl).pathname,
        },
      },
    },
  ];
  const report = (
    dimensions: string[],
    metrics: string[],
    filters: unknown[],
  ) =>
    client.runReport({
      dateRanges: [{ startDate: windows.baselineStart, endDate }],
      dimensions: dimensions.map((name) => ({ name })),
      metrics: metrics.map((name) => ({ name })),
      dimensionFilter: { andGroup: { expressions: filters } },
      offset: "0",
      limit: "1000",
      orderBys: [{ dimension: { dimensionName: "date" } }],
      keepEmptyRows: false,
      returnPropertyQuota: true,
    });
  const totals = await report(
    ["date"],
    ["sessions", "engagedSessions", "keyEvents", "totalRevenue"],
    pageFilter,
  );
  const days: MeasurementGa4Day[] = (totals.rows ?? []).flatMap((row) => {
    const date = isoDate(row.dimensionValues?.[0]?.value ?? "");
    const period = date ? periodOf(date, windows) : null;
    const [sessions, engagedSessions, keyEvents, revenue] = (
      row.metricValues ?? []
    ).map((value) => Number(value.value));
    if (!date || !period) return [];
    if (![sessions, engagedSessions, keyEvents].every(Number.isFinite))
      return [];
    return [
      {
        ...ids,
        id: crypto.randomUUID(),
        date,
        period,
        sessions,
        engagedSessions,
        keyEvents,
        revenue: Number.isFinite(revenue) ? revenue : null,
        currency: Number.isFinite(revenue)
          ? connection.propertyCurrencyCode
          : null,
      },
    ];
  });
  if (!input.keyEvents.length) return { days, eventTotals: [], requests: 1 };
  const events = await report(
    ["date", "eventName"],
    ["keyEvents"],
    [
      ...pageFilter,
      {
        filter: {
          fieldName: "eventName",
          inListFilter: { values: input.keyEvents },
        },
      },
    ],
  );
  const sums = new Map<string, MeasurementGa4EventTotal>();
  for (const row of events.rows ?? []) {
    const [rawDate, eventName] = (row.dimensionValues ?? []).map(
      (value) => value.value,
    );
    const date = isoDate(rawDate ?? "");
    const period = date ? periodOf(date, windows) : null;
    const value = Number(row.metricValues?.[0]?.value);
    if (!period || !eventName || !Number.isFinite(value)) continue;
    const key = `${period}:${eventName}`;
    const total = sums.get(key) ?? {
      id: crypto.randomUUID(),
      projectId: ids.projectId,
      runId: ids.runId,
      period,
      eventName,
      keyEvents: 0,
    };
    total.keyEvents += value;
    sums.set(key, total);
  }
  return { days, eventTotals: [...sums.values()], requests: 2 };
}

/** The property's key events with any count in the last 28 days. */
export async function fetchKeyEventNames(connection: Ga4Connection) {
  const endDate = shiftGa4Date(
    ga4DateInTimeZone(new Date(), connection.propertyTimeZone),
    -1,
  );
  const response = await createGa4DataClient({
    userId: connection.connectedByUserId,
    ga4AccountId: connection.ga4AccountId,
    propertyId: connection.propertyId,
  }).runReport({
    dateRanges: [{ startDate: shiftGa4Date(endDate, -27), endDate }],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "keyEvents" }],
    metricFilter: {
      filter: {
        fieldName: "keyEvents",
        numericFilter: {
          operation: "GREATER_THAN",
          value: { int64Value: "0" },
        },
      },
    },
    offset: "0",
    limit: "50",
    orderBys: [{ metric: { metricName: "keyEvents" }, desc: true }],
    keepEmptyRows: false,
    returnPropertyQuota: true,
  });
  return (response.rows ?? []).flatMap(
    (row) => row.dimensionValues?.[0]?.value ?? [],
  );
}
