import { and, eq, sql } from "drizzle-orm";
import { creditsForProviderUsd } from "@/shared/billing";

// RFC-0009 5.2: the ledger writes after admission. One row follows one
// Autumn hold from admission to settlement. These writes never throw: a
// ledger problem must not fail a request the customer already paid for.

type Hold = { lockId: string; estimatedCredits: number };

// Loaded on first use: upstream's subscription.ts imports this module, and
// the database modules read the Worker environment when they load.
async function ledgerDb() {
  const [{ db }, { spendLedger }] = await Promise.all([
    import("@/db"),
    import("@/db/schema"),
  ]);
  return { db, spendLedger };
}

function logLedgerError(stage: string, error: unknown) {
  console.error("[spend] ledger write failed", {
    stage,
    error: error instanceof Error ? error.name : "unknown",
  });
}

/**
 * Links the Autumn holds to the admitted row. A batch that draws on two
 * credit pools gets one row per hold; refused calls drop out of the estimate.
 */
export async function attachHolds(ledgerId: string, holds: Hold[]) {
  try {
    const [first, ...rest] = holds;
    if (!first) return;
    const { db, spendLedger } = await ledgerDb();
    await db
      .update(spendLedger)
      .set({
        holdLockId: first.lockId,
        estimatedCredits: first.estimatedCredits,
      })
      .where(eq(spendLedger.id, ledgerId));
    if (!rest.length) return;
    const [row] = await db
      .select()
      .from(spendLedger)
      .where(eq(spendLedger.id, ledgerId));
    if (!row) return;
    await db.insert(spendLedger).values(
      rest.map((hold, index) => ({
        ...row,
        id: crypto.randomUUID(),
        idempotencyKey: `${row.idempotencyKey}:${index + 1}`,
        holdLockId: hold.lockId,
        estimatedCredits: hold.estimatedCredits,
      })),
    );
  } catch (error) {
    logLedgerError("attach", error);
  }
}

/** Ends an admitted row that never charged: refused by Autumn, or failed. */
export async function closeSpend(
  ledgerId: string,
  status: "refused" | "released",
) {
  try {
    const { db, spendLedger } = await ledgerDb();
    await db
      .update(spendLedger)
      .set({ status, settledAt: new Date().toISOString() })
      .where(
        and(eq(spendLedger.id, ledgerId), eq(spendLedger.status, "admitted")),
      );
  } catch (error) {
    logLedgerError("close", error);
  }
}

/**
 * Records a hold's settlement. The real cost is stored before the outcome,
 * so a failed finalize keeps what reconciliation needs to charge it later.
 */
export async function recordSettlement(
  lockId: string,
  input: {
    costs: Array<{ costUsd: number }>;
    landed: boolean;
    error?: unknown;
    creditFeature?: string;
  },
) {
  try {
    const { db, spendLedger } = await ledgerDb();
    const costUsd = input.costs.reduce((sum, cost) => sum + cost.costUsd, 0);
    const actualCredits = input.costs.reduce(
      (sum, cost) => sum + creditsForProviderUsd(cost.costUsd),
      0,
    );
    const status = !input.landed
      ? "settle_failed"
      : actualCredits > 0
        ? "settled"
        : "released";
    await db
      .update(spendLedger)
      .set({
        actualCredits,
        costUsd,
        status,
        feature: sql`coalesce(${spendLedger.feature}, ${input.creditFeature ?? null})`,
        attempts: sql`${spendLedger.attempts} + 1`,
        lastError: input.landed
          ? null
          : input.error instanceof Error
            ? input.error.name
            : "Finalize failed",
        settledAt: input.landed ? new Date().toISOString() : null,
      })
      .where(eq(spendLedger.holdLockId, lockId));
  } catch (error) {
    logLedgerError("settle", error);
  }
}

/**
 * Records spend that was charged without a hold, such as the assistant's
 * metered chunks. It counts against the limits like any settled row.
 */
export async function recordChargedSpend(input: {
  organizationId: string;
  projectId: string;
  actor: string;
  feature: string;
  provider: "dataforseo" | "openrouter";
  credits: number;
  costUsd: number;
}) {
  try {
    const { db, spendLedger } = await ledgerDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.insert(spendLedger).values({
      id,
      organizationId: input.organizationId,
      projectId: input.projectId,
      feature: input.feature,
      provider: input.provider,
      actor: input.actor,
      periodMonth: now.slice(0, 7),
      estimatedCredits: input.credits,
      actualCredits: input.credits,
      costUsd: input.costUsd,
      status: "settled",
      idempotencyKey: id,
      createdAt: now,
      settledAt: now,
    });
  } catch (error) {
    logLedgerError("charge", error);
  }
}
