import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db";
import { spendLedger } from "@/db/schema";
import { setupRun } from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { reconcileSpend } from "./spendReconcile";

const database = await vi.hoisted(async () => {
  const { createExperimentTestDatabase } =
    await import("@/server/features/experiments/repositories/experimentTestDb");
  return createExperimentTestDatabase();
});
const mocks = vi.hoisted(() => ({ finalize: vi.fn(), track: vi.fn() }));
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
vi.mock("@/server/lib/runtime-env", () => ({
  isHostedServerAuthMode: async () => true,
}));
vi.mock("./subscription", () => ({
  finalizeHold: mocks.finalize,
  trackUsageCreditSpend: mocks.track,
  getUsageCreditsRemaining: async () => ({
    monthlyRemaining: 100,
    topupRemaining: 0,
  }),
}));
beforeAll(() => database.prepare());
afterAll(() => database.close());
beforeEach(() => {
  mocks.finalize.mockResolvedValue({ landed: true });
  mocks.track.mockResolvedValue({ monthlyCredits: 5, topupCredits: 0 });
});

const now = new Date("2026-10-17T12:00:00.000Z");
const minutesAgo = (minutes: number) =>
  new Date(now.getTime() - minutes * 60_000).toISOString();

async function ledgerRow(
  status: "settle_failed" | "admitted",
  createdAt: string,
  attempts = 1,
  provider: "dataforseo" | "rendering" = "dataforseo",
) {
  const { run } = await setupRun(database.client, database.slugPrefix);
  const id = crypto.randomUUID();
  await db.insert(spendLedger).values({
    id,
    organizationId: run.projectId,
    projectId: run.projectId,
    feature: "backlinks",
    provider,
    actor: "member",
    periodMonth: "2026-10",
    estimatedCredits: 8,
    actualCredits: status === "settle_failed" ? 5 : null,
    costUsd: status === "settle_failed" ? 0.004 : null,
    holdLockId: `lock-${id}`,
    status,
    idempotencyKey: id,
    attempts,
    createdAt,
  });
  return id;
}
const rowOf = async (id: string) =>
  (
    await db
      .select({
        status: spendLedger.status,
        attempts: spendLedger.attempts,
      })
      .from(spendLedger)
      .where(eq(spendLedger.id, id))
      .orderBy(asc(spendLedger.id))
  )[0];

it("confirms the hold while it is valid, and tracks the charge after it expires", async () => {
  const fresh = await ledgerRow("settle_failed", minutesAgo(10));
  const expired = await ledgerRow("settle_failed", minutesAgo(60));
  await reconcileSpend(now);
  expect(mocks.finalize).toHaveBeenCalledWith(
    expect.objectContaining({ lockId: `lock-${fresh}` }),
    5,
    expect.objectContaining({ ledgerId: fresh }),
  );
  expect(mocks.track.mock.lastCall?.[0]).toMatchObject({
    costUsd: 0.004,
    creditFeature: "backlinks",
    properties: { ledgerId: expired },
  });
  expect(await rowOf(fresh)).toEqual({ status: "settled", attempts: 2 });
  expect(await rowOf(expired)).toEqual({ status: "settled", attempts: 2 });
});

it("stops after 10 attempts and releases reservations that never settled", async () => {
  const stopped = await ledgerRow("settle_failed", minutesAgo(60), 10);
  const failing = await ledgerRow("settle_failed", minutesAgo(60), 9);
  const stale = await ledgerRow("admitted", minutesAgo(40));
  mocks.track.mockRejectedValue(new Error("Autumn down"));
  await reconcileSpend(now);
  expect(await rowOf(stopped)).toEqual({
    status: "settle_failed",
    attempts: 10,
  });
  expect(await rowOf(failing)).toEqual({
    status: "settle_failed",
    attempts: 10,
  });
  expect(await rowOf(stale)).toEqual({ status: "released", attempts: 1 });
});

it("leaves a rendering lock to its audit until the lock expires", async () => {
  const running = await ledgerRow("admitted", minutesAgo(120), 0, "rendering");
  const failed = await ledgerRow(
    "settle_failed",
    minutesAgo(120),
    1,
    "rendering",
  );
  const expired = await ledgerRow(
    "admitted",
    minutesAgo(25 * 60),
    0,
    "rendering",
  );
  await reconcileSpend(now);
  expect(await rowOf(running)).toEqual({ status: "admitted", attempts: 0 });
  expect(mocks.finalize).toHaveBeenCalledWith(
    expect.objectContaining({ lockId: `lock-${failed}` }),
    5,
    expect.objectContaining({ ledgerId: failed }),
  );
  expect(mocks.track).not.toHaveBeenCalled();
  expect(await rowOf(expired)).toEqual({ status: "released", attempts: 0 });
});
