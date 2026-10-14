import { and, eq, exists, sql } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import {
  opportunities,
  opportunityDecisions,
  opportunityProposals,
  proposalExecutions,
} from "@/db/schema";
import type { ProposalWithHistory } from "@/types/schemas/publishing";
import { getProposal } from "./publishingProposals";
import { claimExists, latestExecutionId, lockClaim } from "./publishingSql";

export async function getLatestExecution(
  projectId: string,
  opportunityId: string,
): Promise<ProposalWithHistory | null> {
  const [execution] = await db
    .select({ proposalId: proposalExecutions.proposalId })
    .from(proposalExecutions)
    .where(
      and(
        eq(proposalExecutions.projectId, projectId),
        eq(proposalExecutions.id, latestExecutionId(projectId, opportunityId)),
      ),
    );
  return execution ? getProposal(projectId, execution.proposalId) : null;
}

// The service first verifies the repository/base and absence of an open or
// merged PR using the current authorized connection. This CAS records that
// explicit re-review, never silently turning a failed attempt into approval.
export async function recoverOpportunity(input: {
  projectId: string;
  opportunityId: string;
  expectedVersion: number;
  executionId: string;
  actorUserId: string;
  organizationId: string;
  claimToken: string;
}): Promise<boolean> {
  const decisionId = crypto.randomUUID();
  const note =
    "Re-reviewed after a failed GitHub attempt. No open or merged pull request was found for that attempt. A proposal branch may remain.";
  await runBatch((tx) => {
    const scope = and(
      eq(opportunities.projectId, input.projectId),
      eq(opportunities.id, input.opportunityId),
    );
    return [
      lockClaim(tx, input),
      tx
        .update(opportunities)
        .set({
          status: "reviewed",
          version: sql`${opportunities.version} + 1`,
          lastDecisionId: decisionId,
        })
        .where(
          and(
            scope,
            eq(opportunities.status, "failed"),
            eq(opportunities.version, input.expectedVersion),
            claimExists(tx, input),
            eq(
              latestExecutionId(input.projectId, input.opportunityId),
              input.executionId,
            ),
            exists(
              tx
                .select({ id: proposalExecutions.id })
                .from(proposalExecutions)
                .where(
                  and(
                    eq(proposalExecutions.projectId, input.projectId),
                    eq(proposalExecutions.id, input.executionId),
                    eq(proposalExecutions.status, "failed"),
                  ),
                ),
            ),
            sql`not exists (select 1 from ${proposalExecutions} execution join ${opportunityProposals} proposal on proposal.id = execution.proposal_id and proposal.project_id = execution.project_id where execution.project_id = ${input.projectId} and proposal.opportunity_id = ${input.opportunityId} and execution.status in ('running', 'succeeded'))`,
          ),
        ),
      tx.insert(opportunityDecisions).select(
        tx
          .select({
            id: sql<string>`${decisionId}`.as("id"),
            projectId: opportunities.projectId,
            opportunityId: opportunities.id,
            evidenceRunId: opportunities.evidenceRunId,
            actorUserId: sql<string>`${input.actorUserId}`.as("actor_user_id"),
            decision: sql<"reviewed">`'reviewed'`.as("decision"),
            fromStatus: sql<"failed">`'failed'`.as("from_status"),
            toStatus: sql<"reviewed">`'reviewed'`.as("to_status"),
            note: sql<string>`${note}`.as("note"),
            createdAt: sql<string>`${new Date().toISOString()}`.as(
              "created_at",
            ),
          })
          .from(opportunities)
          .where(and(scope, eq(opportunities.lastDecisionId, decisionId))),
      ),
    ];
  });
  const [decision] = await db
    .select({ id: opportunityDecisions.id })
    .from(opportunityDecisions)
    .where(
      and(
        eq(opportunityDecisions.projectId, input.projectId),
        eq(opportunityDecisions.id, decisionId),
      ),
    );
  return Boolean(decision);
}
