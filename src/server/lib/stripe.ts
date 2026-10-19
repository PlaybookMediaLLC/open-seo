import type { z } from "zod";
import { AppError } from "@/server/lib/errors";

// RFC-0016 5.3 and 5.4: read-only calls to the Stripe API with a restricted
// key. Relay never creates, changes or refunds anything in Stripe.
const API = "https://api.stripe.com/v1";
const TIMEOUT_MS = 15_000;

// The account's default API version applies: the fields Relay reads are
// stable across versions.
const headers = (key: string) => ({ Authorization: `Bearer ${key}` });

/** One GET; a 401 or 403 means the key cannot read this resource. */
export async function stripeGet<T>(
  key: string,
  path: string,
  schema: z.ZodType<T>,
  query: Record<string, string> = {},
): Promise<T> {
  const response = await fetch(`${API}${path}?${new URLSearchParams(query)}`, {
    headers: headers(key),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new AppError(
      response.status === 401 || response.status === 403
        ? "FORBIDDEN"
        : response.status === 429
          ? "RATE_LIMITED"
          : "UPSTREAM_UNAVAILABLE",
      `Stripe answered ${response.status} for ${path}.`,
    );
  }
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success)
    throw new AppError("UPSTREAM_UNAVAILABLE", "Stripe sent an unknown reply.");
  return parsed.data;
}

/**
 * Stripe has no API that lists a key's permissions. Relay sends a create
 * request with an unknown parameter, so nothing can be created: a key
 * without write access answers 403, and a key with it answers 400 for the
 * parameter. The 403 message names the account.
 */
export async function probeWriteAccess(key: string) {
  const response = await fetch(`${API}/customers`, {
    method: "POST",
    headers: {
      ...headers(key),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "relay_read_only_probe=1",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await response.text();
  return {
    readOnly: response.status === 403,
    accountId: /\b(acct_[A-Za-z0-9]+)\b/.exec(text)?.[1] ?? null,
  };
}
