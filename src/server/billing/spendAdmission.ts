import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import { spendLedger, spendLimits } from "@/db/schema";
import { selectedValues } from "@/server/features/publishing/repositories/publishingSql";
import { AppError } from "@/server/lib/errors";
import { attachHolds, closeSpend } from "./spendLedger";
import {
  reserveUsageCredits,
  type BillingCustomerContext,
} from "./subscription";

// RFC-0009 5.3: every paid action passes the organization's and the
// project's monthly limits before any provider call. No limit row means
// that only the Autumn balance applies.

type Provider = "dataforseo" | "openrouter";

/** Credits a scope committed this period: the real cost once known. */
function committed(scope: SQL, periodMonth: string) {
  return sql`(select coalesce(sum(case when ${spendLedger.status} = 'admitted' then ${spendLedger.estimatedCredits} when ${spendLedger.status} in ('settled', 'settle_failed') then coalesce(${spendLedger.actualCredits}, 0) else 0 end), 0) from ${spendLedger} where ${scope} and ${spendLedger.periodMonth} = ${periodMonth})`;
}

/** True when no limit row for the scope would be exceeded. */
function withinLimit(
  limitScope: SQL,
  ledgerScope: SQL,
  periodMonth: string,
  estimatedCredits: number,
) {
  return sql`not exists (select 1 from ${spendLimits} where ${limitScope} and ${spendLimits.monthlyLimitCredits} < ${committed(ledgerScope, periodMonth)} + ${estimatedCredits})`;
}

async function refusalMessage(
  customer: BillingCustomerContext,
  periodMonth: string,
  estimatedCredits: number,
) {
  const limits = await db
    .select()
    .from(spendLimits)
    .where(eq(spendLimits.organizationId, customer.organizationId));
  const project = limits.find(
    (row) => row.projectId !== null && row.projectId === customer.projectId,
  );
  if (project) {
    const [row] = await db
      .select({
        total: committed(
          eq(spendLedger.projectId, project.projectId ?? ""),
          periodMonth,
        ),
      })
      .from(spendLimits)
      .limit(1);
    if (
      Number(row?.total ?? 0) + estimatedCredits >
      project.monthlyLimitCredits
    )
      return `This project reached its monthly limit of ${project.monthlyLimitCredits} credits. An owner can change it in Billing.`;
  }
  const organization = limits.find((row) => row.projectId === null);
  return `This organization reached its monthly limit of ${organization?.monthlyLimitCredits ?? 0} credits. An owner can change it in Billing.`;
}

/**
 * Writes an `admitted` ledger row when both monthly limits allow the
 * estimate, or a `refused` row and throws SPEND_LIMIT_REACHED.
 */
export async function admitSpend(input: {
  customer: BillingCustomerContext;
  feature?: string;
  provider: Provider;
  estimatedCredits: number;
  now?: Date;
}) {
  const { customer, estimatedCredits } = input;
  const now = input.now ?? new Date();
  const periodMonth = now.toISOString().slice(0, 7);
  const id = crypto.randomUUID();
  const values = {
    id,
    organizationId: customer.organizationId,
    projectId: customer.projectId ?? null,
    feature: input.feature ?? null,
    provider: input.provider,
    actor: customer.userId,
    periodMonth,
    estimatedCredits,
    actualCredits: null,
    costUsd: null,
    holdLockId: null,
    status: "admitted",
    idempotencyKey: id,
    attempts: 0,
    lastError: null,
    createdAt: now.toISOString(),
    settledAt: null,
  } as const;
  const condition = and(
    withinLimit(
      and(
        eq(spendLimits.organizationId, customer.organizationId),
        isNull(spendLimits.projectId),
      ) ?? sql`false`,
      eq(spendLedger.organizationId, customer.organizationId),
      periodMonth,
      estimatedCredits,
    ),
    customer.projectId
      ? withinLimit(
          and(
            eq(spendLimits.organizationId, customer.organizationId),
            eq(spendLimits.projectId, customer.projectId),
          ) ?? sql`false`,
          eq(spendLedger.projectId, customer.projectId),
          periodMonth,
          estimatedCredits,
        )
      : undefined,
  );
  await runBatch((tx) => [
    // Postgres: lock the organization's limits, so parallel admissions
    // count each other. D1 runs the insert as one atomic statement.
    tx
      .update(spendLimits)
      .set({ monthlyLimitCredits: sql`${spendLimits.monthlyLimitCredits}` })
      .where(eq(spendLimits.organizationId, customer.organizationId)),
    tx
      .insert(spendLedger)
      .select(selectedValues(spendLedger, values, condition ?? sql`true`)),
  ]);
  const [admitted] = await db
    .select({ id: spendLedger.id })
    .from(spendLedger)
    .where(eq(spendLedger.id, id));
  if (admitted) return id;
  await db
    .insert(spendLedger)
    .values({ ...values, status: "refused", settledAt: now.toISOString() });
  throw new AppError(
    "SPEND_LIMIT_REACHED",
    await refusalMessage(customer, periodMonth, estimatedCredits),
  );
}

/**
 * The DataForSEO reservation inside the monthly limits: admit the batch's
 * estimate, then hold it in Autumn and link each hold to the ledger.
 */
export async function reserveWithinLimits(
  args: Parameters<typeof reserveUsageCredits>[0],
) {
  const ledgerId = await admitSpend({
    customer: args.customer,
    feature: args.creditFeature,
    provider: "dataforseo",
    estimatedCredits: args.callCredits.reduce(
      (sum, credits) => sum + Math.max(1, credits),
      0,
    ),
  });
  try {
    const reserved = await reserveUsageCredits(args);
    await attachHolds(ledgerId, reserved.holds);
    return reserved;
  } catch (error) {
    const refused =
      error instanceof AppError && error.code === "INSUFFICIENT_CREDITS";
    await closeSpend(ledgerId, refused ? "refused" : "released");
    throw error;
  }
}
