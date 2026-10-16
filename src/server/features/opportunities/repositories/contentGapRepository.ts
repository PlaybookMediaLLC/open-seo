import {
  and,
  countDistinct,
  desc,
  eq,
  getTableColumns,
  gte,
  inArray,
} from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import {
  aiObservations,
  aiRuns,
  aiSources,
  competitorKeywordRows,
  competitorKeywordSnapshots,
  opportunities,
  opportunityAiEvidence,
  opportunityKeywordEvidence,
  opportunitySerpChecks,
} from "@/db/schema";
import type { KeywordEvidence, SerpCheck } from "@/types/schemas/opportunities";
import { urlJoinKey, type AiCitations } from "../services/detectors/shared";

// Nine bound values per row, under D1's 100 per statement.
const ROWS_PER_STATEMENT = 11;

const { projectId: _keyword, ...keywordColumns } = getTableColumns(
  opportunityKeywordEvidence,
);
const { projectId: _ai, ...aiColumns } = getTableColumns(opportunityAiEvidence);
const { projectId: _serp, ...serpColumns } = getTableColumns(
  opportunitySerpChecks,
);

type Market = { locationCode: number; languageCode: string };

/** The newest snapshot per domain fetched since a time. */
async function freshSnapshots(
  projectId: string,
  domains: string[],
  market: Market,
  since: string,
): Promise<Map<string, string>> {
  if (!domains.length) return new Map();
  const rows = await db
    .select({
      id: competitorKeywordSnapshots.id,
      domain: competitorKeywordSnapshots.domain,
    })
    .from(competitorKeywordSnapshots)
    .where(
      and(
        eq(competitorKeywordSnapshots.projectId, projectId),
        inArray(competitorKeywordSnapshots.domain, domains),
        eq(competitorKeywordSnapshots.locationCode, market.locationCode),
        eq(competitorKeywordSnapshots.languageCode, market.languageCode),
        gte(competitorKeywordSnapshots.fetchedAt, since),
      ),
    )
    .orderBy(desc(competitorKeywordSnapshots.fetchedAt));
  const latest = new Map<string, string>();
  for (const row of rows)
    if (!latest.has(row.domain)) latest.set(row.domain, row.id);
  return latest;
}

/** Saves one paid fetch and its rows atomically. */
async function saveSnapshot(input: {
  projectId: string;
  domain: string;
  market: Market;
  fetchedAt: string;
  estimatedCredits: number;
  rows: Array<{
    keyword: string;
    position: number;
    url: string | null;
    searchVolume: number;
    keywordDifficulty: number | null;
    intent: string | null;
  }>;
}): Promise<string> {
  const snapshotId = crypto.randomUUID();
  const rows = input.rows.map((row) => ({
    ...row,
    id: crypto.randomUUID(),
    projectId: input.projectId,
    snapshotId,
  }));
  await runBatch((tx) => {
    const statements: Promise<unknown>[] = [
      tx.insert(competitorKeywordSnapshots).values({
        id: snapshotId,
        projectId: input.projectId,
        domain: input.domain,
        ...input.market,
        fetchedAt: input.fetchedAt,
        rowCount: rows.length,
        estimatedCredits: input.estimatedCredits,
      }),
    ];
    for (let i = 0; i < rows.length; i += ROWS_PER_STATEMENT)
      statements.push(
        tx
          .insert(competitorKeywordRows)
          .values(rows.slice(i, i + ROWS_PER_STATEMENT)),
      );
    return statements;
  });
  return snapshotId;
}

async function snapshotKeywords(
  projectId: string,
  snapshotIds: string[],
): Promise<KeywordEvidence[]> {
  if (!snapshotIds.length) return [];
  const rows = await db
    .select({
      keyword: competitorKeywordRows.keyword,
      competitorPosition: competitorKeywordRows.position,
      competitorUrl: competitorKeywordRows.url,
      searchVolume: competitorKeywordRows.searchVolume,
      keywordDifficulty: competitorKeywordRows.keywordDifficulty,
      intent: competitorKeywordRows.intent,
      competitorDomain: competitorKeywordSnapshots.domain,
      locationCode: competitorKeywordSnapshots.locationCode,
      languageCode: competitorKeywordSnapshots.languageCode,
      fetchedAt: competitorKeywordSnapshots.fetchedAt,
    })
    .from(competitorKeywordRows)
    .innerJoin(
      competitorKeywordSnapshots,
      eq(competitorKeywordSnapshots.id, competitorKeywordRows.snapshotId),
    )
    .where(
      and(
        eq(competitorKeywordRows.projectId, projectId),
        inArray(competitorKeywordRows.snapshotId, snapshotIds),
      ),
    );
  return rows;
}

/** AI answer citations since a time, for the tracker with the most answers. */
async function aiCitations(
  projectId: string,
  since: string,
): Promise<AiCitations | null> {
  const scope = and(
    eq(aiRuns.projectId, projectId),
    gte(aiRuns.createdAt, since),
    eq(aiObservations.status, "completed"),
  );
  const trackers = await db
    .select({
      trackerId: aiRuns.trackerId,
      answers: countDistinct(aiObservations.id),
    })
    .from(aiObservations)
    .innerJoin(aiRuns, eq(aiRuns.id, aiObservations.runId))
    .where(scope)
    .groupBy(aiRuns.trackerId)
    .orderBy(desc(countDistinct(aiObservations.id)));
  const [tracker] = trackers;
  if (!tracker?.answers) return null;
  const sources = await db
    .select({ url: aiSources.url, observationId: aiSources.observationId })
    .from(aiSources)
    .innerJoin(aiObservations, eq(aiObservations.id, aiSources.observationId))
    .innerJoin(aiRuns, eq(aiRuns.id, aiObservations.runId))
    .where(and(scope, eq(aiRuns.trackerId, tracker.trackerId)));
  // One answer cites a URL once, however many times it lists it.
  const cited = new Map<string, Set<string>>();
  for (const source of sources) {
    const key = urlJoinKey(source.url);
    if (key)
      cited.set(key, (cited.get(key) ?? new Set()).add(source.observationId));
  }
  return {
    trackerId: tracker.trackerId,
    answers: Number(tracker.answers),
    periodStart: since,
    periodEnd: new Date().toISOString(),
    citations: new Map([...cited].map(([key, ids]) => [key, ids.size])),
  };
}

/** Live results checks since a time, newest per page, by URL join key. */
async function recentSerpChecks(
  projectId: string,
  since: string,
): Promise<Map<string, { value: number; reason: string }>> {
  const rows = await db
    .select({ url: opportunities.url, ...serpColumns })
    .from(opportunitySerpChecks)
    .innerJoin(
      opportunities,
      eq(opportunities.id, opportunitySerpChecks.opportunityId),
    )
    .where(
      and(
        eq(opportunitySerpChecks.projectId, projectId),
        eq(opportunities.projectId, projectId),
        gte(opportunitySerpChecks.checkedAt, since),
      ),
    )
    .orderBy(desc(opportunitySerpChecks.checkedAt));
  const checks = new Map<string, { value: number; reason: string }>();
  for (const row of rows) {
    const key = urlJoinKey(row.url);
    if (key && !checks.has(key))
      checks.set(key, { value: row.confidenceDelta, reason: serpReason(row) });
  }
  return checks;
}

/** Plain words for what a live results check found above the page. */
export function serpReason(check: Omit<SerpCheck, "id" | "opportunityId">) {
  const found = [
    check.hasAds && "ads",
    check.hasAiOverview && "an AI overview",
    check.hasFeaturedSnippet && "a featured snippet",
  ].filter(Boolean);
  return found.length
    ? `a live results check on ${check.checkedAt.slice(0, 10)} found ${found.join(", ")} above the page`
    : `a live results check on ${check.checkedAt.slice(0, 10)} found no ads, AI overview or featured snippet above the page`;
}

/** Saves a check and the opportunity's new confidence in one batch. */
async function saveSerpCheck(
  projectId: string,
  check: SerpCheck,
  update: { confidence: number; priority: number; scoreExplanation: string },
) {
  await runBatch((tx) => [
    tx.insert(opportunitySerpChecks).values({ ...check, projectId }),
    tx
      .update(opportunities)
      .set(update)
      .where(
        and(
          eq(opportunities.projectId, projectId),
          eq(opportunities.id, check.opportunityId),
        ),
      ),
  ]);
}

/** The phase 3 evidence of one opportunity. */
async function evidenceFor(projectId: string, opportunityId: string) {
  const [keywordEvidence, aiEvidence, serpChecks] = await Promise.all([
    db
      .select(keywordColumns)
      .from(opportunityKeywordEvidence)
      .where(
        and(
          eq(opportunityKeywordEvidence.projectId, projectId),
          eq(opportunityKeywordEvidence.opportunityId, opportunityId),
        ),
      )
      .orderBy(desc(opportunityKeywordEvidence.searchVolume)),
    db
      .select(aiColumns)
      .from(opportunityAiEvidence)
      .where(
        and(
          eq(opportunityAiEvidence.projectId, projectId),
          eq(opportunityAiEvidence.opportunityId, opportunityId),
        ),
      )
      .orderBy(desc(opportunityAiEvidence.periodEnd)),
    db
      .select(serpColumns)
      .from(opportunitySerpChecks)
      .where(
        and(
          eq(opportunitySerpChecks.projectId, projectId),
          eq(opportunitySerpChecks.opportunityId, opportunityId),
        ),
      )
      .orderBy(desc(opportunitySerpChecks.checkedAt)),
  ]);
  return { keywordEvidence, aiEvidence, serpChecks };
}

export const ContentGapRepository = {
  freshSnapshots,
  saveSnapshot,
  snapshotKeywords,
  aiCitations,
  recentSerpChecks,
  saveSerpCheck,
  evidenceFor,
};
