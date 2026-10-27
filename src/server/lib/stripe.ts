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

// The create endpoints that move money or bill a customer. A restricted
// key grants write per resource, so one create covers its updates too.
const WRITE_PROBES = {
  Customers: "/customers",
  Charges: "/charges",
  PaymentIntents: "/payment_intents",
  Refunds: "/refunds",
  Invoices: "/invoices",
  "Credit Notes": "/credit_notes",
  Subscriptions: "/subscriptions",
  "Checkout Sessions": "/checkout/sessions",
  "Payment Links": "/payment_links",
  Payouts: "/payouts",
  Transfers: "/transfers",
  "Top-ups": "/topups",
};

/**
 * Stripe has no API that lists a key's permissions. Relay sends each create
 * request with an unknown parameter, so nothing can be created: a key
 * without write access answers 403, and a key with it answers 400 for the
 * parameter. The 403 message names the account. Returns the resources the
 * key can write; any other answer is not proof either way, so it throws.
 */
export async function probeWriteAccess(key: string) {
  const answers = await Promise.all(
    Object.entries(WRITE_PROBES).map(async ([name, path]) => {
      const response = await fetch(`${API}${path}`, {
        method: "POST",
        headers: {
          ...headers(key),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "relay_read_only_probe=1",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      return {
        name,
        path,
        status: response.status,
        text: await response.text(),
      };
    }),
  );
  const unclear = answers.find(
    (answer) => answer.status !== 400 && answer.status !== 403,
  );
  if (unclear)
    throw new AppError(
      unclear.status === 429 ? "RATE_LIMITED" : "UPSTREAM_UNAVAILABLE",
      `Stripe answered ${unclear.status} for ${unclear.path}.`,
    );
  return {
    writable: answers
      .filter((answer) => answer.status === 400)
      .map((answer) => answer.name),
    accountId:
      answers
        .map((answer) => /\b(acct_[A-Za-z0-9]+)\b/.exec(answer.text)?.[1])
        .find(Boolean) ?? null,
  };
}
