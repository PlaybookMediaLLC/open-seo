import { beforeEach, expect, it, vi } from "vitest";
import { Ga4DataApiError } from "@/server/lib/ga4Errors";
import { shiftGa4Date } from "@/server/features/ga4/services/Ga4Dates";
import type {
  ExperimentDetail,
  MeasurementGa4Day,
  MeasurementRun,
} from "@/types/schemas/experiments";
import { MeasurementService } from "./MeasurementService";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  complete:
    vi.fn<
      (input: {
        run: MeasurementRun;
        ga4Days?: MeasurementGa4Day[];
      }) => Promise<boolean>
    >(),
  ga4Connection: vi.fn(),
  runReport: vi.fn(),
  conversionEvent: vi.fn<() => Promise<string | null>>(),
}));
vi.mock("@/server/features/publishing/publishingAccess", () => ({
  authorizePublishing: async () => undefined,
  withPublishingClaim: (
    _context: unknown,
    _projectId: string,
    operation: (token: string, signal: AbortSignal) => Promise<unknown>,
  ) => operation("claim", new AbortController().signal),
}));
vi.mock("./repositories/ExperimentRepository", () => ({
  ExperimentRepository: {
    get: mocks.get,
    startRun: async () => true,
    completeRun: mocks.complete,
    failRun: async () => true,
    hasOverlappingChanges: async () => false,
  },
}));
vi.mock("./repositories/measurementGa4Rows", () => ({
  MeasurementGa4Repository: {
    keyEvents: async () => [],
    conversionEvent: mocks.conversionEvent,
  },
}));
vi.mock("@/server/features/gsc/services/GscService", () => ({
  GscService: {
    getConnection: async () => ({ siteUrl: "sc-domain:example.com" }),
    getPerformance: async (input: { startDate: string; endDate: string }) => {
      const rows = [];
      for (
        let date = input.startDate;
        date <= input.endDate;
        date = shiftGa4Date(date, 1)
      )
        rows.push({
          keys: [date],
          clicks: 10,
          impressions: 100,
          ctr: 0.1,
          position: 5,
        });
      return {
        siteUrl: "sc-domain:example.com",
        request: input,
        rows: rows.slice(0, 99),
      };
    },
  },
}));
vi.mock("@/server/features/ga4/repositories/Ga4ConnectionRepository", () => ({
  Ga4ConnectionRepository: { getByProjectId: mocks.ga4Connection },
}));
vi.mock("@/server/lib/ga4Client", () => ({
  createGa4DataClient: () => ({ runReport: mocks.runReport }),
}));

const context = { organizationId: "org", userId: "user", role: "owner" };
const input = { projectId: "project", experimentId: "experiment" };
function detail(ga4PropertyId: string | null) {
  return {
    experiment: {
      id: "experiment",
      projectId: "project",
      siteUrl: "sc-domain:example.com",
      targetUrl: "https://example.com/pricing",
      deployedAt: "2026-07-01T00:00:00.000Z",
      baselineStart: "2026-06-01",
      baselineEnd: "2026-06-28",
      observationStart: "2026-07-06",
      observationEnd: "2026-08-02",
      baselineRunId: null,
      otherChanges: false,
      seasonalRisk: false,
      ga4PropertyId,
    },
    baselineDays: [],
    latestRun: null,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- partial fixture: refresh reads only these fields
  } as unknown as ExperimentDetail;
}
async function measure(ga4PropertyId: string | null) {
  mocks.get.mockResolvedValue(detail(ga4PropertyId));
  expect((await MeasurementService.refresh(context, input)).ok).toBe(true);
  const call = mocks.complete.mock.calls.at(-1)?.[0];
  return { run: call?.run, ga4Days: call?.ga4Days ?? [] };
}

beforeEach(() => {
  mocks.complete.mockResolvedValue(true);
  mocks.conversionEvent.mockResolvedValue(null);
  mocks.ga4Connection.mockResolvedValue({
    propertyId: "properties/1",
    propertyTimeZone: "UTC",
    propertyCurrencyCode: "USD",
    connectedByUserId: "user",
    ga4AccountId: "account",
  });
  mocks.runReport.mockResolvedValue({
    rows: [
      {
        dimensionValues: [{ value: "20260602" }],
        metricValues: ["40", "30", "2", "0"].map((value) => ({ value })),
      },
    ],
  });
});

it("adds GA4 rows without changing the Search Console label", async () => {
  const without = await measure(null);
  const withGa4 = await measure("properties/1");
  expect(withGa4.ga4Days).toHaveLength(1);
  expect(withGa4.run).toMatchObject({
    outcome: without.run?.outcome,
    explanation: without.run?.explanation,
    ga4Error: null,
    requestCount: 2,
  });
});

it("keeps the Search Console result when GA4 fails, and stores the reason", async () => {
  mocks.runReport.mockRejectedValue(
    new Ga4DataApiError(429, "Google Analytics reporting quota was exhausted."),
  );
  const { run, ga4Days } = await measure("properties/1");
  expect(run).toMatchObject({
    status: "completed",
    ga4Error: "Google Analytics reporting quota was exhausted.",
  });
  expect(ga4Days).toEqual([]);
});

it("fails closed for GA4 only when the property changed since registration", async () => {
  mocks.ga4Connection.mockResolvedValue({ propertyId: "properties/2" });
  const { run } = await measure("properties/1");
  expect(run?.status).toBe("completed");
  expect(run?.ga4Error).toMatch(/GA4 property changed/);
  expect(mocks.runReport).not.toHaveBeenCalled();
});

it("reads the project's chosen conversion on every run (RFC-0012)", async () => {
  mocks.conversionEvent.mockResolvedValue("sign_up");
  await measure("properties/1");
  expect(JSON.stringify(mocks.runReport.mock.calls)).toContain("sign_up");
});
