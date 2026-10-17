import { expect, it } from "vitest";
import type {
  MeasurementDay,
  MeasurementGa4Day,
} from "@/types/schemas/experiments";
import { experimentCsv } from "./experimentCsv";

const ids = { id: "x", projectId: "p", experimentId: "e", runId: "r" };
const search = (date: string, period: MeasurementDay["period"]) =>
  ({
    ...ids,
    date,
    period,
    clicks: 5,
    impressions: 100,
    ctr: 0.05,
    position: 4.5,
  }) satisfies MeasurementDay;
const ga4 = (date: string): MeasurementGa4Day => ({
  ...ids,
  date,
  period: "baseline",
  sessions: 12,
  engagedSessions: 9,
  keyEvents: 1,
  revenue: -3.5,
  currency: "USD",
});

it("merges Search Console and GA4 rows by date and leaves missing GA4 days empty", () => {
  const csv = experimentCsv({
    targetUrl: "https://example.com/pricing",
    days: [
      search("2026-01-02", "baseline"),
      search("2026-02-10", "observation"),
    ],
    ga4Days: [ga4("2026-01-02")],
  });
  expect(csv.split("\r\n")).toEqual([
    "page,date,period,clicks,impressions,ctr,position,ga4_sessions,ga4_engaged_sessions,ga4_key_events,ga4_revenue,ga4_currency",
    '"/pricing","2026-01-02","baseline",5,100,0.05,4.5,12,9,1,-3.5,"USD"',
    '"/pricing","2026-02-10","observation",5,100,0.05,4.5,,,,,',
    "",
  ]);
});

it("escapes text that a spreadsheet would run as a formula", () => {
  // A page path starts with "/", so text from GA4 is the risk here.
  const csv = experimentCsv({
    targetUrl: "https://example.com/pricing",
    days: [],
    ga4Days: [{ ...ga4("2026-01-02"), currency: '=HYPERLINK("x")' }],
  });
  expect(csv.split("\r\n")[1]).toMatch(/,"'=HYPERLINK\(""x""\)"$/);
});
