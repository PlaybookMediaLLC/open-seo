import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  gte,
  isNotNull,
  isNull,
  lte,
  or,
} from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import { completeRun } from "./opportunityCompletion";
import { OpportunitySignalRepository } from "./opportunitySignals";
import { review } from "./opportunityReview";
import {
  keywordMetrics,
  opportunities,
  opportunityDecisions,
  opportunityEvidence,
  opportunityGa4Evidence,
  opportunityRuns,
  opportunityUrls,
} from "@/db/schema";
import type {
  Opportunity,
  OpportunityDetail,
  OpportunityListInput,
  OpportunityRun,
} from "@/types/schemas/opportunities";

const { lastDecisionId: _lastDecisionId, ...opportunityColumns } =
  getTableColumns(opportunities);
const { completionToken: _completionToken, ...runColumns } =
  getTableColumns(opportunityRuns);
const { projectId: _evidenceProjectId, ...evidenceColumns } =
  getTableColumns(opportunityEvidence);
const { projectId: _decisionProjectId, ...decisionColumns } =
  getTableColumns(opportunityDecisions);
const { projectId: _urlProjectId, ...urlColumns } =
  getTableColumns(opportunityUrls);
const { projectId: _ga4ProjectId, ...ga4Columns } = getTableColumns(
  opportunityGa4Evidence,
);
async function list(
  input: OpportunityListInput,
): Promise<{ rows: Opportunity[]; total: number }> {
  const where = and(
    eq(opportunities.projectId, input.projectId),
    input.status ? eq(opportunities.status, input.status) : undefined,
    input.type ? eq(opportunities.type, input.type) : undefined,
    gte(opportunities.priority, input.minPriority),
    input.includeDeferred
      ? undefined
      : or(
          isNull(opportunities.deferredUntil),
          lte(opportunities.deferredUntil, new Date().toISOString()),
        ),
  );
  const [rows, totals] = await Promise.all([
    db
      .select(opportunityColumns)
      .from(opportunities)
      .where(where)
      .orderBy(
        ...(input.sort === "priority" ? [desc(opportunities.priority)] : []),
        desc(opportunities.firstDetectedAt),
        desc(opportunities.id),
      )
      .limit(input.limit)
      .offset(input.offset),
    db.select({ total: count() }).from(opportunities).where(where),
  ]);
  return { rows, total: totals[0]?.total ?? 0 };
}

async function getDetail(
  projectId: string,
  id: string,
): Promise<OpportunityDetail | null> {
  const [opportunity] = await db
    .select(opportunityColumns)
    .from(opportunities)
    .where(
      and(eq(opportunities.projectId, projectId), eq(opportunities.id, id)),
    );
  if (!opportunity) return null;
  const [evidence, urls, ga4Evidence, decisions, signals] = await Promise.all([
    db
      .select(evidenceColumns)
      .from(opportunityEvidence)
      .where(
        and(
          eq(opportunityEvidence.projectId, projectId),
          eq(opportunityEvidence.opportunityId, id),
        ),
      )
      .orderBy(desc(opportunityEvidence.endDate), desc(opportunityEvidence.id)),
    db
      .select(urlColumns)
      .from(opportunityUrls)
      .where(
        and(
          eq(opportunityUrls.projectId, projectId),
          eq(opportunityUrls.opportunityId, id),
        ),
      )
      .orderBy(opportunityUrls.role, opportunityUrls.url),
    db
      .select(ga4Columns)
      .from(opportunityGa4Evidence)
      .where(
        and(
          eq(opportunityGa4Evidence.projectId, projectId),
          eq(opportunityGa4Evidence.opportunityId, id),
        ),
      )
      .orderBy(
        desc(opportunityGa4Evidence.runId),
        opportunityGa4Evidence.period,
      ),
    db
      .select(decisionColumns)
      .from(opportunityDecisions)
      .where(
        and(
          eq(opportunityDecisions.projectId, projectId),
          eq(opportunityDecisions.opportunityId, id),
        ),
      )
      .orderBy(
        desc(opportunityDecisions.createdAt),
        desc(opportunityDecisions.id),
      ),
    OpportunitySignalRepository.evidenceFor(projectId, id),
  ]);
  return { opportunity, evidence, urls, ga4Evidence, ...signals, decisions };
}

async function latestRun(
  projectId: string,
  siteUrl?: string,
): Promise<OpportunityRun | null> {
  const [row] = await db
    .select(runColumns)
    .from(opportunityRuns)
    .where(
      and(
        eq(opportunityRuns.projectId, projectId),
        siteUrl === undefined
          ? undefined
          : eq(opportunityRuns.siteUrl, siteUrl),
      ),
    )
    .orderBy(desc(opportunityRuns.startedAt), desc(opportunityRuns.id))
    .limit(1);
  return row ?? null;
}

async function listRuns(projectId: string): Promise<OpportunityRun[]> {
  return db
    .select(runColumns)
    .from(opportunityRuns)
    .where(eq(opportunityRuns.projectId, projectId))
    .orderBy(desc(opportunityRuns.startedAt), desc(opportunityRuns.id))
    .limit(20);
}

async function startRun(run: OpportunityRun): Promise<void> {
  // The service owns the refresh claim before calling this. Retire abandoned
  // runs and insert their successor atomically, without touching other projects.
  await runBatch((tx) => [
    tx
      .update(opportunityRuns)
      .set({
        status: "failed",
        error: "Superseded by a new detection run.",
        finishedAt: run.startedAt,
      })
      .where(
        and(
          eq(opportunityRuns.projectId, run.projectId),
          eq(opportunityRuns.status, "running"),
        ),
      ),
    tx.insert(opportunityRuns).values(run),
  ]);
}

/** Saves the reserved requests before network work, so a failed run counts. */
async function setRequestCount(
  projectId: string,
  runId: string,
  requestCount: number,
  inspectionRequests = 0,
): Promise<void> {
  await db
    .update(opportunityRuns)
    .set({ requestCount, inspectionRequests })
    .where(
      and(
        eq(opportunityRuns.projectId, projectId),
        eq(opportunityRuns.id, runId),
        eq(opportunityRuns.status, "running"),
      ),
    );
}

async function failRun(
  projectId: string,
  runId: string,
  error: string,
): Promise<void> {
  await db
    .update(opportunityRuns)
    .set({ status: "failed", error, finishedAt: new Date().toISOString() })
    .where(
      and(
        eq(opportunityRuns.projectId, projectId),
        eq(opportunityRuns.id, runId),
        eq(opportunityRuns.status, "running"),
      ),
    );
}

/** Lowercase keyword to cached difficulty. Reads only; it buys nothing. */
async function cachedKeywordDifficulty(input: {
  projectId: string;
  locationCode: number;
  languageCode: string;
  since: string;
}): Promise<Map<string, number>> {
  const rows = await db
    .select({
      keyword: keywordMetrics.keyword,
      difficulty: keywordMetrics.keywordDifficulty,
    })
    .from(keywordMetrics)
    .where(
      and(
        eq(keywordMetrics.projectId, input.projectId),
        eq(keywordMetrics.locationCode, input.locationCode),
        eq(keywordMetrics.languageCode, input.languageCode),
        isNotNull(keywordMetrics.keywordDifficulty),
        gte(keywordMetrics.fetchedAt, input.since),
      ),
    );
  return new Map(
    rows.map((row) => [row.keyword.toLowerCase(), row.difficulty ?? 0]),
  );
}

export const OpportunityRepository = {
  cachedKeywordDifficulty,
  list,
  getDetail,
  latestRun,
  listRuns,
  startRun,
  setRequestCount,
  failRun,
  completeRun,
  review,
};
