import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db";
import { revenueConnections, revenueEvents } from "@/db/schema";
import { setupRun } from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { RevenueConnectionService } from "./RevenueConnectionService";
import { RevenueReportService } from "./RevenueReportService";

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

// RFC-0016 5.6: coverage counts new customers with a known first touch, and
// each currency keeps its own totals, with refunds netted.
it("reports coverage and revenue per currency, never converted", async () => {
  const { projectId, context } = await project();
  await RevenueConnectionService.connect(context, { projectId, key: KEY });
  const occurredAt = new Date(Date.now() - 86_400_000).toISOString();
  const event = (
    customerHash: string,
    kind: (typeof revenueEvents.$inferInsert)["kind"],
    amountMinor: number,
    currency: string,
    ftChannel: (typeof revenueEvents.$inferInsert)["ftChannel"],
  ) => ({
    id: crypto.randomUUID(),
    projectId,
    externalIdHash: crypto.randomUUID(),
    customerHash,
    kind,
    amountMinor,
    currency,
    occurredAt,
    ftChannel,
  });
  await db
    .insert(revenueEvents)
    .values([
      event("a", "first_payment", 4_900, "usd", "organic_search"),
      event("a", "refund", -4_900, "usd", "organic_search"),
      event("b", "first_payment", 2_000, "usd", "unknown"),
      event("c", "first_payment", 3_000, "eur", "email"),
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
