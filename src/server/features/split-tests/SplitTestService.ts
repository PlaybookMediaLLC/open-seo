import { and, desc, eq } from "drizzle-orm";
import { chunk, sortBy, sum } from "remeda";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import { splitTestDays, splitTestPages, splitTests } from "@/db/schema";
import { hasOrgPermission } from "@/lib/org-permissions";
import { requireOrgPermission } from "@/server/auth/org-gate";
import { fetchLiveMetadata } from "@/server/features/experiments/liveMetadata";
import {
  authorize,
  type OpportunityContext,
} from "@/server/features/opportunities/services/opportunityAccess";
import { connectedGithub } from "@/server/features/publishing/publishingAccess";
import { getConnection } from "@/server/features/publishing/repositories/publishingConnections";
import { AppError } from "@/server/lib/errors";
import type { CreateSplitTestInput } from "@/types/schemas/splitTests";
import {
  baselineWindow,
  loadBaseline,
  prePeriodDifferences,
} from "./splitTestBaseline";
import {
  ga4DateInTimeZone,
  shiftGa4Date,
} from "@/server/features/ga4/services/Ga4Dates";
import { groupSeries, pairCsv } from "./splitTestAnalysis";
import { latestResults, refreshSplitTest } from "./splitTestRefresh";
import { routeFiles } from "./splitTestTemplate";
import {
  assign,
  eligibility,
  minimumDetectableEffect,
  randomizationTest,
} from "./splitStats";

// RFC-0011 5.2, 5.3 and 5.9: create a test from a page pattern, and read it.
// Members read; owners and admins (integration:manage) create.
const ORIGINAL_FETCHES = 8;
// 11 columns a row: 9 rows stay inside D1's 100 bound parameters.
const PAGE_ROWS_PER_INSERT = 9;

async function list(context: OpportunityContext, projectId: string) {
  await authorize(context, projectId);
  return {
    canManage: hasOrgPermission(context.role, { integration: ["manage"] }),
    tests: await db
      .select()
      .from(splitTests)
      .where(eq(splitTests.projectId, projectId))
      .orderBy(desc(splitTests.createdAt)),
  };
}

async function get(
  context: OpportunityContext,
  input: { projectId: string; testId: string },
) {
  await authorize(context, input.projectId);
  const [test] = await db
    .select()
    .from(splitTests)
    .where(
      and(
        eq(splitTests.projectId, input.projectId),
        eq(splitTests.id, input.testId),
      ),
    );
  if (!test) throw new AppError("NOT_FOUND");
  const pages = await db
    .select()
    .from(splitTestPages)
    .where(
      and(
        eq(splitTestPages.projectId, input.projectId),
        eq(splitTestPages.testId, input.testId),
      ),
    );
  const days = await storedDays(input.projectId, input.testId);
  const total = (bucket: "variant" | "control") =>
    sum(
      pages
        .filter((page) => page.bucket === bucket)
        .map((page) => page.baselineClicks),
    );
  return {
    test,
    pages: sortBy(pages, (page) => page.pairIndex),
    variantClicks: total("variant"),
    controlClicks: total("control"),
    canManage: hasOrgPermission(context.role, { integration: ["manage"] }),
    series: groupSeries(test, pages, days),
    ...(await latestResults(input.projectId, input.testId)),
  };
}

const storedDays = (projectId: string, testId: string) =>
  db
    .select({
      path: splitTestDays.path,
      date: splitTestDays.date,
      clicks: splitTestDays.clicks,
    })
    .from(splitTestDays)
    .where(
      and(
        eq(splitTestDays.projectId, projectId),
        eq(splitTestDays.testId, testId),
      ),
    );

/** One row per pair for scripts/split-test-reference.py (5.5, 10 phase 1b). */
async function csv(
  context: OpportunityContext,
  input: { projectId: string; testId: string },
) {
  const { test, pages } = await get(context, input);
  const through = shiftGa4Date(
    ga4DateInTimeZone(new Date(), "America/Los_Angeles"),
    -3,
  );
  return {
    filename: `split-test-${test.id.slice(0, 8)}.csv`,
    csv: pairCsv(
      test,
      pages,
      await storedDays(input.projectId, input.testId),
      through,
    ),
  };
}

/** 5.5 and 5.6: verify or refresh one test now, as the daily job does. */
async function refresh(
  context: OpportunityContext,
  input: { projectId: string; testId: string },
) {
  await authorize(context, input.projectId);
  requireOrgPermission(context, { integration: ["manage"] });
  const [test] = await db
    .select()
    .from(splitTests)
    .where(
      and(
        eq(splitTests.projectId, input.projectId),
        eq(splitTests.id, input.testId),
      ),
    );
  if (!test) throw new AppError("NOT_FOUND");
  return { message: await refreshSplitTest(test, context.organizationId) };
}

/** Each path's live title and description, a few at a time. */
async function originals(origin: string, paths: string[]) {
  const found = new Map<
    string,
    Awaited<ReturnType<typeof fetchLiveMetadata>>
  >();
  for (let index = 0; index < paths.length; index += ORIGINAL_FETCHES)
    await Promise.all(
      paths.slice(index, index + ORIGINAL_FETCHES).map(async (path) => {
        found.set(
          path,
          await fetchLiveMetadata(`${origin}${path}`).catch(() => null),
        );
      }),
    );
  return found;
}

const refuse = (failures: string[], summary: string | null = null) => ({
  created: false as const,
  failures,
  summary,
});

/**
 * Checks the group and stores the test with its assignment. An ineligible
 * group creates nothing and returns each failed requirement.
 */
async function create(
  context: OpportunityContext,
  input: CreateSplitTestInput,
) {
  await authorize(context, input.projectId);
  requireOrgPermission(context, { integration: ["manage"] });
  const window = baselineWindow();
  const pages = (
    await loadBaseline(input.projectId, input.pagePattern, window)
  ).filter((page) => page.clicks >= 1);
  const thresholds = eligibility(pages, null);
  if (!thresholds.eligible) return refuse(thresholds.failures);

  const connection = await getConnection(input.projectId);
  if (!connection)
    return refuse([
      "Connect the repository in Project settings → Publishing first. Relay checks that the pages share one template.",
    ]);
  const client = await connectedGithub(
    connection,
    AbortSignal.timeout(60_000),
    {
      metadata: "read",
      contents: "read",
    },
  );
  const files = await routeFiles(
    client,
    connection,
    pages.map((page) => page.path),
  );
  const templates = new Map<string, number>();
  for (const file of files.values())
    templates.set(
      file ?? "no route file",
      (templates.get(file ?? "no route file") ?? 0) + 1,
    );
  if (templates.size !== 1 || templates.has("no route file"))
    return refuse([
      `The pages use ${templates.size} templates: ${[...templates]
        .slice(0, 5)
        .map(([file, count]) => `${file} (${count} pages)`)
        .join(", ")}. A test needs pages that share one template.`,
    ]);

  const [firstSeed = 0] = crypto.getRandomValues(new Uint32Array(1));
  const assignment = assign(
    pages,
    firstSeed,
    (pairs, seed) =>
      randomizationTest(prePeriodDifferences(pairs, pages), seed).pValue,
  );
  if (!assignment.balanced)
    return refuse([
      "Relay could not balance the two groups in 20 draws. Their clicks moved too differently before the test.",
    ]);
  const mdePct = minimumDetectableEffect(
    prePeriodDifferences(assignment.pairs, pages),
  );
  const result = eligibility(pages, mdePct);
  if (!result.eligible) return refuse(result.failures, result.summary);

  // The origin that brings the most clicks; live checks fetch it later.
  const origin = sortBy(pages, [(page) => page.clicks, "desc"])[0].origin;
  const byPath = new Map(pages.map((page) => [page.path, page]));
  const paired = assignment.pairs.flatMap((pair) => [
    { path: pair.variant, pairIndex: pair.index, bucket: "variant" as const },
    { path: pair.control, pairIndex: pair.index, bucket: "control" as const },
  ]);
  const live = await originals(
    origin,
    paired.map((page) => page.path),
  );
  const testId = crypto.randomUUID();
  await runBatch((tx) => [
    tx.insert(splitTests).values({
      id: testId,
      projectId: input.projectId,
      name: input.name,
      hypothesis: input.hypothesis,
      field: input.field,
      pagePattern: input.pagePattern,
      origin,
      templatePath: [...templates.keys()][0] ?? null,
      status: "eligible",
      seed: assignment.seed,
      pairs: assignment.pairs.length,
      mdePct,
      baselineStart: window.start,
      baselineEnd: window.end,
      createdBy: context.userId,
      createdAt: new Date().toISOString(),
    }),
    ...chunk(
      paired.map((page) => ({
        id: crypto.randomUUID(),
        testId,
        projectId: input.projectId,
        ...page,
        baselineClicks: byPath.get(page.path)?.clicks ?? 0,
        baselineImpressions: byPath.get(page.path)?.impressions ?? 0,
        originalTitle: live.get(page.path)?.title ?? null,
        originalDescription: live.get(page.path)?.description ?? null,
      })),
      PAGE_ROWS_PER_INSERT,
    ).map((rows) => tx.insert(splitTestPages).values(rows)),
  ]);
  return { created: true as const, testId, summary: result.summary };
}

export const SplitTestService = { list, get, create, refresh, csv };
