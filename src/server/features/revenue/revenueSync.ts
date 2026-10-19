import { and, eq } from "drizzle-orm";
import { chunk } from "remeda";
import { z } from "zod";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import { revenueConnections, revenueEvents } from "@/db/schema";
import { openToken } from "@/server/features/publishing/tokenKeys";
import { sha256Hex } from "@/server/lib/audit/ids";
import { AppError } from "@/server/lib/errors";
import { stripeGet } from "@/server/lib/stripe";
import { channelOf } from "@/shared/attribution";

// RFC-0016 5.4: the daily sync of paid invoices and refunds. Stripe lists
// newest first, so the sync walks 7-day windows forward from the cursor and
// reads each window whole; it stops at the first window boundary after
// 5,000 invoices, so no window is half-synced. Each run starts 7 days
// before the cursor, so a late payment is still found; a unique hash keeps
// one row per payment. Only the fields below are read: names, emails and
// addresses never reach the database.
const WINDOW_SECONDS = 7 * 86_400;
const FIRST_SYNC_SECONDS = 365 * 86_400;
const MAX_INVOICES = 5_000;
const PAGE = "100";
const ROWS_PER_INSERT = 6;

const metadataSchema = z.record(z.string(), z.string()).nullish();
const invoiceSchema = z.object({
  id: z.string(),
  customer: z.string().nullish(),
  created: z.number(),
  billing_reason: z.string().nullish(),
  amount_paid: z.number(),
  currency: z.string(),
  subscription_details: z.object({ metadata: metadataSchema }).nullish(),
  parent: z
    .object({
      subscription_details: z.object({ metadata: metadataSchema }).nullish(),
    })
    .nullish(),
});
const refundSchema = z.object({
  id: z.string(),
  amount: z.number(),
  currency: z.string(),
  created: z.number(),
  status: z.string(),
  charge: z
    .object({ customer: z.string().nullish(), invoice: z.string().nullish() })
    .nullish(),
});
const page = <T extends z.ZodType>(item: T) =>
  z.object({ data: z.array(item), has_more: z.boolean() });

type Row = typeof revenueEvents.$inferInsert;
type Metadata = Record<string, string>;
const hasTouch = (metadata: Metadata | null | undefined) =>
  Boolean(metadata?.relay_ft_at);
/** The first-touch columns of a payment, from Stripe metadata. */
const touchFields = (touch: Metadata | null | undefined) => ({
  ftPath: touch?.relay_ft_path || null,
  ftSource: touch?.relay_ft_source || null,
  ftMedium: touch?.relay_ft_medium || null,
  ftCampaign: touch?.relay_ft_campaign || null,
  ftChannel: channelOf(touch ?? null),
});
type TouchFields = ReturnType<typeof touchFields>;

/** Every item of a list, following has_more. */
async function listAll<T extends { id: string }>(
  key: string,
  path: string,
  item: z.ZodType<T>,
  query: Record<string, string>,
) {
  const items: T[] = [];
  let after: string | undefined;
  for (;;) {
    const result = await stripeGet(key, path, page(item), {
      ...query,
      limit: PAGE,
      ...(after ? { starting_after: after } : {}),
    });
    items.push(...result.data);
    if (!result.has_more || !result.data.length) return items;
    after = result.data.at(-1)?.id;
  }
}

export async function syncRevenue(projectId: string, now: Date) {
  const [connection] = await db
    .select()
    .from(revenueConnections)
    .where(eq(revenueConnections.projectId, projectId));
  if (!connection) return { connected: false as const };
  const { token: key, rewrapped } = await openToken({
    encryptedToken: connection.encryptedKey,
    tokenKeyVersion: connection.keyVersion,
  });
  const hash = (id: string) => sha256Hex(`${connection.hashSalt}:${id}`);
  const nowSeconds = Math.floor(now.getTime() / 1000);
  let start = Math.max(
    0,
    (connection.syncCursor ?? nowSeconds - FIRST_SYNC_SECONDS) - WINDOW_SECONDS,
  );
  // Customer metadata is read once a run.
  const touches = new Map<string, Metadata | null>();
  const customerTouch = async (customer: string) => {
    if (!touches.has(customer)) {
      const sessions = await stripeGet(
        key,
        "/checkout/sessions",
        page(z.object({ id: z.string(), metadata: metadataSchema })),
        { customer, limit: "10" },
      ).catch(() => ({ data: [] }));
      const fromSession = sessions.data.find((session) =>
        hasTouch(session.metadata),
      )?.metadata;
      const fromCustomer = fromSession
        ? null
        : await stripeGet(
            key,
            `/customers/${encodeURIComponent(customer)}`,
            z.object({ metadata: metadataSchema }),
          )
            .then((value) => value.metadata)
            .catch(() => null);
      touches.set(customer, fromSession ?? fromCustomer ?? null);
    }
    return touches.get(customer) ?? null;
  };
  const rows: Row[] = [];
  // A refund takes the first touch of the payment it refunds.
  const invoiceTouch = new Map<string, TouchFields>();
  const refundedTouch = async (invoice: string | null | undefined) => {
    if (!invoice) return null;
    const known = invoiceTouch.get(invoice);
    if (known) return known;
    const [stored] = await db
      .select({
        ftPath: revenueEvents.ftPath,
        ftSource: revenueEvents.ftSource,
        ftMedium: revenueEvents.ftMedium,
        ftCampaign: revenueEvents.ftCampaign,
        ftChannel: revenueEvents.ftChannel,
      })
      .from(revenueEvents)
      .where(
        and(
          eq(revenueEvents.projectId, projectId),
          eq(revenueEvents.externalIdHash, await hash(invoice)),
        ),
      );
    return stored ?? null;
  };
  /** The window's refunds; false when the key cannot read them. */
  const syncRefunds = async (range: Record<string, string>) => {
    try {
      const refunds = await listAll(key, "/refunds", refundSchema, {
        ...range,
        "expand[]": "data.charge",
      });
      for (const refund of refunds) {
        const customer = refund.charge?.customer;
        if (refund.status !== "succeeded" || !customer) continue;
        const touch =
          (await refundedTouch(refund.charge?.invoice)) ??
          touchFields(await customerTouch(customer));
        rows.push({
          id: crypto.randomUUID(),
          projectId,
          externalIdHash: await hash(refund.id),
          customerHash: await hash(customer),
          kind: "refund",
          amountMinor: -refund.amount,
          currency: refund.currency.toLowerCase(),
          occurredAt: new Date(refund.created * 1000).toISOString(),
          ...touch,
        });
      }
      return true;
    } catch (error) {
      // The key may not read refunds; invoices still sync.
      if (error instanceof AppError && error.code === "FORBIDDEN") return false;
      throw error;
    }
  };
  let invoices = 0;
  let refundsSkipped = false;
  while (start < nowSeconds && invoices < MAX_INVOICES) {
    const end = Math.min(start + WINDOW_SECONDS, nowSeconds);
    const range = { "created[gte]": String(start), "created[lt]": String(end) };
    const paid = await listAll(key, "/invoices", invoiceSchema, {
      ...range,
      status: "paid",
    });
    invoices += paid.length;
    for (const invoice of paid) {
      if (!invoice.customer || invoice.amount_paid <= 0) continue;
      const subscription =
        invoice.subscription_details?.metadata ??
        invoice.parent?.subscription_details?.metadata;
      const touch = touchFields(
        hasTouch(subscription)
          ? subscription
          : await customerTouch(invoice.customer),
      );
      invoiceTouch.set(invoice.id, touch);
      rows.push({
        id: crypto.randomUUID(),
        projectId,
        externalIdHash: await hash(invoice.id),
        customerHash: await hash(invoice.customer),
        kind:
          invoice.billing_reason === "subscription_create"
            ? "first_payment"
            : invoice.billing_reason?.startsWith("subscription_")
              ? "renewal"
              : "one_time",
        amountMinor: invoice.amount_paid,
        currency: invoice.currency.toLowerCase(),
        occurredAt: new Date(invoice.created * 1000).toISOString(),
        ...touch,
      });
    }
    if (!refundsSkipped) refundsSkipped = !(await syncRefunds(range));
    start = end;
  }
  await runBatch((tx) => [
    ...chunk(rows, ROWS_PER_INSERT).map((values) =>
      tx.insert(revenueEvents).values(values).onConflictDoNothing(),
    ),
    tx
      .update(revenueConnections)
      .set({
        syncCursor: start,
        lastSyncedAt: now.toISOString(),
        // RFC-0009: a key under the previous version moves to the current one.
        ...(rewrapped
          ? {
              encryptedKey: rewrapped.encryptedToken,
              keyVersion: rewrapped.tokenKeyVersion,
            }
          : {}),
      })
      .where(eq(revenueConnections.projectId, projectId)),
  ]);
  return {
    connected: true as const,
    invoices,
    rows: rows.length,
    complete: start >= nowSeconds,
    refundsSkipped,
  };
}
