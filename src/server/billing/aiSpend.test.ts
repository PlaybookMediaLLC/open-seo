import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db";
import { spendLedger, spendLimits } from "@/db/schema";
import { setupRun } from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { admitTurn, recordTurnSpend, releaseTurn } from "./assistantSpend";
import { holdResearch, settleResearch } from "./researchHold";

// RFC-0009: the assistant and AI research inside the monthly limits.
const database = await vi.hoisted(async () => {
  const { createExperimentTestDatabase } =
    await import("@/server/features/experiments/repositories/experimentTestDb");
  return createExperimentTestDatabase();
});
const mocks = vi.hoisted(() => ({
  reserve: vi.fn(),
  settle: vi.fn(),
  rateAllowed: true,
}));
vi.mock("cloudflare:workers", () => ({
  env: {
    DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1",
    PAID_ACTION_RATE_LIMIT: {
      limit: async () => ({ success: mocks.rateAllowed }),
    },
  },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
vi.mock("@/server/lib/runtime-env", () => ({
  isHostedServerAuthMode: async () => true,
}));
vi.mock("./subscription", () => ({
  getOrCreateOrganizationCustomer: async () => ({ id: "autumn-customer" }),
  reserveUsageCredits: mocks.reserve,
  settleUsageCredits: mocks.settle,
}));
beforeAll(() => database.prepare());
afterAll(() => database.close());
beforeEach(() => {
  mocks.rateAllowed = true;
});

async function projectWithLimit(monthlyLimitCredits: number) {
  const { run } = await setupRun(database.client, database.slugPrefix);
  await db.insert(spendLimits).values({
    id: crypto.randomUUID(),
    organizationId: run.projectId,
    projectId: run.projectId,
    monthlyLimitCredits,
    updatedBy: "owner",
    updatedAt: new Date().toISOString(),
  });
  return {
    row: { userId: "member" },
    userEmail: "member@example.com",
    project: { id: run.projectId, organizationId: run.projectId },
  };
}

it("refuses AI research over the limit before any Autumn hold", async () => {
  const sam = await projectWithLimit(30);
  const customer = {
    userId: "member",
    userEmail: "member@example.com",
    organizationId: sam.project.organizationId,
    projectId: sam.project.id,
  };
  await expect(
    holdResearch(customer, { estimatedCredits: 50 }),
  ).rejects.toMatchObject({ code: "SPEND_LIMIT_REACHED" });
  expect(mocks.reserve).not.toHaveBeenCalled();

  const hold = {
    lockId: "lock",
    featureId: "usage_credits" as const,
    estimatedCredits: 50,
    callIndexes: [0],
  };
  await settleResearch(customer, hold, [
    {
      provider: "openrouter",
      creditFeature: "agent",
      operation: "content_brief",
      costUsd: 0.01,
    },
  ]);
  expect(mocks.settle).toHaveBeenCalledWith(
    expect.objectContaining({
      provider: "openrouter",
      costs: [{ costUsd: 0.01, path: ["openrouter", "content_brief"] }],
    }),
  );
});

it("reserves each assistant turn and counts its real spend", async () => {
  const sam = await projectWithLimit(60);
  const turn = await admitTurn(sam);
  expect(turn.refusal).toBeNull();
  await recordTurnSpend(sam, 30, 0.03);
  await releaseTurn(turn.id, Promise.resolve());
  expect(
    await db
      .select({ status: spendLedger.status, actual: spendLedger.actualCredits })
      .from(spendLedger)
      .where(eq(spendLedger.projectId, sam.project.id))
      .orderBy(asc(spendLedger.status)),
  ).toEqual([
    { status: "released", actual: null },
    { status: "settled", actual: 30 },
  ]);
  expect((await admitTurn(sam)).refusal).toBe(
    "This project reached its monthly limit of 60 credits. An owner can change it in Billing.",
  );
});

it("refuses an assistant turn over the paid action rate", async () => {
  const sam = await projectWithLimit(60);
  mocks.rateAllowed = false;
  expect((await admitTurn(sam)).refusal).toMatch(/too quickly/);
});
