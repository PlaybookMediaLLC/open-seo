import { and, eq, exists, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import {
  opportunities,
  opportunityProposals,
  proposalExecutions,
  proposalExecutionEvents,
} from "@/db/schema";
import type { ExecutionPhase } from "@/types/schemas/publishing";
import { claimExists, lockClaim, selectedValues } from "./publishingSql";

const predecessors: Record<ExecutionPhase, ExecutionPhase[]> = {
  validating: ["validating"],
  branch_created: ["validating", "branch_created"],
  file_committed: ["validating", "branch_created", "file_committed"],
  pull_request_created: ["validating", "branch_created", "file_committed"],
  failed: ["validating", "branch_created", "file_committed"],
};

export async function checkpoint(input: {
  projectId: string;
  executionId: string;
  organizationId: string;
  phase: ExecutionPhase;
  requestCount: number;
  commitSha?: string;
  pullRequestNumber?: number;
  pullRequestUrl?: string;
  message: string;
}): Promise<boolean> {
  const { projectId, executionId, phase } = input;
  const claim = { ...input, claimToken: executionId };
  const eventId = crypto.randomUUID();
  const now = new Date().toISOString();
  const terminal = phase === "failed" || phase === "pull_request_created";
  const message = input.message
    .replace(/(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]+/g, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\p{Cc}/gu, " ")
    .slice(0, 1000);
  await runBatch((tx) => {
    const scope = and(
      eq(proposalExecutions.projectId, projectId),
      eq(proposalExecutions.id, executionId),
    );
    const accepted = exists(
      tx
        .select({ id: proposalExecutions.id })
        .from(proposalExecutions)
        .where(and(scope, eq(proposalExecutions.lastEventId, eventId))),
    );
    return [
      lockClaim(tx, claim),
      tx
        .update(proposalExecutions)
        .set({
          phase,
          status:
            phase === "failed"
              ? "failed"
              : phase === "pull_request_created"
                ? "succeeded"
                : "running",
          finishedAt: terminal ? now : null,
          requestCount: sql`case when ${proposalExecutions.requestCount} > ${input.requestCount} then ${proposalExecutions.requestCount} else ${input.requestCount} end`,
          commitSha: input.commitSha ?? sql`${proposalExecutions.commitSha}`,
          pullRequestNumber:
            input.pullRequestNumber ??
            sql`${proposalExecutions.pullRequestNumber}`,
          pullRequestUrl:
            input.pullRequestUrl ?? sql`${proposalExecutions.pullRequestUrl}`,
          error: phase === "failed" ? message : null,
          lastEventId: eventId,
        })
        .where(
          and(
            scope,
            eq(proposalExecutions.status, "running"),
            inArray(proposalExecutions.phase, predecessors[phase]),
            claimExists(tx, claim),
          ),
        ),
      tx.insert(proposalExecutionEvents).select(
        selectedValues(
          proposalExecutionEvents,
          {
            id: eventId,
            projectId,
            executionId,
            phase,
            message,
            createdAt: now,
          },
          accepted,
        ),
      ),
      // A failed revert leaves the shipped change in place, so the
      // opportunity keeps its status.
      ...(phase === "failed"
        ? [
            tx
              .update(opportunities)
              .set({
                status: "failed",
                version: sql`${opportunities.version} + 1`,
              })
              .where(
                and(
                  eq(opportunities.projectId, projectId),
                  accepted,
                  sql`exists (select 1 from ${opportunityProposals} proposal join ${proposalExecutions} execution on execution.proposal_id = proposal.id and execution.project_id = proposal.project_id where execution.project_id = ${projectId} and execution.id = ${executionId} and proposal.opportunity_id = ${opportunities.id} and proposal.reverts_proposal_id is null)`,
                ),
              ),
          ]
        : []),
    ];
  });
  const [event] = await db
    .select({ id: proposalExecutionEvents.id })
    .from(proposalExecutionEvents)
    .where(
      and(
        eq(proposalExecutionEvents.projectId, projectId),
        eq(proposalExecutionEvents.id, eventId),
      ),
    );
  return Boolean(event);
}
