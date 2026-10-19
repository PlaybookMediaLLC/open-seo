import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db";
import { revenueConnections, revenueEvents } from "@/db/schema";
import { setupRun } from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { RevenueConnectionService } from "./RevenueConnectionService";
import {
  experimentRevenue,
  loadRevenueScores,
  RevenueReportService,
} from "./RevenueReportService";

// RFC-0016 5.3: read-only restricted keys only, and a disconnect that
// deletes the key and every revenue row.
const database = await vi.hoisted(async () => {
  const { createOpportunityTestDatabase } =
    await import("@/server/features/opportunities/repositories/opportunityRepositoryTestDb");
  return createOpportunityTestDatabase("revenue-connection-test-");
});
const mocks = vi.hoisted(() => ({ probeStatus: 403 }));
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
vi.mock("@/server/lib/runtime-env", () => ({
  getOptionalEnvValue: async (name: string) =>
    name === "BETTER_AUTH_SECRET"
      ? "revenue-test-secret-of-at-least-32-characters"
      : undefined,
}));
vi.mock("@/server/features/projects/repositories/ProjectRepository", () => ({
  ProjectRepository: {
    getProjectForOrganization: async (projectId: string, orgId: string) =>
      projectId === orgId ? { id: projectId } : null,
  },
}));
const KEY = "rk_test_51AbCdEfGhIjKlMnOpQr";
beforeAll(async () => {
  await database.prepare();
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) =>
    init?.method === "POST"
      ? new Response(
          `{"error":{"message":"The provided key does not have the required permissions on account 'acct_1TestAccount'."}}`,
          { status: mocks.probeStatus },
        )
      : Response.json({ data: [] }),
  );
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await database.close();
});
beforeEach(() => {
  mocks.probeStatus = 403;
});

async function project() {
  const { run } = await setupRun(database.client, "revenue-connection-test-");
  const context = {
    organizationId: run.projectId,
    userId: "owner",
    role: "owner",
  };
  return { projectId: run.projectId, context };
}

it("accepts only a restricted key that cannot write, and stores it encrypted", async () => {
  const { projectId, context } = await project();
  await expect(
    RevenueConnectionService.connect(context, {
      projectId,
      key: "sk_test_51AbCdEfGhIjKlMnOpQr",
    }),
  ).rejects.toThrow("secret keys");
  mocks.probeStatus = 400;
  await expect(
    RevenueConnectionService.connect(context, { projectId, key: KEY }),
  ).rejects.toThrow("can write");
  mocks.probeStatus = 403;
  expect(
    await RevenueConnectionService.connect(context, { projectId, key: KEY }),
  ).toEqual({ ok: true, livemode: false });
  const [row] = await db
    .select()
    .from(revenueConnections)
    .where(eq(revenueConnections.projectId, projectId));
  expect(row?.encryptedKey).not.toContain(KEY);
  expect(row?.accountIdHash).toMatch(/^[0-9a-f]{64}$/);
});

it("deletes the key and every revenue row on disconnect", async () => {
  const { projectId, context } = await project();
  await RevenueConnectionService.connect(context, { projectId, key: KEY });
  await db.insert(revenueEvents).values({
    id: crypto.randomUUID(),
    projectId,
    externalIdHash: "a",
    customerHash: "b",
    kind: "first_payment",
    amountMinor: 4_900,
    currency: "usd",
    occurredAt: "2026-10-18T00:00:00.000Z",
    ftChannel: "direct",
  });
  await RevenueConnectionService.disconnect(context, projectId);
  const rows = await Promise.all([
    db
      .select()
      .from(revenueEvents)
      .where(eq(revenueEvents.projectId, projectId)),
    db
      .select()
      .from(revenueConnections)
      .where(eq(revenueConnections.projectId, projectId)),
  ]);
  expect(rows).toEqual([[], []]);
});

const event = (
  projectId: string,
  overrides: Partial<typeof revenueEvents.$inferInsert>,
) => ({
  id: crypto.randomUUID(),
  projectId,
  externalIdHash: crypto.randomUUID(),
  customerHash: crypto.randomUUID(),
  kind: "first_payment" as const,
  amountMinor: 1_000,
  currency: "usd",
  occurredAt: new Date(Date.now() - 86_400_000).toISOString(),
  ftChannel: "direct" as const,
  ...overrides,
});

// RFC-0016 5.6: coverage counts new customers with a known first touch, and
// each currency keeps its own totals, with refunds netted.
it("reports coverage and revenue per currency, never converted", async () => {
  const { projectId, context } = await project();
  await RevenueConnectionService.connect(context, { projectId, key: KEY });
  const search = { customerHash: "a", ftChannel: "organic_search" } as const;
  await db
    .insert(revenueEvents)
    .values([
      event(projectId, { ...search, amountMinor: 4_900 }),
      event(projectId, { ...search, kind: "refund", amountMinor: -4_900 }),
      event(projectId, { ftChannel: "unknown" }),
      event(projectId, { currency: "eur", ftChannel: "email" }),
    ]);
  const report = await RevenueReportService.report(context, {
    projectId,
    days: 90,
  });
  expect(report?.coverage).toEqual({ newCustomers: 3, attributed: 2 });
  expect(report?.currencies.map((group) => group.currency)).toEqual([
    "eur",
    "usd",
  ]);
  expect(report?.currencies[1]?.byChannel).toContainEqual({
    currency: "usd",
    channel: "organic_search",
    revenueMinor: 0,
    newCustomers: 1,
    firstPaymentsMinor: 4_900,
  });
});

// RFC-0016 5.7: page scores against the 90th percentile, only when at least
// 80% of new customers have a first touch.
it("scores landing paths only with 80% coverage", async () => {
  const { projectId } = await project();
  await db
    .insert(revenueEvents)
    .values([
      event(projectId, { amountMinor: 4_900, ftPath: "/pricing/" }),
      event(projectId, { amountMinor: 9_800, ftPath: "/guide" }),
    ]);
  const scores = await loadRevenueScores(projectId);
  expect(scores?.get("/pricing")?.score).toBe(0.5);
  expect(scores?.get("/guide")?.score).toBe(1);
  await db
    .insert(revenueEvents)
    .values(event(projectId, { ftChannel: "unknown" }));
  expect(await loadRevenueScores(projectId)).toBeNull();
});

// RFC-0016 5.7: experiment windows show revenue only with 10 new customers
// from the changed page in each window.
it("shows experiment revenue only with 10 new customers in each window", async () => {
  const { projectId, context } = await project();
  await RevenueConnectionService.connect(context, { projectId, key: KEY });
  const experiment = {
    targetUrl: "https://example.com/pricing",
    baselineStart: "2026-08-01",
    baselineEnd: "2026-08-28",
    observationStart: "2026-09-05",
    observationEnd: "2026-10-02",
  };
  const customers = (count: number, occurredAt: string) =>
    Array.from({ length: count }, () =>
      event(projectId, { ftPath: "/pricing", occurredAt }),
    );
  // One row per insert keeps each query inside the D1 parameter budget.
  for (const row of [
    ...customers(10, "2026-08-28T23:00:00.000Z"),
    ...customers(9, "2026-09-05T00:00:00.000Z"),
    event(projectId, {
      ftPath: "/guide",
      occurredAt: "2026-09-10T00:00:00.000Z",
    }),
  ])
    await db.insert(revenueEvents).values(row);
  expect(await experimentRevenue(projectId, experiment)).toEqual({
    enough: false,
    minimum: 10,
  });
  await db
    .insert(revenueEvents)
    .values(customers(1, "2026-10-02T12:00:00.000Z"));
  expect(await experimentRevenue(projectId, experiment)).toMatchObject({
    enough: true,
    baseline: {
      newCustomers: 10,
      revenue: [{ currency: "usd", revenueMinor: 10_000 }],
    },
    observation: { newCustomers: 10 },
  });
});
