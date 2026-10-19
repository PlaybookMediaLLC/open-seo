import { beforeEach, expect, it, vi } from "vitest";
import {
  PerformanceVitalsService,
  vitalsPages,
} from "./PerformanceVitalsService";

// RFC-0014 5.7: the snippet's events by page and rating, from GA4.
const mocks = vi.hoisted(() => ({
  runReport: vi.fn<(request: { dimensions: unknown[] }) => Promise<unknown>>(),
  connection: vi.fn(),
}));
vi.mock("@/server/features/opportunities/services/opportunityAccess", () => ({
  authorize: async () => undefined,
}));
vi.mock("@/server/features/ga4/repositories/Ga4ConnectionRepository", () => ({
  Ga4ConnectionRepository: { getByProjectId: mocks.connection },
}));
vi.mock("@/server/lib/ga4Client", () => ({
  createGa4DataClient: () => ({ runReport: mocks.runReport }),
}));
const context = { organizationId: "org", userId: "owner", role: "owner" };
const row = (path: string, event: string, rating: string, count: number) => ({
  dimensionValues: [{ value: path }, { value: event }, { value: rating }],
  metricValues: [{ value: String(count) }],
});
beforeEach(() => {
  mocks.connection.mockResolvedValue({
    propertyTimeZone: "UTC",
    connectedByUserId: "owner",
    ga4AccountId: "account",
    propertyId: "property",
  });
});

it("passes a metric when 75% or more of the loads are good", () => {
  const [page] = vitalsPages([
    { pagePath: "/", eventName: "LCP", rating: "good", count: 75 },
    { pagePath: "/", eventName: "LCP", rating: "poor", count: 25 },
    { pagePath: "/", eventName: "CLS", rating: "good", count: 70 },
    { pagePath: "/", eventName: "CLS", rating: "needs-improvement", count: 30 },
  ]);
  expect(page).toEqual({
    pagePath: "/",
    loads: 100,
    good: { lcp: 0.75, inp: null, cls: 0.7 },
  });
});

it("asks GA4 for the three events by page and rating", async () => {
  mocks.runReport.mockResolvedValue({
    rows: [row("/pricing", "INP", "good", 9)],
  });
  expect(await PerformanceVitalsService.report(context, "p")).toMatchObject({
    status: "ready",
    pages: [{ pagePath: "/pricing", good: { inp: 1 } }],
  });
  expect(mocks.runReport.mock.calls[0][0].dimensions).toContainEqual({
    name: "customEvent:metric_rating",
  });
});

it("says the report is not ready when GA4 refuses the custom dimension", async () => {
  mocks.runReport.mockRejectedValue(new Error("not a valid dimension"));
  expect(await PerformanceVitalsService.report(context, "p")).toEqual({
    status: "not_ready",
  });
});
