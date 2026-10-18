import { and, desc, eq, gte, inArray, max } from "drizzle-orm";
import { chunk } from "remeda";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import {
  splitTestAnalyses,
  splitTestDays,
  splitTestPages,
  splitTests,
  splitTestVerifications,
} from "@/db/schema";
import { fetchLiveMetadata } from "@/server/features/experiments/liveMetadata";
import {
  ga4DateInTimeZone,
  shiftGa4Date,
} from "@/server/features/ga4/services/Ga4Dates";
import { GscService } from "@/server/features/gsc/services/GscService";
import { GrowthJobRepository } from "@/server/features/growth/repositories/GrowthJobRepository";
import { literalPrefix } from "./splitTestBaseline";
import { analyzeDays } from "./splitTestAnalysis";
import { ga4Secondary } from "./splitTestGa4";

// RFC-0011 5.5 and 5.6: live verification at the start, on day 7 and on
// day 21; the daily Search Console data; and the analysis with its label.
const START_PASS_RATE = 0.95;
const MAX_DRIFT = 0.05;
const LIVE_FETCHES = 8;
// 8 columns a row: 12 rows stay inside D1's 100 bound parameters.
const ROWS_PER_INSERT = 12;
const INSERTS_PER_BATCH = 50;

const finite = (value: number | undefined) =>
  value !== undefined && Number.isFinite(value) ? value : null;

type Test = typeof splitTests.$inferSelect;
type Page = typeof splitTestPages.$inferSelect;

type Executor = Parameters<Parameters<typeof runBatch>[0]>[0];

/** Inserts in D1-sized statements, a bounded number per batch. */
async function insertRows<T>(
  rows: T[],
  insert: (tx: Executor, part: T[]) => Promise<unknown>,
) {
  const parts = chunk(rows, ROWS_PER_INSERT);
  for (let index = 0; index < parts.length; index += INSERTS_PER_BATCH) {
    const group = parts.slice(index, index + INSERTS_PER_BATCH);
    await runBatch((tx) => group.map((part) => insert(tx, part)));
  }
}

/**
 * Fetches every test page on production. A variant page passes when its
 * field differs from the original; a control page when it is unchanged.
 * Returns the failing paths, or null for a field Relay cannot read.
 */
async function verify(test: Test, pages: Page[]) {
  if (test.field === "other") return null;
  const checkedAt = new Date().toISOString();
  const rows: Array<typeof splitTestVerifications.$inferInsert> = [];
  for (let index = 0; index < pages.length; index += LIVE_FETCHES)
    await Promise.all(
      pages.slice(index, index + LIVE_FETCHES).map(async (page) => {
        const live = await fetchLiveMetadata(
          `${test.origin}${page.path}`,
        ).catch(() => null);
        const observed =
          (test.field === "title" ? live?.title : live?.description) ?? null;
        const original =
          test.field === "title"
            ? page.originalTitle
            : page.originalDescription;
        const changed = page.bucket === "variant";
        rows.push({
          id: crypto.randomUUID(),
          testId: test.id,
          projectId: test.projectId,
          path: page.path,
          checkedAt,
          expected: changed ? "changed" : "unchanged",
          observedValue: observed,
          passed: changed
            ? observed !== null && observed !== original
            : observed === original,
        });
      }),
    );
  await insertRows(rows, (tx, part) =>
    tx.insert(splitTestVerifications).values(part),
  );
  return rows.filter((row) => !row.passed).map((row) => row.path);
}

/** Stores the days after the last stored one, through `through`. */
async function storeDays(test: Test, pages: Page[], through: string) {
  const [latest] = await db
    .select({ date: max(splitTestDays.date) })
    .from(splitTestDays)
    .where(
      and(
        eq(splitTestDays.projectId, test.projectId),
        eq(splitTestDays.testId, test.id),
      ),
    );
  const start = latest?.date
    ? shiftGa4Date(latest.date, 1)
    : (test.baselineStart ?? through);
  if (start > through) return;
  const paths = new Set(pages.map((page) => page.path));
  const result = await GscService.getPerformance({
    projectId: test.projectId,
    dimensions: ["page", "date"],
    startDate: start,
    endDate: through,
    filters: [
      {
        dimension: "page",
        operator: "contains",
        expression: literalPrefix(test.pagePattern),
      },
    ],
    rowLimit: 25_000,
    dataState: "final",
  });
  const rows = result.rows.flatMap((row) => {
    const [url = "", date = ""] = row.keys ?? [];
    let path: string;
    try {
      path = new URL(url).pathname.replace(/\/+$/, "") || "/";
    } catch {
      return [];
    }
    return paths.has(path)
      ? [
          {
            id: crypto.randomUUID(),
            testId: test.id,
            projectId: test.projectId,
            path,
            date,
            clicks: Math.round(row.clicks ?? 0),
            impressions: Math.round(row.impressions ?? 0),
            position: row.position ?? null,
          },
        ]
      : [];
  });
  await insertRows(rows, (tx, part) =>
    tx.insert(splitTestDays).values(part).onConflictDoNothing(),
  );
}

const notify = (
  test: Test,
  organizationId: string,
  title: string,
  body: string,
  key: string,
) =>
  GrowthJobRepository.notify({
    organizationId,
    projectId: test.projectId,
    kind: "result_ready",
    title,
    body,
    linkPath: `/p/${test.projectId}/experiments/split-tests/${test.id}`,
    dedupeKey: `${test.id}:${key}`,
  });

/** One step of a test: verify a new deployment, or refresh a running test. */
export async function refreshSplitTest(
  test: Test,
  organizationId: string,
  now = new Date(),
) {
  const pages = await db
    .select()
    .from(splitTestPages)
    .where(
      and(
        eq(splitTestPages.projectId, test.projectId),
        eq(splitTestPages.testId, test.id),
      ),
    );
  if (test.status === "verifying") {
    const failing = await verify(test, pages);
    if (failing && failing.length > pages.length * (1 - START_PASS_RATE))
      return `${failing.length} of ${pages.length} pages failed live verification: ${failing.slice(0, 5).join(", ")}. Fix them and verify again.`;
    await db
      .update(splitTests)
      .set({ status: "running" })
      .where(
        and(eq(splitTests.id, test.id), eq(splitTests.status, "verifying")),
      );
    return failing
      ? `${pages.length - failing.length} of ${pages.length} pages passed live verification. The test is running.`
      : "Relay cannot read this field, so live verification is skipped. The test is running.";
  }
  if (test.status !== "running" || !test.observationStart)
    return "Nothing to refresh.";

  const today = ga4DateInTimeZone(now, "America/Los_Angeles");
  // 5.6: checks on observation days 7 and 21, once each.
  for (const offset of [6, 20]) {
    const due = shiftGa4Date(test.observationStart, offset);
    if (today < due) continue;
    const [done] = await db
      .select({ id: splitTestVerifications.id })
      .from(splitTestVerifications)
      .where(
        and(
          eq(splitTestVerifications.testId, test.id),
          gte(splitTestVerifications.checkedAt, `${due}T00:00:00.000Z`),
        ),
      )
      .limit(1);
    if (done) continue;
    const failing = await verify(test, pages);
    if (failing && failing.length > pages.length * MAX_DRIFT)
      await db
        .update(splitTests)
        .set({ contaminated: true })
        .where(eq(splitTests.id, test.id));
  }

  const finalDate = shiftGa4Date(today, -3);
  await storeDays(test, pages, finalDate);
  const days = await db
    .select({
      path: splitTestDays.path,
      date: splitTestDays.date,
      clicks: splitTestDays.clicks,
    })
    .from(splitTestDays)
    .where(
      and(
        eq(splitTestDays.projectId, test.projectId),
        eq(splitTestDays.testId, test.id),
      ),
    );
  // A GA4 failure leaves the secondary metrics empty, never a clicks result.
  const ga4 = await ga4Secondary(test, pages, finalDate, now).catch(() => null);
  // RFC-0012 phase 2: a conversion test's label comes from its conversions.
  const conversions = test.metric === "conversions";
  const result = conversions
    ? (ga4?.keyEvents ?? null)
    : analyzeDays(test, pages, days, finalDate);
  if (!result)
    return conversions
      ? "GA4 conversions are not available yet. The result waits for the next refresh."
      : "The observation window has not started yet.";
  // A conversion test's key events are its result, not a second metric.
  const keyEvents = conversions ? null : ga4?.keyEvents;
  const [fresh] = await db
    .select({ contaminated: splitTests.contaminated })
    .from(splitTests)
    .where(eq(splitTests.id, test.id));
  const notes = [
    result.prePeriodP <= 0.2 && "imbalanced",
    fresh?.contaminated && "contaminated",
    !result.windowComplete && "interim",
  ].filter(Boolean);
  await db.insert(splitTestAnalyses).values({
    id: crypto.randomUUID(),
    testId: test.id,
    projectId: test.projectId,
    runAt: now.toISOString(),
    observationDays: result.observationDays,
    estimatePct: result.estimatePct,
    // Too few pairs leave an end of the interval unbounded.
    ciLowPct: Number.isFinite(result.ciLowPct) ? result.ciLowPct : null,
    ciHighPct: Number.isFinite(result.ciHighPct) ? result.ciHighPct : null,
    pValue: result.pValue,
    prePeriodPValue: result.prePeriodP,
    label: result.label,
    notes: notes.join(", ") || null,
    sessionsEstimatePct: finite(ga4?.sessions?.estimatePct),
    sessionsCiLowPct: finite(ga4?.sessions?.ciLowPct),
    sessionsCiHighPct: finite(ga4?.sessions?.ciHighPct),
    keyEventsEstimatePct: finite(keyEvents?.estimatePct),
    keyEventsCiLowPct: finite(keyEvents?.ciLowPct),
    keyEventsCiHighPct: finite(keyEvents?.ciHighPct),
  });
  const estimate = `${result.estimatePct.toFixed(1)}% (90% interval ${result.ciLowPct.toFixed(1)}% to ${result.ciHighPct.toFixed(1)}%)`;
  if (result.harmful && !result.windowComplete)
    await notify(
      test,
      organizationId,
      `Split test may be causing harm: ${test.name}`,
      `The estimated effect after ${result.observationDays} days is ${estimate}. Review the test; you can remove it with a pull request.`,
      "harm",
    );
  if (result.windowComplete) {
    await db
      .update(splitTests)
      .set({ status: "concluded" })
      .where(and(eq(splitTests.id, test.id), eq(splitTests.status, "running")));
    await notify(
      test,
      organizationId,
      `Split test result: ${result.label} for ${test.name}`,
      `The estimated effect is ${estimate}.`,
      "result",
    );
  }
  return `Estimated effect after ${result.observationDays} days: ${estimate}.`;
}

/** The daily job: every verifying or running test of the project. */
export async function refreshProjectSplitTests(context: {
  projectId: string;
  organizationId: string;
  now: Date;
  log: (level: "info" | "warn", message: string) => void;
}) {
  const tests = await db
    .select()
    .from(splitTests)
    .where(
      and(
        eq(splitTests.projectId, context.projectId),
        inArray(splitTests.status, ["verifying", "running"]),
      ),
    );
  for (const test of tests)
    try {
      context.log(
        "info",
        `${test.name}: ${await refreshSplitTest(test, context.organizationId, context.now)}`,
      );
    } catch (error) {
      context.log(
        "warn",
        `${test.name}: ${error instanceof Error ? error.message : "refresh failed"}`,
      );
    }
  return `Refreshed ${tests.length} split tests.`;
}

/** The latest analysis and the latest verification of a test. */
export async function latestResults(projectId: string, testId: string) {
  const [analysis] = await db
    .select()
    .from(splitTestAnalyses)
    .where(
      and(
        eq(splitTestAnalyses.projectId, projectId),
        eq(splitTestAnalyses.testId, testId),
      ),
    )
    .orderBy(desc(splitTestAnalyses.runAt))
    .limit(1);
  const [lastCheck] = await db
    .select({ checkedAt: max(splitTestVerifications.checkedAt) })
    .from(splitTestVerifications)
    .where(
      and(
        eq(splitTestVerifications.projectId, projectId),
        eq(splitTestVerifications.testId, testId),
      ),
    );
  const verification = lastCheck?.checkedAt
    ? await db
        .select({
          path: splitTestVerifications.path,
          passed: splitTestVerifications.passed,
        })
        .from(splitTestVerifications)
        .where(
          and(
            eq(splitTestVerifications.testId, testId),
            eq(splitTestVerifications.checkedAt, lastCheck.checkedAt),
          ),
        )
    : [];
  return {
    analysis: analysis ?? null,
    verification: lastCheck?.checkedAt
      ? {
          checkedAt: lastCheck.checkedAt,
          passed: verification.filter((row) => row.passed).length,
          failing: verification
            .filter((row) => !row.passed)
            .map((row) => row.path),
        }
      : null,
  };
}
