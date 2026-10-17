import { beforeEach, expect, it, vi } from "vitest";
import type { Ga4Connection } from "@/server/features/ga4/repositories/Ga4ConnectionRepository";
import { fetchMeasurementGa4 } from "./measurementGa4";

const mocks = vi.hoisted(() => ({ runReport: vi.fn() }));
vi.mock("@/server/lib/ga4Client", () => ({
  createGa4DataClient: () => ({ runReport: mocks.runReport }),
}));

const connection: Ga4Connection = {
  id: "connection",
  projectId: "p",
  organizationId: "org",
  propertyId: "properties/1",
  propertyDisplayName: "Example",
  propertyTimeZone: "America/New_York",
  propertyCurrencyCode: "USD",
  connectedByUserId: "user",
  ga4AccountId: "account",
  connectedAccountEmail: null,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};
const windows = {
  baselineStart: "2026-01-01",
  baselineEnd: "2026-01-28",
  observationStart: "2026-02-05",
  observationThrough: "2026-03-04",
};
const input = (keyEvents: string[] = []) => ({
  connection,
  targetUrl: "https://example.com/pricing?ref=x",
  windows,
  keyEvents,
  ids: { projectId: "p", experimentId: "e", runId: "r" },
});
const row = (dimensions: string[], metrics: number[]) => ({
  dimensionValues: dimensions.map((value) => ({ value })),
  metricValues: metrics.map((value) => ({ value: String(value) })),
});

beforeEach(() => {
  mocks.runReport.mockResolvedValue({ rows: [] });
});

it("asks for organic sessions that started on the exact page, and keeps missing dates missing", async () => {
  mocks.runReport.mockResolvedValueOnce({
    rows: [
      row(["20260103"], [12, 9, 1, 40]),
      // Inside the excluded week after deployment: not part of either period.
      row(["20260201"], [99, 99, 9, 0]),
      row(["20260210"], [15, 11, 2, 55.5]),
    ],
  });
  const { days, eventTotals, requests } = await fetchMeasurementGa4(input());
  expect(mocks.runReport).toHaveBeenCalledTimes(1);
  expect(mocks.runReport.mock.calls[0]?.[0]).toMatchObject({
    dateRanges: [{ startDate: "2026-01-01", endDate: "2026-03-04" }],
    dimensions: [{ name: "date" }],
    metrics: [
      { name: "sessions" },
      { name: "engagedSessions" },
      { name: "keyEvents" },
      { name: "totalRevenue" },
    ],
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
              stringFilter: { matchType: "EXACT", value: "/pricing" },
            },
          },
        ],
      },
    },
  });
  expect(days.map((day) => [day.date, day.period, day.sessions])).toEqual([
    ["2026-01-03", "baseline", 12],
    ["2026-02-10", "observation", 15],
  ]);
  expect(days[1]).toMatchObject({ revenue: 55.5, currency: "USD" });
  expect(eventTotals).toEqual([]);
  expect(requests).toBe(1);
});

it("asks a second time for the chosen key events and sums them per period", async () => {
  mocks.runReport.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
    rows: [
      row(["20260102", "contact"], [2]),
      row(["20260104", "contact"], [3]),
      row(["20260212", "contact"], [4]),
    ],
  });
  const { eventTotals, requests } = await fetchMeasurementGa4(
    input(["contact"]),
  );
  expect(mocks.runReport.mock.calls[1]?.[0]).toMatchObject({
    dimensions: [{ name: "date" }, { name: "eventName" }],
    metrics: [{ name: "keyEvents" }],
    dimensionFilter: {
      andGroup: {
        expressions: [
          { filter: { fieldName: "sessionDefaultChannelGroup" } },
          { filter: { fieldName: "landingPage" } },
          {
            filter: {
              fieldName: "eventName",
              inListFilter: { values: ["contact"] },
            },
          },
        ],
      },
    },
  });
  expect(
    eventTotals.map((total) => [
      total.period,
      total.eventName,
      total.keyEvents,
    ]),
  ).toEqual([
    ["baseline", "contact", 5],
    ["observation", "contact", 4],
  ]);
  expect(requests).toBe(2);
});
