import { and, eq, ne, sql, type SQL } from "drizzle-orm";
import {
  opportunities,
  opportunityProposals,
  proposalExecutions,
  proposalExecutionEvents,
} from "@/db/schema";
import type { Executor } from "./publishingSql";

export function retireExecutions(
  tx: Executor,
  projectId: string,
  eventId: string,
  now: string,
  accepted: SQL,
) {
  const message =
    "Execution abandoned after its publishing lease was replaced.";
  const retired = and(
    eq(proposalExecutions.projectId, projectId),
    eq(proposalExecutions.lastEventId, eventId),
  );
  return [
    tx
      .update(proposalExecutions)
      .set({
        status: "failed",
        phase: "failed",
        error: message,
        finishedAt: now,
        lastEventId: eventId,
      })
      .where(
        and(
          eq(proposalExecutions.projectId, projectId),
          eq(proposalExecutions.status, "running"),
          accepted,
        ),
      ),
    tx.insert(proposalExecutionEvents).select(
      tx
        .select({
          id: sql<string>`${eventId} || ':' || ${proposalExecutions.id}`.as(
            "id",
          ),
          projectId: proposalExecutions.projectId,
          executionId: proposalExecutions.id,
          phase: sql<"failed">`'failed'`.as("phase"),
          message: sql<string>`${message}`.as("message"),
          createdAt: sql<string>`${now}`.as("created_at"),
        })
        .from(proposalExecutions)
        .where(retired),
    ),
    tx
      .update(opportunities)
      .set({ status: "failed", version: sql`${opportunities.version} + 1` })
      .where(
        and(
          eq(opportunities.projectId, projectId),
          eq(opportunities.status, "in_progress"),
          ne(opportunities.lastDecisionId, eventId),
          sql`exists (select 1 from ${proposalExecutions} retired join ${opportunityProposals} proposal on proposal.id = retired.proposal_id and proposal.project_id = retired.project_id where retired.project_id = ${projectId} and retired.last_event_id = ${eventId} and proposal.opportunity_id = ${opportunities.id})`,
        ),
      ),
  ];
}
