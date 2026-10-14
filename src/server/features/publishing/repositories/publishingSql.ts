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
import type { runBatch } from "@/db/runBatch";
import {
  dataRefreshClaims,
  projects,
  opportunityProposals,
  proposalExecutions,
  publishingConnections,
} from "@/db/schema";

export type Executor = Parameters<Parameters<typeof runBatch>[0]>[0];
export type ClaimScope = {
  projectId: string;
  claimToken: string;
  organizationId: string;
};

export function latestExecutionId(
  projectId: string,
  opportunityId: string | SQL,
) {
  return sql`(select latest.id from ${proposalExecutions} latest join ${opportunityProposals} proposal on proposal.id = latest.proposal_id and proposal.project_id = latest.project_id where latest.project_id = ${projectId} and proposal.opportunity_id = ${opportunityId} order by latest.started_at desc, latest.id desc limit 1)`;
}

function claimCondition(tx: Executor, input: ClaimScope) {
  return and(
    eq(dataRefreshClaims.key, `publishing:${input.projectId}`),
    eq(dataRefreshClaims.token, input.claimToken),
    eq(dataRefreshClaims.organizationId, input.organizationId),
    gt(dataRefreshClaims.nextAttemptAt, Date.now()),
    exists(
      tx
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            eq(projects.id, input.projectId),
            eq(projects.organizationId, input.organizationId),
            isNull(projects.archivedAt),
          ),
        ),
    ),
  );
}

export function claimExists(tx: Executor, input: ClaimScope) {
  return exists(
    tx
      .select({ key: dataRefreshClaims.key })
      .from(dataRefreshClaims)
      .where(claimCondition(tx, input)),
  );
}

export function lockClaim(tx: Executor, input: ClaimScope) {
  return tx
    .update(dataRefreshClaims)
    .set({ token: sql`${dataRefreshClaims.token}` })
    .where(claimCondition(tx, input));
}

export function activeConnection(
  tx: Executor,
  projectId: string,
  connectionId: string | SQL,
) {
  return exists(
    tx
      .select({ id: publishingConnections.id })
      .from(publishingConnections)
      .where(
        and(
          eq(publishingConnections.projectId, projectId),
          eq(publishingConnections.id, connectionId),
          isNull(publishingConnections.revokedAt),
        ),
      ),
  );
}

// Keep conditional writes inside the D1 batch / PG transaction, preserving each
// column's dialect encoder. Every field is explicit, including private fences.
export function selectedValues(
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
