import {
  and,
  eq,
  exists,
  getTableColumns,
  gt,
  isNull,
  sql,
  SQL,
  type Table,
} from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import {
  dataRefreshClaims,
  gscConnections,
  opportunities,
  opportunityAuditEvidence,
  opportunityEvidence,
  opportunityGa4Evidence,
  opportunityInspectionEvidence,
  opportunityLinkEvidence,
  opportunityRankEvidence,
  opportunityRuns,
  opportunityUrls,
  projects,
} from "@/db/schema";
import { shiftGa4Date } from "@/server/features/ga4/services/Ga4Dates";
import type {
  EvidencePeriod,
  OpportunityCandidate,
  OpportunityRun,
} from "@/types/schemas/opportunities";

const YEAR_DAYS = 364;

function periodDates(run: OpportunityRun, period: EvidencePeriod) {
  const previous = period === "previous" || period === "year_ago_previous";
  const shift = period.startsWith("year_ago") ? -YEAR_DAYS : 0;
  return {
    startDate: shiftGa4Date(
      previous ? run.previousStartDate : run.startDate,
      shift,
    ),
    endDate: shiftGa4Date(previous ? run.previousEndDate : run.endDate, shift),
  };
}

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

/** Publishes a run and its children in one atomic batch, or nothing. */
export async function completeRun(input: {
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
      const { evidence, urls, ga4, audit, inspection, link, rank, ...fields } =
        candidate;
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
      for (const item of evidence) {
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
                period: item.period,
                ...periodDates(run, item.period),
                ...item.metrics,
                url: item.url,
                query: item.query,
              },
              accepted,
            ),
          ),
        );
      }
      if (urls.length) {
        // Roles can swap between runs, so the latest run owns the URL list.
        statements.push(
          tx
            .delete(opportunityUrls)
            .where(
              and(
                eq(opportunityUrls.projectId, run.projectId),
                eq(opportunityUrls.opportunityId, opportunityId),
                accepted,
              ),
            ),
        );
      }
      for (const item of urls) {
        statements.push(
          tx.insert(opportunityUrls).select(
            selectedValues(
              opportunityUrls,
              {
                id: crypto.randomUUID(),
                projectId: run.projectId,
                opportunityId,
                ...item,
              },
              accepted,
            ),
          ),
        );
      }
      for (const item of ga4) {
        statements.push(
          tx.insert(opportunityGa4Evidence).select(
            selectedValues(
              opportunityGa4Evidence,
              {
                id: crypto.randomUUID(),
                projectId: run.projectId,
                opportunityId,
                runId: run.id,
                ...item,
              },
              accepted,
            ),
          ),
        );
      }
      // Phase 2 evidence: one row per kind, plus one rank row per device.
      const child = { projectId: run.projectId, opportunityId, runId: run.id };
      const singles = [
        [opportunityAuditEvidence, audit],
        [opportunityInspectionEvidence, inspection],
        [opportunityLinkEvidence, link],
        ...(rank ?? []).map((item) => [opportunityRankEvidence, item] as const),
      ] as const;
      for (const [table, item] of singles) {
        if (!item) continue;
        statements.push(
          tx
            .insert(table)
            .select(
              selectedValues(
                table,
                { id: crypto.randomUUID(), ...child, ...item },
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
