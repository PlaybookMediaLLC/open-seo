import { and, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { sort, sumBy } from "remeda";
import { db } from "@/db";
import { revenueConnections, revenueEvents } from "@/db/schema";
import {
  authorizePublishing,
  type PublishingContext,
} from "@/server/features/publishing/publishingAccess";
import type { ExperimentRevenue } from "@/types/schemas/revenue";
import { revenuePathKey, type RevenueScores } from "./revenuePaths";

// RFC-0016 5.6: revenue, new customers and average first payment by first
// touch, per currency and never converted, with the coverage first.
const ROWS = 20;
const COVERAGE_TARGET = 0.8;
const SCORE_DAYS = 90;
const WINDOW_CUSTOMERS = 10;

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
const attributed =
  sql<number>`count(distinct case when ${revenueEvents.kind} = 'first_payment' and ${revenueEvents.ftChannel} <> 'unknown' then ${revenueEvents.customerHash} end)`.mapWith(
    Number,
  );

const since = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString();

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
    gte(revenueEvents.occurredAt, since(input.days)),
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
        attributed,
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

/**
 * RFC-0016 5.7: min(1, first-touch revenue in 90 days / the 90th percentile
 * across pages), by landing path and per currency. Null unless at least 80%
 * of new customers have attribution data.
 */
export async function loadRevenueScores(
  projectId: string,
): Promise<RevenueScores | null> {
  const scope = and(
    eq(revenueEvents.projectId, projectId),
    gte(revenueEvents.occurredAt, since(SCORE_DAYS)),
  );
  const [[coverage], rows] = await Promise.all([
    db
      .select({
        newCustomers: columns.newCustomers,
        attributed,
      })
      .from(revenueEvents)
      .where(scope),
    db
      .select({
        currency: revenueEvents.currency,
        path: revenueEvents.ftPath,
        revenueMinor: columns.revenueMinor,
      })
      .from(revenueEvents)
      .where(and(scope, isNotNull(revenueEvents.ftPath)))
      .groupBy(revenueEvents.currency, revenueEvents.ftPath),
  ]);
  if (
    !coverage?.newCustomers ||
    coverage.attributed / coverage.newCustomers < COVERAGE_TARGET
  )
    return null;
  const scores: RevenueScores = new Map();
  for (const currency of new Set(rows.map((row) => row.currency))) {
    const pages = rows.filter(
      (row) => row.currency === currency && row.path && row.revenueMinor > 0,
    );
    const values = sort(
      pages.map((row) => row.revenueMinor),
      (a, b) => a - b,
    );
    const p90Minor = values[Math.ceil(0.9 * values.length) - 1] ?? 0;
    for (const row of pages) {
      const key = revenuePathKey(row.path ?? "/");
      const score = Math.min(1, row.revenueMinor / p90Minor);
      if (score > (scores.get(key)?.score ?? 0))
        scores.set(key, {
          score,
          revenueMinor: row.revenueMinor,
          p90Minor,
          currency,
        });
    }
  }
  return scores;
}

async function windowTotals(
  projectId: string,
  paths: string[],
  start: string,
  end: string,
) {
  const rows = await db
    .select({
      currency: revenueEvents.currency,
      revenueMinor: columns.revenueMinor,
      newCustomers: columns.newCustomers,
    })
    .from(revenueEvents)
    .where(
      and(
        eq(revenueEvents.projectId, projectId),
        inArray(revenueEvents.ftPath, paths),
        gte(revenueEvents.occurredAt, `${start}T00:00:00.000Z`),
        lte(revenueEvents.occurredAt, `${end}T23:59:59.999Z`),
      ),
    )
    .groupBy(revenueEvents.currency);
  return {
    newCustomers: sumBy(rows, (row) => row.newCustomers),
    revenue: rows.map(({ currency, revenueMinor }) => ({
      currency,
      revenueMinor,
    })),
  };
}

/**
 * RFC-0016 5.7: new customers and revenue whose first touch is the changed
 * page, by payment date, in the baseline and observation windows. Null
 * without Stripe; totals only when each window has 10 new customers.
 */
export async function experimentRevenue(
  projectId: string,
  experiment: {
    targetUrl: string;
    baselineStart: string | null;
    baselineEnd: string | null;
    observationStart: string | null;
    observationEnd: string | null;
  },
): Promise<ExperimentRevenue | null> {
  const { baselineStart, baselineEnd, observationStart, observationEnd } =
    experiment;
  if (!baselineStart || !baselineEnd || !observationStart || !observationEnd)
    return null;
  const [connection] = await db
    .select({ id: revenueConnections.id })
    .from(revenueConnections)
    .where(eq(revenueConnections.projectId, projectId));
  if (!connection) return null;
  const key = revenuePathKey(experiment.targetUrl);
  const paths = [key, `${key}/`];
  const [baseline, observation] = await Promise.all([
    windowTotals(projectId, paths, baselineStart, baselineEnd),
    windowTotals(projectId, paths, observationStart, observationEnd),
  ]);
  return Math.min(baseline.newCustomers, observation.newCustomers) >=
    WINDOW_CUSTOMERS
    ? { enough: true, baseline, observation }
    : { enough: false, minimum: WINDOW_CUSTOMERS };
}

export const RevenueReportService = { report };
