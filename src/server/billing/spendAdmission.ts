import { env } from "cloudflare:workers";
import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import { growthNotifications, spendLedger, spendLimits } from "@/db/schema";
import { GrowthJobRepository } from "@/server/features/growth/repositories/GrowthJobRepository";
import { selectedValues } from "@/server/features/publishing/repositories/publishingSql";
import { AppError } from "@/server/lib/errors";
import { attachHolds, closeSpend } from "./spendLedger";
import { committedIn, limitUse, periodOf, type LimitUse } from "./spendQueries";
import {
  reserveUsageCredits,
  type BillingCustomerContext,
} from "./subscription";

// RFC-0009 5.3: every paid action passes the organization's and the
// project's monthly limits before any provider call. No limit row means
// that only the Autumn balance applies.

type Provider = "dataforseo" | "openrouter";
const WARN_SHARE = 0.8;

/** True when no limit row for the scope would be exceeded. */
function withinLimit(
  limitScope: SQL,
  ledgerScope: SQL,
  periodMonth: string,
  estimatedCredits: number,
) {
  return sql`not exists (select 1 from ${spendLimits} where ${limitScope} and ${spendLimits.monthlyLimitCredits} < ${committedIn(ledgerScope, periodMonth)} + ${estimatedCredits})`;
}

const scopeName = (use: LimitUse) =>
  use.scope === "project" ? "This project" : "This organization";

function refusalMessage(uses: LimitUse[], estimatedCredits: number) {
  const reached =
    uses.find((use) => use.committed + estimatedCredits > use.limit) ?? uses[0];
  return `${reached ? scopeName(reached) : "This organization"} reached its monthly limit of ${reached?.limit ?? 0} credits. An owner can change it in Billing.`;
}

/**
 * RFC-0009 5.5: one notification per limit and month once 80% is
 * committed. An organization limit notifies once, on the project that
 * crossed it.
 */
async function warnNearLimit(
  customer: BillingCustomerContext,
  periodMonth: string,
) {
  const { organizationId, projectId } = customer;
  if (!projectId) return;
  for (const use of await limitUse(organizationId, projectId, periodMonth)) {
    if (use.committed < use.limit * WARN_SHARE) continue;
    const dedupeKey = `${use.scope}:${periodMonth}`;
    if (use.scope === "organization") {
      const [sent] = await db
        .select({ id: growthNotifications.id })
        .from(growthNotifications)
        .where(
          and(
            eq(growthNotifications.organizationId, organizationId),
            eq(growthNotifications.kind, "spend_warning"),
            eq(growthNotifications.dedupeKey, dedupeKey),
          ),
        )
        .limit(1);
      if (sent) continue;
    }
    await GrowthJobRepository.notify({
      organizationId,
      projectId,
      kind: "spend_warning",
      title: `${scopeName(use)} used ${Math.floor((use.committed / use.limit) * 100)}% of its monthly credit limit`,
      body: `${use.committed} of ${use.limit} credits are committed this month. Paid actions stop at the limit.`,
      linkPath:
        use.scope === "project"
          ? `/p/${projectId}/settings/spending`
          : "/billing",
      dedupeKey,
    });
  }
}

let warnedNoLimiter = false;

/**
 * RFC-0009 5.8: 30 paid actions a minute per user and feature. Installs
 * without the binding skip the check and warn once.
 */
async function assertPaidActionRate(userId: string, feature: string) {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- declared as a rate limiter in deploy/alchemy/alchemy.run.ts; absent outside hosted prod
  const limiter = (env as { PAID_ACTION_RATE_LIMIT?: RateLimit })
    .PAID_ACTION_RATE_LIMIT;
  if (!limiter) {
    if (!warnedNoLimiter) console.warn("[spend] no paid action rate limit");
    warnedNoLimiter = true;
    return;
  }
  const { success } = await limiter.limit({ key: `${userId}:${feature}` });
  if (!success)
    throw new AppError(
      "RATE_LIMITED",
      "Too many paid actions. Try again in 60 seconds.",
      { tryAgainIn: "60000" },
    );
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
  await assertPaidActionRate(customer.userId, input.feature ?? input.provider);
  const now = input.now ?? new Date();
  const periodMonth = periodOf(now);
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
  if (admitted) {
    await warnNearLimit(customer, periodMonth).catch((error: unknown) =>
      console.error("[spend] limit warning failed", {
        error: error instanceof Error ? error.name : "unknown",
      }),
    );
    return id;
  }
  await db
    .insert(spendLedger)
    .values({ ...values, status: "refused", settledAt: now.toISOString() });
  throw new AppError(
    "SPEND_LIMIT_REACHED",
    refusalMessage(
      await limitUse(
        customer.organizationId,
        customer.projectId ?? null,
        periodMonth,
      ),
      estimatedCredits,
    ),
  );
}

/**
 * RFC-0009 5.3: scheduled work checks for room before it starts, so a run
 * at the limit skips with its reason. Each provider call still admits.
 */
export async function assertSpendRoom(
  scope: { organizationId: string; projectId?: string },
  estimatedCredits = 1,
) {
  const uses = await limitUse(
    scope.organizationId,
    scope.projectId ?? null,
    periodOf(new Date()),
  );
  if (uses.some((use) => use.committed + estimatedCredits > use.limit))
    throw new AppError(
      "SPEND_LIMIT_REACHED",
      refusalMessage(uses, estimatedCredits),
    );
}

/**
 * The DataForSEO reservation inside the monthly limits: admit the batch's
 * estimate, then hold it in Autumn and link each hold to the ledger.
 */
export async function reserveWithinLimits(
  args: Parameters<typeof reserveUsageCredits>[0],
  /** The ledger's feature when it differs from the credit feature. */
  ledgerFeature?: string,
) {
  const ledgerId = await admitSpend({
    customer: args.customer,
    feature: ledgerFeature ?? args.creditFeature,
    provider: args.provider ?? "dataforseo",
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
