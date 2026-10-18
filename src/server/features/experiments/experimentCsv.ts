import { sort } from "remeda";
import type {
  MeasurementDay,
  MeasurementGa4Day,
} from "@/types/schemas/experiments";

// RFC-0006 5.5: the daily rows of one experiment as CSV, built from stored
// rows only. A day without GA4 data has empty GA4 cells, never zeros.
const HEADER = [
  "page",
  "date",
  "period",
  "clicks",
  "impressions",
  "ctr",
  "position",
  "ga4_sessions",
  "ga4_engaged_sessions",
  "ga4_key_events",
  "ga4_revenue",
  "ga4_currency",
];
// A spreadsheet runs a cell that starts with one of these as a formula.
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number")
    return Number.isFinite(value) ? String(value) : "";
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return `"${text.replaceAll('"', '""')}"`;
}

export function experimentCsv(input: {
  targetUrl: string;
  days: MeasurementDay[];
  ga4Days: MeasurementGa4Day[];
}) {
  const page = new URL(input.targetUrl).pathname;
  const dates = sort(
    [...new Set([...input.days, ...input.ga4Days].map((day) => day.date))],
    (a, b) => a.localeCompare(b),
  );
  const lines = dates.map((date) => {
    const search = input.days.find((day) => day.date === date);
    const ga4 = input.ga4Days.find((day) => day.date === date);
    return [
      page,
      date,
      search?.period ?? ga4?.period,
      search?.clicks,
      search?.impressions,
      search?.ctr,
      search?.position,
      ga4?.sessions,
      ga4?.engagedSessions,
      ga4?.keyEvents,
      ga4?.revenue,
      ga4?.currency,
    ]
      .map(csvCell)
      .join(",");
  });
  return [HEADER.join(","), ...lines].join("\r\n") + "\r\n";
}
