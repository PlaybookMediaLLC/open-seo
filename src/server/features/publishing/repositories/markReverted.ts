import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import { opportunities, opportunityDecisions } from "@/db/schema";
import type {
  OpportunityDecision,
  OpportunityStatus,
} from "@/types/schemas/opportunities";
import { claimExists, lockClaim, type ClaimScope } from "./publishingSql";

// After a confirmed revert deployment, the opportunity becomes "reverted" and
// a decision row records who confirmed it (RFC-0005 5.6).
export async function markReverted(
  input: ClaimScope & {
    opportunityId: string;
    revertProposalId: string;
    expectedVersion: number;
    fromStatus: OpportunityStatus;
    actorUserId: string;
    note: string;
  },
): Promise<boolean> {
  const decisionId = crypto.randomUUID();
  const scope = and(
    eq(opportunities.projectId, input.projectId),
    eq(opportunities.id, input.opportunityId),
  );
  await runBatch((tx) => [
    lockClaim(tx, input),
    tx
      .update(opportunities)
      .set({
        status: "reverted",
        version: sql`${opportunities.version} + 1`,
        lastDecisionId: decisionId,
      })
      .where(
        and(
          scope,
          eq(opportunities.version, input.expectedVersion),
          eq(opportunities.status, input.fromStatus),
          claimExists(tx, input),
          sql`exists (select 1 from opportunity_proposals revert join proposal_executions execution on execution.proposal_id = revert.id and execution.project_id = revert.project_id where revert.project_id = ${input.projectId} and revert.id = ${input.revertProposalId} and revert.opportunity_id = ${input.opportunityId} and revert.reverts_proposal_id is not null and execution.status = 'succeeded')`,
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
          decision: sql<OpportunityDecision["decision"]>`${"reverted"}`.as(
            "decision",
          ),
          fromStatus: sql<OpportunityStatus>`${input.fromStatus}`.as(
            "from_status",
          ),
          toStatus: sql<OpportunityStatus>`${"reverted"}`.as("to_status"),
          note: sql<string>`${input.note}`.as("note"),
          createdAt: sql<string>`${new Date().toISOString()}`.as("created_at"),
        })
        .from(opportunities)
        .where(and(scope, eq(opportunities.lastDecisionId, decisionId))),
    ),
  ]);
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
