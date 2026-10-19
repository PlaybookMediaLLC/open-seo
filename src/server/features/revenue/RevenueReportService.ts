import { and, desc, eq, gte, sql } from "drizzle-orm";
import { sort } from "remeda";
import { db } from "@/db";
import { revenueConnections, revenueEvents } from "@/db/schema";
import {
  authorizePublishing,
  type PublishingContext,
} from "@/server/features/publishing/publishingAccess";

// RFC-0016 5.6: revenue, new customers and average first payment by first
// touch, per currency and never converted, with the coverage first.
const ROWS = 20;

const columns = {
  revenueMinor: sql<number>`sum(${revenueEvents.amountMinor})`.mapWith(Number),
  newCustomers:
    sql<number>`count(distinct case when ${revenueEvents.kind} = 'first_payment' then ${revenueEvents.customerHash} end)`.mapWith(
      Number,
    ),
  firstPaymentsMinor:
    sql<number>`sum(case when ${revenueEvents.kind} = 'first_payment' then ${revenueEvents.amountMinor} else 0 end)`.mapWith(
      Number,
    ),
};

async function report(
  context: PublishingContext,
  input: { projectId: string; days: number },
) {
  await authorizePublishing(context, input.projectId);
  const [connection] = await db
    .select({ lastSyncedAt: revenueConnections.lastSyncedAt })
    .from(revenueConnections)
    .where(eq(revenueConnections.projectId, input.projectId));
  if (!connection) return null;
  const scope = and(
    eq(revenueEvents.projectId, input.projectId),
    gte(
      revenueEvents.occurredAt,
      new Date(Date.now() - input.days * 86_400_000).toISOString(),
    ),
  );
  const [byPath, byChannel, [coverage]] = await Promise.all([
    db
      .select({
        currency: revenueEvents.currency,
        path: revenueEvents.ftPath,
        ...columns,
      })
      .from(revenueEvents)
      .where(scope)
      .groupBy(revenueEvents.currency, revenueEvents.ftPath)
      .orderBy(desc(columns.revenueMinor))
      .limit(ROWS * 5),
    db
      .select({
        currency: revenueEvents.currency,
        channel: revenueEvents.ftChannel,
        ...columns,
      })
      .from(revenueEvents)
      .where(scope)
      .groupBy(revenueEvents.currency, revenueEvents.ftChannel),
    db
      .select({
        newCustomers: columns.newCustomers,
        attributed:
          sql<number>`count(distinct case when ${revenueEvents.kind} = 'first_payment' and ${revenueEvents.ftChannel} <> 'unknown' then ${revenueEvents.customerHash} end)`.mapWith(
            Number,
          ),
      })
      .from(revenueEvents)
      .where(scope),
  ]);
  const currencies = sort(
    [...new Set(byChannel.map((row) => row.currency))],
    (a, b) => a.localeCompare(b),
  );
  return {
    lastSyncedAt: connection.lastSyncedAt,
    coverage: {
      newCustomers: coverage?.newCustomers ?? 0,
      attributed: coverage?.attributed ?? 0,
    },
    currencies: currencies.map((currency) => ({
      currency,
      byPath: byPath.filter((row) => row.currency === currency).slice(0, ROWS),
      byChannel: byChannel.filter((row) => row.currency === currency),
    })),
  };
}

export const RevenueReportService = { report };
