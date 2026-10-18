import {
  and,
  eq,
  exists,
  gte,
  inArray,
  isNotNull,
  isNull,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import {
  gscConnections,
  opportunities,
  opportunityProposals,
  proposalApprovals,
  proposalExecutions,
  proposalExecutionEvents,
} from "@/db/schema";
import type {
  ProposalApproval,
  ProposalExecution,
} from "@/types/schemas/publishing";
import {
  activeConnection,
  claimExists,
  lockClaim,
  latestExecutionId,
  selectedValues,
} from "./publishingSql";
import { retireExecutions } from "./retireExecutions";
import {
  auditInsert,
  type AuditInput,
} from "@/server/features/activity/auditLog";

export async function beginExecution(input: {
  execution: ProposalExecution;
  approval: ProposalApproval;
  audit?: AuditInput;
  organizationId: string;
  siteUrl: string;
  // A revert undoes a shipped change. It keeps the opportunity status, skips
  // the evidence age check, and may follow the original's succeeded execution.
  revert?: boolean;
}): Promise<boolean> {
  const {
    execution,
    approval,
    organizationId,
    siteUrl,
    revert = false,
  } = input;
  const { projectId, proposalId } = execution;
  if (
    approval.projectId !== projectId ||
    approval.proposalId !== proposalId ||
    execution.approvalId !== approval.id ||
    execution.status !== "running" ||
    execution.phase !== "validating"
  )
    return false;
  const claim = { projectId, claimToken: execution.id, organizationId };
  const eventId = crypto.randomUUID();
  const now = new Date().toISOString();
  await runBatch((tx) => {
    const proposalScope = and(
      eq(opportunityProposals.projectId, projectId),
      eq(opportunityProposals.id, proposalId),
    );
    const previous = sql`(select previous.status from ${proposalExecutions} previous where previous.project_id = ${projectId} and previous.proposal_id = ${proposalId} order by previous.started_at desc, previous.id desc limit 1)`;
    const previousId = sql`(select previous.id from ${proposalExecutions} previous where previous.project_id = ${projectId} and previous.proposal_id = ${proposalId} order by previous.started_at desc, previous.id desc limit 1)`;
    const accepted = exists(
      tx
        .select({ id: opportunities.id })
        .from(opportunities)
        .where(
          and(
            eq(opportunities.projectId, projectId),
            eq(opportunities.lastDecisionId, eventId),
          ),
        ),
    );
    const property = and(
      eq(gscConnections.projectId, projectId),
      eq(gscConnections.siteUrl, siteUrl),
    );
    return [
      lockClaim(tx, claim),
      tx
        .update(gscConnections)
        .set({ siteUrl: sql`${gscConnections.siteUrl}` })
        .where(and(property, claimExists(tx, claim))),
      // The opportunity row is the CAS gate. Its private decision fence also
      // prevents a losing approval from creating any child history records.
      tx
        .update(opportunities)
        .set({
          status: revert ? sql`${opportunities.status}` : "in_progress",
          version: sql`${opportunities.version} + 1`,
          lastDecisionId: eventId,
        })
        .where(
          and(
            eq(opportunities.projectId, projectId),
            eq(opportunities.siteUrl, siteUrl),
            revert
              ? inArray(opportunities.status, ["in_progress", "implemented"])
              : gte(
                  opportunities.lastDetectedAt,
                  new Date(Date.now() - 14 * 86400_000).toISOString(),
                ),
            claimExists(tx, claim),
            exists(
              tx
                .select({ id: gscConnections.id })
                .from(gscConnections)
                .where(property),
            ),
            exists(
              tx
                .select({ id: opportunityProposals.id })
                .from(opportunityProposals)
                .where(
                  and(
                    proposalScope,
                    eq(opportunityProposals.opportunityId, opportunities.id),
                    eq(
                      opportunityProposals.evidenceRunId,
                      opportunities.evidenceRunId,
                    ),
                    eq(opportunityProposals.changeHash, approval.changeHash),
                    activeConnection(
                      tx,
                      projectId,
                      sql`${opportunityProposals.connectionId}`,
                    ),
                    revert
                      ? isNotNull(opportunityProposals.revertsProposalId)
                      : isNull(opportunityProposals.revertsProposalId),
                    or(
                      and(
                        sql`${previous} is null`,
                        revert
                          ? undefined
                          : eq(opportunities.status, "approved"),
                        revert
                          ? undefined
                          : eq(
                              opportunities.version,
                              opportunityProposals.opportunityVersion,
                            ),
                      ),
                      and(
                        revert
                          ? undefined
                          : inArray(opportunities.status, [
                              "failed",
                              "in_progress",
                            ]),
                        sql`${previousId} = ${latestExecutionId(projectId, sql`${opportunities.id}`)}`,
                        or(
                          sql`${previous} = 'failed'`,
                          and(
                            sql`${previous} = 'running'`,
                            sql`${previousId} <> ${execution.id}`,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ),
            notExists(
              tx
                .select({ id: proposalExecutions.id })
                .from(proposalExecutions)
                .where(
                  and(
                    eq(proposalExecutions.projectId, projectId),
                    eq(proposalExecutions.id, execution.id),
                  ),
                ),
            ),
            revert
              ? sql`not exists (select 1 from ${proposalExecutions} other_execution join ${opportunityProposals} other_proposal on other_proposal.id = other_execution.proposal_id and other_proposal.project_id = other_execution.project_id where other_execution.project_id = ${projectId} and other_proposal.opportunity_id = ${opportunities.id} and ((other_execution.status = 'succeeded' and other_proposal.reverts_proposal_id is not null) or (other_execution.status = 'running' and other_execution.proposal_id <> ${proposalId})))`
              : sql`not exists (select 1 from ${proposalExecutions} other_execution join ${opportunityProposals} other_proposal on other_proposal.id = other_execution.proposal_id and other_proposal.project_id = other_execution.project_id where other_execution.project_id = ${projectId} and other_proposal.opportunity_id = ${opportunities.id} and (other_execution.status = 'succeeded' or (other_execution.status = 'running' and other_execution.proposal_id <> ${proposalId})))`,
          ),
        ),
      ...retireExecutions(tx, projectId, eventId, now, accepted),
      tx
        .insert(proposalApprovals)
        .select(selectedValues(proposalApprovals, approval, accepted)),
      tx.insert(proposalExecutions).select(
        selectedValues(
          proposalExecutions,
          {
            ...execution,
            finishedAt: null,
            error: null,
            lastEventId: eventId,
          },
          accepted,
        ),
      ),
      tx.insert(proposalExecutionEvents).select(
        selectedValues(
          proposalExecutionEvents,
          {
            id: eventId,
            projectId,
            executionId: execution.id,
            phase: "validating",
            message: "Validating approved proposal.",
            createdAt: now,
          },
          accepted,
        ),
      ),
      // RFC-0009: services pass the event; it lands only with the approval.
      ...(input.audit ? [auditInsert(tx, input.audit, accepted)] : []),
    ];
  });
  const [accepted] = await db
    .select({ id: proposalExecutionEvents.id })
    .from(proposalExecutionEvents)
    .where(
      and(
        eq(proposalExecutionEvents.projectId, projectId),
        eq(proposalExecutionEvents.id, eventId),
      ),
    );
  return Boolean(accepted);
}
