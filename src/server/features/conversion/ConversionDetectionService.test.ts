import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db";
import { opportunities, opportunityGa4Evidence } from "@/db/schema";
import { setupRun } from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import type { Ga4RunReportRequest } from "@/server/lib/ga4Client";
import { ConversionGateService } from "./ConversionGateService";
import { ConversionDetectionService } from "./ConversionDetectionService";

// RFC-0012 5.3: one conversion run from GA4 rows to stored opportunities.
const database = await vi.hoisted(async () => {
  const { createExperimentTestDatabase } =
    await import("@/server/features/experiments/repositories/experimentTestDb");
  return createExperimentTestDatabase();
});
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
const ga4 = vi.hoisted(() => ({
  keyEvents: vi.fn(),
  runReport: vi.fn<(request: Ga4RunReportRequest) => Promise<object>>(),
}));
vi.mock("@/server/features/ga4/repositories/Ga4ConnectionRepository", () => ({
  Ga4ConnectionRepository: {
    getByProjectId: async () => ({
      propertyId: "properties/1",
      propertyTimeZone: "UTC",
      propertyCurrencyCode: "USD",
      connectedByUserId: "owner",
      ga4AccountId: "a",
    }),
  },
}));
vi.mock("@/server/features/ga4/services/Ga4MeasurementHealthService", () => ({
  Ga4MeasurementHealthService: {
    getMeasurementHealth: async () => ({
      summary: { webStreamCount: 1 },
      webStreams: [
        {
          enhancedMeasurement: {
            streamEnabled: true,
            formInteractionsEnabled: true,
          },
        },
      ],
      keyEvents: [{ eventName: "sign_up" }],
    }),
  },
}));
vi.mock("@/server/features/ga4/services/Ga4ReportingService", () => ({
  Ga4ReportingService: { runReport: ga4.keyEvents },
}));
vi.mock("@/server/lib/ga4Client", () => ({
  createGa4DataClient: () => ({ runReport: ga4.runReport }),
}));
vi.mock("@/server/features/gsc/services/GscService", () => ({
  GscService: {
    getConnection: async () => ({ siteUrl: "sc-domain:example.com" }),
  },
}));
vi.mock(
  "@/server/features/project-context/repositories/ProjectContextRepository",
  () => ({ ProjectContextRepository: { listKeyPages: async () => [] } }),
);

const report = (
  dimensions: string[],
  metrics: string[],
  rows: Array<[string[], number[]]>,
) => ({
  dimensionHeaders: dimensions.map((name) => ({ name })),
  metricHeaders: metrics.map((name) => ({ name })),
  rows: rows.map(([values, numbers]) => ({
    dimensionValues: values.map((value) => ({ value })),
    metricValues: numbers.map((value) => ({ value: String(value) })),
  })),
});
const landing = (path: string, device: string, numbers: number[]) =>
  [["example.com", path, device], numbers] as [string[], number[]];

beforeAll(async () => {
  await database.prepare();
  if (!database.isPostgres)
    // The project lookup selects every column of the full table.
    await database.client.executeMultiple(`
      ALTER TABLE projects ADD COLUMN domain TEXT;
      ALTER TABLE projects ADD COLUMN location_code INTEGER DEFAULT 2840;
      ALTER TABLE projects ADD COLUMN language_code TEXT DEFAULT 'en';
      ALTER TABLE projects ADD COLUMN created_at TEXT;
      ALTER TABLE projects ADD COLUMN ai_research_keywords TEXT;
    `);
});
afterAll(() => database.close());
beforeEach(() => {
  ga4.keyEvents.mockResolvedValue({
    rows: [{ eventName: "sign_up", keyEvents: 100 }],
    request: {
      currencyCode: "USD",
      resolvedDateRange: { startDate: "2026-09-20", endDate: "2026-10-17" },
    },
  });
  ga4.runReport.mockImplementation(async (request) =>
    request.dimensions[1]?.name === "landingPage"
      ? report(
          ["hostName", "landingPage", "deviceCategory"],
          ["sessions", "engagedSessions", "keyEvents:sign_up"],
          [
            landing("/a", "desktop", [1000, 600, 40]),
            landing("/b", "desktop", [1000, 600, 40]),
            landing("/pricing", "desktop", [100, 60, 10]),
            landing("/pricing", "mobile", [900, 540, 27]),
          ],
        )
      : report(["hostName", "pagePath", "eventName"], ["eventCount"], []),
  );
});

it("stores conversion opportunities with device evidence rows", async () => {
  const { run } = await setupRun(database.client, database.slugPrefix);
  const context = {
    organizationId: run.projectId,
    userId: "owner",
    role: "owner",
  };
  await ConversionGateService.save(context, {
    projectId: run.projectId,
    eventName: "sign_up",
    valueMinor: null,
    currency: null,
    channel: "organic_search",
  });

  const result = await ConversionDetectionService.detect(
    context,
    run.projectId,
  );

  expect(result.outcome).toBe("completed");
  const [saved] = await db
    .select({ id: opportunities.id, type: opportunities.type })
    .from(opportunities)
    .where(eq(opportunities.projectId, run.projectId));
  expect(saved.type).toBe("cro_device_gap");
  const devices = await db
    .select({ device: opportunityGa4Evidence.device })
    .from(opportunityGa4Evidence)
    .where(eq(opportunityGa4Evidence.opportunityId, saved.id));
  expect(new Set(devices.map((row) => row.device))).toEqual(
    new Set(["all", "desktop", "mobile"]),
  );
  const [landingRequest] = ga4.runReport.mock.calls[0];
  expect(landingRequest.dimensionFilter).toMatchObject({
    filter: { fieldName: "sessionDefaultChannelGroup" },
  });
});

it("refuses to run before the tracking gate passes", async () => {
  const { run } = await setupRun(database.client, database.slugPrefix);
  const result = await ConversionDetectionService.detect(
    { organizationId: run.projectId, userId: "owner", role: "owner" },
    run.projectId,
  );
  expect(result.outcome).toBe("not_connected");
  expect(result.message).toContain(
    "Choose the key event that counts as a conversion.",
  );
  expect(ga4.runReport).not.toHaveBeenCalled();
});
