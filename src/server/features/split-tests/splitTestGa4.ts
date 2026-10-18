import type { splitTestPages, splitTests } from "@/db/schema";
import { Ga4ConnectionRepository } from "@/server/features/ga4/repositories/Ga4ConnectionRepository";
import {
  ga4DateInTimeZone,
  shiftGa4Date,
} from "@/server/features/ga4/services/Ga4Dates";
import { createGa4DataClient } from "@/server/lib/ga4Client";
import { analyzeDays } from "./splitTestAnalysis";

// RFC-0011 phase 3: organic GA4 sessions and key events that start on the
// test pages, estimated with the same paired method as clicks. They are
// shown beside the result and never change its label.
const isoDate = (value: string) =>
  /^\d{8}$/.test(value)
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
    : null;

export async function ga4Secondary(
  test: typeof splitTests.$inferSelect,
  pages: Array<typeof splitTestPages.$inferSelect>,
  through: string,
  now: Date,
) {
  // RFC-0012 phase 2: a conversion test counts only its chosen key event.
  const eventMetric =
    test.metric === "conversions" && test.metricEvent
      ? `keyEvents:${test.metricEvent}`
      : "keyEvents";
  if (!test.baselineStart || !test.observationStart) return null;
  const connection = await Ga4ConnectionRepository.getByProjectId(
    test.projectId,
  );
  if (!connection) return null;
  const settled = shiftGa4Date(
    ga4DateInTimeZone(now, connection.propertyTimeZone),
    -3,
  );
  const end = through < settled ? through : settled;
  if (end < test.observationStart) return null;
  const response = await createGa4DataClient({
    userId: connection.connectedByUserId,
    ga4AccountId: connection.ga4AccountId,
    propertyId: connection.propertyId,
  }).runReport({
    dateRanges: [{ startDate: test.baselineStart, endDate: end }],
    dimensions: [{ name: "landingPage" }, { name: "date" }],
    metrics: [{ name: "sessions" }, { name: eventMetric }],
    dimensionFilter: {
      andGroup: {
        expressions: [
          {
            filter: {
              fieldName: "sessionDefaultChannelGroup",
              stringFilter: { matchType: "EXACT", value: "Organic Search" },
            },
          },
          {
            filter: {
              fieldName: "landingPage",
              inListFilter: { values: pages.map((page) => page.path) },
            },
          },
        ],
      },
    },
    offset: "0",
    limit: "25000",
    orderBys: [{ dimension: { dimensionName: "date" } }],
    keepEmptyRows: false,
    returnPropertyQuota: true,
  });
  const sessions: Array<{ path: string; date: string; clicks: number }> = [];
  const keyEvents: typeof sessions = [];
  for (const row of response.rows ?? []) {
    const [page, rawDate] = (row.dimensionValues ?? []).map(
      (value) => value.value ?? "",
    );
    const date = isoDate(rawDate ?? "");
    const [count, events] = (row.metricValues ?? []).map((value) =>
      Number(value.value),
    );
    if (!date || !page) continue;
    const path = page.replace(/\/+$/, "") || "/";
    if (Number.isFinite(count)) sessions.push({ path, date, clicks: count });
    if (Number.isFinite(events)) keyEvents.push({ path, date, clicks: events });
  }
  return {
    sessions: analyzeDays(test, pages, sessions, end),
    keyEvents: analyzeDays(test, pages, keyEvents, end),
  };
}

/**
 * RFC-0012 phase 2: the 56-day baseline of the chosen conversion for each
 * page, in the same shape as the clicks baseline, for the MDE check.
 */
export async function loadConversionBaseline(input: {
  projectId: string;
  eventName: string;
  paths: string[];
  window: { start: string; end: string };
}) {
  const connection = await Ga4ConnectionRepository.getByProjectId(
    input.projectId,
  );
  if (!connection) return null;
  const response = await createGa4DataClient({
    userId: connection.connectedByUserId,
    ga4AccountId: connection.ga4AccountId,
    propertyId: connection.propertyId,
  }).runReport({
    dateRanges: [{ startDate: input.window.start, endDate: input.window.end }],
    dimensions: [{ name: "landingPage" }, { name: "date" }],
    metrics: [{ name: `keyEvents:${input.eventName}` }],
    dimensionFilter: {
      andGroup: {
        expressions: [
          {
            filter: {
              fieldName: "sessionDefaultChannelGroup",
              stringFilter: { matchType: "EXACT", value: "Organic Search" },
            },
          },
          {
            filter: {
              fieldName: "landingPage",
              inListFilter: { values: input.paths },
            },
          },
        ],
      },
    },
    offset: "0",
    limit: "25000",
    orderBys: [{ dimension: { dimensionName: "date" } }],
    keepEmptyRows: false,
    returnPropertyQuota: true,
  });
  const secondHalf = shiftGa4Date(input.window.start, 28);
  const pages = new Map(
    input.paths.map((path) => [
      path,
      { conversions: 0, firstHalf: 0, secondHalf: 0 },
    ]),
  );
  for (const row of response.rows ?? []) {
    const [page, rawDate] = (row.dimensionValues ?? []).map(
      (value) => value.value ?? "",
    );
    const date = isoDate(rawDate ?? "");
    const count = Number(row.metricValues?.[0]?.value);
    const entry = pages.get(page?.replace(/\/+$/, "") || "/");
    if (!date || !entry || !Number.isFinite(count)) continue;
    entry.conversions += count;
    if (date < secondHalf) entry.firstHalf += count;
    else entry.secondHalf += count;
  }
  return pages;
}
