import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db";
import { auditEvents } from "@/db/schema";
import { setupRun } from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { ConversionGateService } from "./ConversionGateService";

// RFC-0012 5.2: no conversion work until GA4 can support a decision.
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
  connection: vi.fn(),
  health: vi.fn(),
  report: vi.fn(),
}));
vi.mock("@/server/features/ga4/repositories/Ga4ConnectionRepository", () => ({
  Ga4ConnectionRepository: { getByProjectId: ga4.connection },
}));
vi.mock("@/server/features/ga4/services/Ga4MeasurementHealthService", () => ({
  Ga4MeasurementHealthService: { getMeasurementHealth: ga4.health },
}));
vi.mock("@/server/features/ga4/services/Ga4ReportingService", () => ({
  Ga4ReportingService: { runReport: ga4.report },
}));

const health = (webStreamCount: number, eventNames: string[]) => ({
  summary: { webStreamCount },
  keyEvents: eventNames.map((eventName) => ({ eventName })),
});
const report = (counts: Record<string, number>) => ({
  rows: Object.entries(counts).map(([eventName, keyEvents]) => ({
    eventName,
    keyEvents,
  })),
  request: {
    currencyCode: "USD",
    resolvedDateRange: { startDate: "2026-09-20", endDate: "2026-10-17" },
  },
});

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
  ga4.connection.mockResolvedValue({ propertyId: "1" });
  ga4.health.mockResolvedValue(health(1, ["sign_up", "generate_lead"]));
  ga4.report.mockResolvedValue(report({ sign_up: 29, generate_lead: 30 }));
});

async function owner() {
  const { run } = await setupRun(database.client, database.slugPrefix);
  return {
    projectId: run.projectId,
    context: {
      organizationId: run.projectId,
      userId: "owner",
      role: "owner",
    },
  };
}
const failing = (
  gate: Awaited<ReturnType<typeof ConversionGateService.get>>["gate"],
) =>
  gate.checks?.filter((check) => !check.ok).map((check) => check.id) ??
  gate.status;

it("passes only when the chosen key event has 30 events in 28 days", async () => {
  const { projectId, context } = await owner();
  const choose = (eventName: string) =>
    ConversionGateService.save(context, {
      projectId,
      eventName,
      valueMinor: 5000,
      currency: "USD",
    });
  const gate = async () =>
    (await ConversionGateService.get(context, projectId)).gate;

  expect(failing(await gate())).toEqual(["chosen"]);
  await choose("sign_up");
  expect(failing(await gate())).toEqual(["volume"]);
  await choose("generate_lead");
  const passed = await ConversionGateService.get(context, projectId);
  expect(passed.gate.status).toBe("passed");
  expect(passed.conversion).toEqual({
    eventName: "generate_lead",
    valueMinor: 5000,
    currency: "USD",
  });
  const events = await db
    .select({ action: auditEvents.action })
    .from(auditEvents)
    .where(eq(auditEvents.projectId, projectId));
  expect(events.map((event) => event.action)).toEqual([
    "conversion.event_changed",
    "conversion.event_changed",
  ]);
});

it("lists what to set up in GA4, and needs a connection first", async () => {
  const { projectId, context } = await owner();
  ga4.health.mockResolvedValue(health(0, []));
  ga4.report.mockResolvedValue(report({}));
  const { gate } = await ConversionGateService.get(context, projectId);
  expect(failing(gate)).toEqual([
    "web_stream",
    "key_event",
    "volume",
    "chosen",
  ]);

  ga4.connection.mockResolvedValue(null);
  expect(
    (await ConversionGateService.get(context, projectId)).gate.status,
  ).toBe("not_connected");
});
