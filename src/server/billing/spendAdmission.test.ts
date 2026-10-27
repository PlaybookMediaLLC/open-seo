import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db";
import { growthNotifications, spendLedger, spendLimits } from "@/db/schema";
import { setupRun } from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { AppError } from "@/server/lib/errors";
import { creditsForProviderUsd } from "@/shared/billing";
import { admitSpend, reserveWithinLimits } from "./spendAdmission";
import { recordSettlement } from "./spendLedger";

const database = await vi.hoisted(async () => {
  const { createExperimentTestDatabase } =
    await import("@/server/features/experiments/repositories/experimentTestDb");
  return createExperimentTestDatabase();
});
const mocks = vi.hoisted(() => ({ reserve: vi.fn(), limit: vi.fn() }));
vi.mock("cloudflare:workers", () => ({
  env: {
    DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1",
    PAID_ACTION_RATE_LIMIT: { limit: mocks.limit },
  },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
vi.mock("./subscription", () => ({ reserveUsageCredits: mocks.reserve }));
beforeAll(() => database.prepare());
beforeEach(() => {
  mocks.limit.mockResolvedValue({ success: true });
});
afterAll(() => database.close());

async function customer(limits: { organization?: number; project?: number }) {
  const { run } = await setupRun(database.client, database.slugPrefix);
  const organizationId = run.projectId;
  for (const [projectId, monthlyLimitCredits] of [
    [null, limits.organization],
    [run.projectId, limits.project],
  ] as const)
    if (monthlyLimitCredits !== undefined)
      await db.insert(spendLimits).values({
        id: crypto.randomUUID(),
        organizationId,
        projectId,
        monthlyLimitCredits,
        updatedBy: "owner",
        updatedAt: new Date().toISOString(),
      });
  return {
    organizationId,
    projectId: run.projectId,
    userId: "member",
    userEmail: "member@example.com",
  };
}
const ledger = (organizationId: string) =>
  db
    .select({
      status: spendLedger.status,
      estimated: spendLedger.estimatedCredits,
      actual: spendLedger.actualCredits,
      lockId: spendLedger.holdLockId,
    })
    .from(spendLedger)
    .where(eq(spendLedger.organizationId, organizationId))
    .orderBy(asc(spendLedger.estimatedCredits));

it("admits only what fits when requests race near the limit", async () => {
  const buyer = await customer({ organization: 100 });
  await Promise.allSettled(
    Array.from({ length: 8 }, () =>
      admitSpend({
        customer: buyer,
        provider: "dataforseo",
        estimatedCredits: 30,
      }),
    ),
  );
  const statuses = (await ledger(buyer.organizationId)).map(
    (row) => row.status,
  );
  expect(statuses.filter((status) => status === "admitted")).toHaveLength(3);
  expect(statuses).toHaveLength(8);
});

it("applies only the Autumn balance when no limit is set", async () => {
  const buyer = await customer({});
  await admitSpend({
    customer: buyer,
    provider: "openrouter",
    estimatedCredits: 1_000_000,
  });
  expect(await ledger(buyer.organizationId)).toMatchObject([
    { status: "admitted" },
  ]);
});

it("refuses over the project limit before any Autumn hold", async () => {
  const buyer = await customer({ organization: 1_000, project: 50 });
  await admitSpend({
    customer: buyer,
    provider: "dataforseo",
    estimatedCredits: 40,
  });
  const refusal = reserveWithinLimits({
    customer: buyer,
    customerId: buyer.organizationId,
    callCredits: [20],
  });
  await expect(refusal).rejects.toMatchObject({
    code: "SPEND_LIMIT_REACHED",
    message:
      "This project reached its monthly limit of 50 credits. An owner can change it in Billing.",
  });
  expect(mocks.reserve).not.toHaveBeenCalled();
});

it("closes the row as refused when Autumn has too few credits", async () => {
  const buyer = await customer({});
  mocks.reserve.mockRejectedValueOnce(new AppError("INSUFFICIENT_CREDITS"));
  await expect(
    reserveWithinLimits({
      customer: buyer,
      customerId: buyer.organizationId,
      callCredits: [5],
    }),
  ).rejects.toMatchObject({ code: "INSUFFICIENT_CREDITS" });
  expect(await ledger(buyer.organizationId)).toMatchObject([
    { status: "refused" },
  ]);
});

function hold(lockId: string, estimatedCredits: number) {
  return {
    lockId,
    featureId: "usage_credits",
    estimatedCredits,
    callIndexes: [],
  };
}

it("keeps one row per credit hold and records each settlement", async () => {
  const buyer = await customer({});
  const monthly = hold(`monthly-${buyer.organizationId}`, 3);
  const topup = hold(`topup-${buyer.organizationId}`, 7);
  mocks.reserve.mockResolvedValueOnce({
    holds: [monthly, topup],
    refusedCalls: [],
  });
  await reserveWithinLimits({
    customer: buyer,
    customerId: buyer.organizationId,
    callCredits: [3, 7],
  });
  await recordSettlement(monthly.lockId, {
    costs: [{ costUsd: 0.002 }],
    landed: true,
  });
  await recordSettlement(topup.lockId, {
    costs: [{ costUsd: 0.005 }],
    landed: false,
    error: new Error("timeout"),
  });
  expect(await ledger(buyer.organizationId)).toEqual([
    {
      status: "settled",
      estimated: 3,
      actual: creditsForProviderUsd(0.002),
      lockId: monthly.lockId,
    },
    {
      status: "settle_failed",
      estimated: 7,
      actual: creditsForProviderUsd(0.005),
      lockId: topup.lockId,
    },
  ]);
});

it("notifies once when a project passes 80% of its limit", async () => {
  const buyer = await customer({ project: 100 });
  for (const estimatedCredits of [50, 35, 5])
    await admitSpend({
      customer: buyer,
      provider: "dataforseo",
      estimatedCredits,
    });
  expect(
    await db
      .select({
        title: growthNotifications.title,
        linkPath: growthNotifications.linkPath,
      })
      .from(growthNotifications)
      .where(eq(growthNotifications.projectId, buyer.projectId)),
  ).toEqual([
    {
      title: "This project used 85% of its monthly credit limit",
      linkPath: `/p/${buyer.projectId}/settings/spending`,
    },
  ]);
});

it("refuses the 31st paid action in a minute before the ledger", async () => {
  const buyer = await customer({});
  mocks.limit.mockResolvedValueOnce({ success: false });
  await expect(
    admitSpend({
      customer: buyer,
      feature: "keyword_research",
      provider: "dataforseo",
      estimatedCredits: 5,
    }),
  ).rejects.toMatchObject({ code: "RATE_LIMITED" });
  expect(mocks.limit).toHaveBeenCalledWith({
    key: `${buyer.organizationId}:member:keyword_research`,
  });
  expect(await ledger(buyer.organizationId)).toEqual([]);
});
