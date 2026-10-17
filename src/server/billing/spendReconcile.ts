import { and, eq, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { spendLedger } from "@/db/schema";
import { isHostedServerAuthMode } from "@/server/lib/runtime-env";
import type { CreditFeature } from "@/shared/billing-credit-features";
import { AUTUMN_SEO_DATA_BALANCE_FEATURE_ID } from "@/shared/billing";
import {
  finalizeHold,
  getUsageCreditsRemaining,
  trackUsageCreditSpend,
} from "./subscription";

// RFC-0009 5.4, debt 2: charges whose finalize failed, retried every 15
// minutes by the Trigger.dev task `spend-reconcile`.
const HOLD_MS = 30 * 60_000; // HOLD_TTL_MS in subscription.ts
const GRACE_MS = 5 * 60_000;
const MAX_ATTEMPTS = 10;
const BATCH = 100;
const DATAFORSEO_FEATURES = [
  "keyword_research",
  "domain_overview",
  "backlinks",
  "site_audit",
  "rank_tracking",
  "ai_citations",
  "ai_prompt_responses",
  "local_seo",
] as const satisfies readonly CreditFeature[];
const creditFeatureOf = (feature: string | null): CreditFeature =>
  DATAFORSEO_FEATURES.find((known) => known === feature) ?? "agent";

type Row = typeof spendLedger.$inferSelect;

/**
 * Charges one failed settlement: the hold while it is valid, else a direct
 * track. ponytail: a crash between the track and the row update charges
 * again on the next run; Autumn track has no idempotency key.
 */
async function charge(row: Row, now: Date) {
  const credits = row.actualCredits ?? 0;
  const holdValid =
    row.holdLockId !== null &&
    now.getTime() - new Date(row.createdAt).getTime() < HOLD_MS;
  if (holdValid && row.holdLockId) {
    const { landed, error } = await finalizeHold(
      {
        lockId: row.holdLockId,
        featureId: AUTUMN_SEO_DATA_BALANCE_FEATURE_ID,
        estimatedCredits: row.estimatedCredits,
        callIndexes: [],
      },
      credits,
      { ledgerId: row.id, reconciled: true },
    );
    if (!landed)
      throw error instanceof Error ? error : new Error("Finalize failed");
    return;
  }
  if (credits <= 0 || !row.costUsd) return;
  const { monthlyRemaining, topupRemaining } = await getUsageCreditsRemaining(
    row.organizationId,
  );
  await trackUsageCreditSpend({
    customer: {
      organizationId: row.organizationId,
      userId: row.actor,
      userEmail: "",
      projectId: row.projectId ?? undefined,
    },
    customerId: row.organizationId,
    creditFeature: creditFeatureOf(row.feature),
    costUsd: row.costUsd,
    monthlyRemaining,
    overdraft: { topupRemaining },
    properties: { provider: row.provider, ledgerId: row.id, reconciled: true },
  });
}

export async function reconcileSpend(now = new Date()) {
  const counts = { settled: 0, released: 0, failed: 0 };
  if (!(await isHostedServerAuthMode())) return counts;
  const stale = new Date(now.getTime() - HOLD_MS - GRACE_MS).toISOString();
  const rows = await db
    .select()
    .from(spendLedger)
    .where(
      or(
        // Rows that stopped after 10 attempts wait for a person.
        and(
          eq(spendLedger.status, "settle_failed"),
          lt(spendLedger.attempts, MAX_ATTEMPTS),
        ),
        and(
          eq(spendLedger.status, "admitted"),
          lt(spendLedger.createdAt, stale),
        ),
      ),
    )
    .limit(BATCH);
  for (const row of rows) {
    if (row.status === "admitted") {
      // The hold expired without a settlement, so nothing was charged.
      await db
        .update(spendLedger)
        .set({
          status: "released",
          lastError: "Expired without settlement",
          settledAt: now.toISOString(),
        })
        .where(
          and(eq(spendLedger.id, row.id), eq(spendLedger.status, "admitted")),
        );
      counts.released++;
      continue;
    }
    // Claim the attempt, so two runs never charge the same row.
    const [claimed] = await db
      .update(spendLedger)
      .set({ attempts: row.attempts + 1 })
      .where(
        and(
          eq(spendLedger.id, row.id),
          eq(spendLedger.status, "settle_failed"),
          eq(spendLedger.attempts, row.attempts),
        ),
      )
      .returning({ id: spendLedger.id });
    if (!claimed) continue;
    try {
      await charge(row, now);
      await db
        .update(spendLedger)
        .set({
          status: "settled",
          lastError: null,
          settledAt: now.toISOString(),
        })
        .where(eq(spendLedger.id, row.id));
      counts.settled++;
    } catch (error) {
      await db
        .update(spendLedger)
        .set({ lastError: error instanceof Error ? error.name : "unknown" })
        .where(eq(spendLedger.id, row.id));
      counts.failed++;
    }
  }
  return counts;
}
