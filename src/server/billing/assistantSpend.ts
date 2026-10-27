import { AppError } from "@/server/lib/errors";
import { admitSpend } from "./spendAdmission";
import { closeSpend, recordChargedSpend } from "./spendLedger";

// RFC-0009 5.3: each assistant turn reserves 50 credits inside the monthly
// limits. The metered chunks are the real spend; the reservation ends when
// the turn's metering has finished.
const TURN_CREDITS = 50;

type SamCustomer = {
  row: { userId: string };
  userEmail: string;
  project: { id: string; organizationId: string };
};

/** A refusal message at a limit or the rate cap; otherwise the reservation. */
export async function admitTurn(ctx: SamCustomer) {
  try {
    const id = await admitSpend({
      customer: {
        userId: ctx.row.userId,
        userEmail: ctx.userEmail,
        organizationId: ctx.project.organizationId,
        projectId: ctx.project.id,
      },
      feature: "agent",
      provider: "openrouter",
      estimatedCredits: TURN_CREDITS,
    });
    return { id, refusal: null };
  } catch (error) {
    if (error instanceof AppError && error.code === "SPEND_LIMIT_REACHED")
      return { id: null, refusal: error.message };
    if (error instanceof AppError && error.code === "RATE_LIMITED")
      return {
        id: null,
        refusal:
          "You're sending messages too quickly. Wait a minute, then try again.",
      };
    // The Autumn balance check already passed; a ledger outage must not
    // lock members out of chat.
    console.error("[spend] assistant admission failed", {
      error: error instanceof Error ? error.name : "unknown",
    });
    return { id: null, refusal: null };
  }
}

export function recordTurnSpend(
  ctx: SamCustomer,
  credits: number,
  costUsd: number,
) {
  if (credits <= 0) return Promise.resolve();
  return recordChargedSpend({
    organizationId: ctx.project.organizationId,
    projectId: ctx.project.id,
    actor: ctx.row.userId,
    feature: "agent",
    provider: "openrouter",
    credits,
    costUsd,
  });
}

/** Ends the turn's reservation once its metering chain has settled. */
export async function releaseTurn(id: string | null, billing: Promise<void>) {
  if (!id) return;
  await billing.catch(() => undefined);
  await closeSpend(id, "released");
}
