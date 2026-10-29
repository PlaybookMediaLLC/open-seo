import { env } from "cloudflare:workers";
import { AppError } from "@/server/lib/errors";

// Daily caps on invitation *emails*. The org plugin's invitationLimit bounds
// pending rows (20), but re-sends to an already-invited address are unbounded
// there — this is the bound on actual sends. KV is the only counter that
// holds across Workers isolates; the fixed UTC-day window keys expire on
// their own. KV writes race under concurrency, so treat these as abuse
// bounds, not exact quotas.
const PER_ADDRESS_DAILY_LIMIT = 5;
const PER_ORG_DAILY_LIMIT = 50;
const WINDOW_TTL_SECONDS = 60 * 60 * 24;

async function bumpDailyCounter(key: string, limit: number) {
  const count = Number((await env.KV.get(key)) ?? "0");
  if (count >= limit) return false;
  await env.KV.put(key, String(count + 1), {
    expirationTtl: WINDOW_TTL_SECONDS,
  });
  return true;
}

/**
 * One email against the organization's daily allowance, which every Relay
 * email shares (invitations, protection test alerts), and against its own
 * per-recipient cap under `cap.key`.
 */
export async function consumeEmailSendBudget(
  organizationId: string,
  cap: { key: string; limit: number; message: string },
) {
  const day = new Date().toISOString().slice(0, 10);
  if (
    !(await bumpDailyCounter(
      `invite-sends:${organizationId}:${day}`,
      PER_ORG_DAILY_LIMIT,
    ))
  ) {
    throw new AppError(
      "RATE_LIMITED",
      "This organization has reached its daily email limit.",
    );
  }
  if (!(await bumpDailyCounter(`${cap.key}:${day}`, cap.limit))) {
    throw new AppError("RATE_LIMITED", cap.message);
  }
}

export async function consumeInvitationSendBudget(
  organizationId: string,
  email: string,
) {
  const address = email.trim().toLowerCase();
  await consumeEmailSendBudget(organizationId, {
    key: `invite-sends:${organizationId}:${address}`,
    limit: PER_ADDRESS_DAILY_LIMIT,
    message: "This address has already received several invitations today.",
  });
}
