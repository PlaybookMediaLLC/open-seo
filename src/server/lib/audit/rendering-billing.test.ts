import { asc, eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { db } from "@/db";
import { spendLedger, spendLimits } from "@/db/schema";
import type { finalizeHold, holdCredits } from "@/server/billing/subscription";
import { setupRun } from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";

const database = await vi.hoisted(async () => {
  const { createExperimentTestDatabase } =
    await import("@/server/features/experiments/repositories/experimentTestDb");
  return createExperimentTestDatabase();
});
const mocks = vi.hoisted(() => ({
  isHosted: vi.fn(),
  getUsageCreditsRemaining: vi.fn(),
  holdCredits: vi.fn<typeof holdCredits>(),
  finalizeHold: vi.fn<typeof finalizeHold>(),
  sendCreditsExhaustedEvent: vi.fn(),
}));
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
vi.mock("@/server/lib/runtime-env", () => ({
  isHostedServerAuthMode: mocks.isHosted,
}));
vi.mock("@/server/billing/subscription", () => ({
  getOrCreateOrganizationCustomer: vi.fn().mockResolvedValue({ id: "org" }),
  getUsageCreditsRemaining: mocks.getUsageCreditsRemaining,
  holdCredits: mocks.holdCredits,
  finalizeHold: mocks.finalizeHold,
}));
vi.mock("@/server/lib/posthog", () => ({ captureServerEvent: vi.fn() }));
vi.mock("@/server/email/onboarding-drip", () => ({
  sendCreditsExhaustedEvent: mocks.sendCreditsExhaustedEvent,
}));

import {
  lockRenderingCredits,
  settleRenderingLocks,
} from "./rendering-billing";
import { estimateRenderingCredits } from "@/shared/audit-rendering";

beforeAll(() => database.prepare());
afterAll(() => database.close());

async function buyer(projectLimit?: number) {
  const { run } = await setupRun(database.client, database.slugPrefix);
  if (projectLimit !== undefined)
    await db.insert(spendLimits).values({
      id: crypto.randomUUID(),
      organizationId: run.projectId,
      projectId: run.projectId,
      monthlyLimitCredits: projectLimit,
      updatedBy: "owner",
      updatedAt: new Date().toISOString(),
    });
  return {
    userId: "user",
    userEmail: "user@example.com",
    organizationId: run.projectId,
    projectId: run.projectId,
  };
}
type Buyer = Awaited<ReturnType<typeof buyer>>;
// 100 pages hold 384 credits: every page falling back to Context.
const lockFor100Pages = (customer: Buyer) =>
  lockRenderingCredits({ customer, auditId: "audit", maxPages: 100 });
const ledgerOf = (customer: Buyer) =>
  db
    .select({
      status: spendLedger.status,
      estimated: spendLedger.estimatedCredits,
      actual: spendLedger.actualCredits,
    })
    .from(spendLedger)
    .where(eq(spendLedger.organizationId, customer.organizationId))
    .orderBy(asc(spendLedger.estimatedCredits));

beforeEach(() => {
  mocks.isHosted.mockResolvedValue(true);
  mocks.getUsageCreditsRemaining.mockResolvedValue({
    monthlyRemaining: 300,
    topupRemaining: 1_000,
  });
  mocks.holdCredits.mockImplementation(
    async ({ featureId, estimatedCredits }) => ({
      hold: {
        lockId: `${featureId}-${crypto.randomUUID()}`,
        featureId,
        estimatedCredits,
        callIndexes: [],
      },
      allowed: true,
      balance: null,
    }),
  );
  mocks.finalizeHold.mockResolvedValue({ landed: true });
});

describe("rendering estimate", () => {
  it("ranges from every page on Cloudflare to every page on Context", () => {
    expect(estimateRenderingCredits(100)).toEqual({ low: 64, high: 384 });
  });
});

describe("rendering credit lock", () => {
  it("leaves self-hosted rendering unmetered", async () => {
    mocks.isHosted.mockResolvedValue(false);
    const customer = await buyer();
    expect(await lockFor100Pages(customer)).toEqual([]);
    expect(mocks.holdCredits).not.toHaveBeenCalled();
    expect(await ledgerOf(customer)).toEqual([]);
  });

  it("holds the worst case from the monthly balance first, then top-up, for at most 24 hours, one ledger row per hold", async () => {
    const customer = await buyer();
    const locks = await lockFor100Pages(customer);
    expect(
      locks.map((lock) => [lock.featureId, lock.estimatedCredits]),
    ).toEqual([
      ["usage_credits", 300],
      ["topup_credits", 84],
    ]);
    const ttlMs = mocks.holdCredits.mock.calls[0][0].ttlMs ?? 0;
    expect(ttlMs).toBeGreaterThan(60 * 60_000);
    expect(ttlMs).toBeLessThanOrEqual(24 * 60 * 60_000);
    expect(await ledgerOf(customer)).toEqual([
      { status: "admitted", estimated: 84, actual: null },
      { status: "admitted", estimated: 300, actual: null },
    ]);
  });

  it("refuses over the monthly spend limit before any hold", async () => {
    const customer = await buyer(383);
    await expect(lockFor100Pages(customer)).rejects.toMatchObject({
      code: "SPEND_LIMIT_REACHED",
    });
    expect(mocks.holdCredits).not.toHaveBeenCalled();
    expect(await ledgerOf(customer)).toEqual([
      { status: "refused", estimated: 384, actual: null },
    ]);
  });

  it("refuses before holding anything when both balances together fall short", async () => {
    mocks.getUsageCreditsRemaining.mockResolvedValue({
      monthlyRemaining: 300,
      topupRemaining: 83,
    });
    const customer = await buyer();
    const error = await lockFor100Pages(customer).catch(
      (reason: unknown) => reason,
    );
    expect(error).toMatchObject({ code: "INSUFFICIENT_CREDITS" });
    expect(String(error)).toContain("needs $0.39 of credits");
    expect(mocks.holdCredits).not.toHaveBeenCalled();
    expect(mocks.sendCreditsExhaustedEvent).toHaveBeenCalledWith(customer);
    expect(await ledgerOf(customer)).toMatchObject([{ status: "refused" }]);
  });

  it("releases the monthly hold when the top-up hold is refused", async () => {
    const monthlyLock = {
      lockId: "monthly",
      featureId: "usage_credits" as const,
      estimatedCredits: 300,
      callIndexes: [],
    };
    mocks.holdCredits
      .mockResolvedValueOnce({
        hold: monthlyLock,
        allowed: true,
        balance: null,
      })
      .mockResolvedValueOnce({
        hold: { ...monthlyLock, lockId: "topup", featureId: "topup_credits" },
        allowed: false,
        balance: null,
      });
    const customer = await buyer();
    await expect(lockFor100Pages(customer)).rejects.toMatchObject({
      code: "INSUFFICIENT_CREDITS",
    });
    expect(mocks.sendCreditsExhaustedEvent).toHaveBeenCalledWith(customer);
    expect(mocks.finalizeHold).toHaveBeenCalledTimes(1);
    expect(mocks.finalizeHold).toHaveBeenCalledWith(
      monthlyLock,
      0,
      expect.anything(),
    );
  });
});

describe("rendering settlement", () => {
  it("confirms the credits used from the monthly hold, releases the rest, and records both on the ledger", async () => {
    const customer = await buyer();
    // 10 Cloudflare attempts and 2 Context credits cost $0.01: 13 credits.
    await settleRenderingLocks({
      customer,
      auditId: "audit",
      locks: await lockFor100Pages(customer),
      usage: { cloudflareAttempts: 10, contextCredits: 2 },
    });
    expect(
      mocks.finalizeHold.mock.calls.map(([lock, credits]) => [
        lock.featureId,
        credits,
      ]),
    ).toEqual([
      ["usage_credits", 13],
      ["topup_credits", 0],
    ]);
    expect(await ledgerOf(customer)).toEqual([
      { status: "released", estimated: 84, actual: 0 },
      { status: "settled", estimated: 300, actual: 13 },
    ]);
  });

  it("never charges more than the hold, and keeps a failed finalize's charge for reconciliation", async () => {
    const customer = await buyer();
    const locks = await lockFor100Pages(customer);
    mocks.finalizeHold.mockResolvedValueOnce({
      landed: false,
      error: new Error("Autumn down"),
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await settleRenderingLocks({
      customer,
      auditId: "audit",
      locks,
      usage: { cloudflareAttempts: 200, contextCredits: 200 },
    });
    expect(mocks.finalizeHold).toHaveBeenLastCalledWith(
      locks[1],
      84,
      expect.anything(),
    );
    expect(await ledgerOf(customer)).toEqual([
      { status: "settled", estimated: 84, actual: 84 },
      { status: "settle_failed", estimated: 300, actual: 300 },
    ]);
  });
});
