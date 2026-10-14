import {
  and,
  count,
  desc,
  eq,
  exists,
  getTableColumns,
  gt,
  gte,
  isNull,
  lte,
  or,
  sql,
  SQL,
  type Table,
} from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import { review } from "./opportunityReview";
import {
  dataRefreshClaims,
  gscConnections,
  opportunities,
  opportunityDecisions,
  opportunityEvidence,
  opportunityRuns,
  projects,
} from "@/db/schema";
import type {
  Opportunity,
  OpportunityCandidate,
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

// INSERT SELECT keeps each write conditional inside the same D1 batch / PG
// transaction. Column encoders preserve dialect-native booleans and numbers.
function selectedValues(
  table: Table,
  values: Record<string, unknown>,
  condition: SQL,
) {
  const fields = Object.entries(getTableColumns(table)).map(([key, column]) => {
    const value = values[key];
    if (value === undefined) throw new Error(`Missing inserted field: ${key}`);
    return value instanceof SQL ? value : sql`${sql.param(value, column)}`;
  });
  return sql`select ${sql.join(fields, sql`, `)} where ${condition}`;
}

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
  const [evidence, decisions] = await Promise.all([
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
  ]);
  return { opportunity, evidence, decisions };
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

async function setRequestCount(
  projectId: string,
  runId: string,
  requestCount: number,
): Promise<void> {
  await db
    .update(opportunityRuns)
    .set({ requestCount })
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

async function completeRun(input: {
  run: OpportunityRun;
  claimKey: string;
  candidates: Array<OpportunityCandidate & { identityKey: string }>;
}): Promise<boolean> {
  if (input.candidates.length > 50)
    throw new Error("A detection run may persist at most 50 opportunities.");
  if (
    new Set(input.candidates.map((candidate) => candidate.identityKey)).size !==
    input.candidates.length
  )
    throw new Error("Duplicate opportunity identities in a detection run.");
  const { run, claimKey, candidates } = input;
  const completionToken = crypto.randomUUID();
  const finishedAt = run.finishedAt ?? new Date().toISOString();
  await runBatch((tx) => {
    const claim = and(
      eq(dataRefreshClaims.key, claimKey),
      eq(dataRefreshClaims.token, run.id),
      gt(dataRefreshClaims.nextAttemptAt, Date.now()),
      exists(
        tx
          .select({ id: projects.id })
          .from(projects)
          .where(
            and(
              eq(projects.id, run.projectId),
              eq(projects.organizationId, dataRefreshClaims.organizationId),
              isNull(projects.archivedAt),
            ),
          ),
      ),
    );
    const property = and(
      eq(gscConnections.projectId, run.projectId),
      eq(gscConnections.siteUrl, run.siteUrl),
    );
    const accepted = exists(
      tx
        .select({ id: opportunityRuns.id })
        .from(opportunityRuns)
        .where(
          and(
            eq(opportunityRuns.projectId, run.projectId),
            eq(opportunityRuns.id, run.id),
            eq(opportunityRuns.completionToken, completionToken),
          ),
        ),
    );
    const statements: Promise<unknown>[] = [
      // Lock the lease and selected property on Postgres so a replacement owner
      // or property switch cannot slip between admission and the child writes.
      tx
        .update(dataRefreshClaims)
        .set({ token: sql`${dataRefreshClaims.token}` })
        .where(claim),
      tx
        .update(gscConnections)
        .set({ siteUrl: sql`${gscConnections.siteUrl}` })
        .where(property),
      tx
        .update(opportunityRuns)
        .set({
          ...run,
          status: "completed",
          finishedAt,
          opportunityCount: candidates.length,
          error: null,
          completionToken,
        })
        .where(
          and(
            eq(opportunityRuns.projectId, run.projectId),
            eq(opportunityRuns.id, run.id),
            eq(opportunityRuns.status, "running"),
            eq(opportunityRuns.siteUrl, run.siteUrl),
            exists(
              tx
                .select({ key: dataRefreshClaims.key })
                .from(dataRefreshClaims)
                .where(claim),
            ),
            exists(
              tx
                .select({ id: gscConnections.id })
                .from(gscConnections)
                .where(property),
            ),
          ),
        ),
    ];
    for (const candidate of candidates) {
      const { current, previous, ...fields } = candidate;
      const refreshed = {
        ...fields,
        siteUrl: run.siteUrl,
        evidenceRunId: run.id,
        lastDetectedAt: finishedAt,
      };
      const row = {
        ...refreshed,
        id: crypto.randomUUID(),
        projectId: run.projectId,
        status: "discovered",
        ownerUserId: null,
        firstDetectedAt: finishedAt,
        deferredUntil: null,
        version: 1,
        lastDecisionId: null,
      } satisfies typeof opportunities.$inferSelect;
      statements.push(
        tx
          .insert(opportunities)
          .select(selectedValues(opportunities, row, accepted))
          .onConflictDoUpdate({
            target: [opportunities.projectId, opportunities.identityKey],
            // Deliberately preserve human status, owner, defer and decision history.
            set: { ...refreshed, version: sql`${opportunities.version} + 1` },
          }),
      );
      const opportunityId = sql<string>`(select ${opportunities.id} from ${opportunities} where ${opportunities.projectId} = ${run.projectId} and ${opportunities.identityKey} = ${candidate.identityKey})`;
      for (const period of ["current", "previous"] as const) {
        const metrics = period === "current" ? current : previous;
        if (!metrics) continue;
        statements.push(
          tx.insert(opportunityEvidence).select(
            selectedValues(
              opportunityEvidence,
              {
                id: crypto.randomUUID(),
                projectId: run.projectId,
                opportunityId,
                runId: run.id,
                source: "google_search_console",
                period,
                startDate:
                  period === "current" ? run.startDate : run.previousStartDate,
                endDate:
                  period === "current" ? run.endDate : run.previousEndDate,
                ...metrics,
              },
              accepted,
            ),
          ),
        );
      }
    }
    return statements;
  });
  const [completed] = await db
    .select({ id: opportunityRuns.id })
    .from(opportunityRuns)
    .where(
      and(
        eq(opportunityRuns.projectId, run.projectId),
        eq(opportunityRuns.id, run.id),
        eq(opportunityRuns.completionToken, completionToken),
      ),
    );
  return Boolean(completed);
}

export const OpportunityRepository = {
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
