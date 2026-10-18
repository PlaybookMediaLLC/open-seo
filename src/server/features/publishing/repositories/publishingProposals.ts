import {
  and,
  desc,
  eq,
  exists,
  getTableColumns,
  inArray,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import {
  opportunities,
  opportunityDecisions,
  opportunityProposals,
  proposalApprovals,
  proposalExecutions,
  proposalExecutionEvents,
  publishingConnections,
  proposalDrafts,
  proposalTextEdits,
} from "@/db/schema";
import type {
  MetadataProposal,
  ProposalTextEdit,
  ProposalWithHistory,
} from "@/types/schemas/publishing";
import {
  activeConnection,
  claimExists,
  lockClaim,
  selectedValues,
  type Executor,
} from "./publishingSql";
import {
  auditInsert,
  type AuditInput,
} from "@/server/features/activity/auditLog";

const {
  encryptedToken: _encryptedToken,
  lastEventId: _connectionFence,
  ...publicConnection
} = getTableColumns(publishingConnections);
const { lastEventId: _executionFence, ...publicExecution } =
  getTableColumns(proposalExecutions);
const {
  id: _editId,
  projectId: _editProjectId,
  proposalId: _editProposalId,
  ...textEditColumns
} = getTableColumns(proposalTextEdits);

async function history(
  proposal: MetadataProposal,
): Promise<ProposalWithHistory | null> {
  const { projectId, id } = proposal;
  const [connection] = await db
    .select(publicConnection)
    .from(publishingConnections)
    .where(
      and(
        eq(publishingConnections.projectId, projectId),
        eq(publishingConnections.id, proposal.connectionId),
      ),
    );
  if (!connection) return null;
  const [approvals, executions, events, textEdits] = await Promise.all([
    db
      .select()
      .from(proposalApprovals)
      .where(
        and(
          eq(proposalApprovals.projectId, projectId),
          eq(proposalApprovals.proposalId, id),
        ),
      )
      .orderBy(desc(proposalApprovals.createdAt), desc(proposalApprovals.id))
      .limit(100),
    db
      .select(publicExecution)
      .from(proposalExecutions)
      .where(
        and(
          eq(proposalExecutions.projectId, projectId),
          eq(proposalExecutions.proposalId, id),
        ),
      )
      .orderBy(desc(proposalExecutions.startedAt), desc(proposalExecutions.id))
      .limit(100),
    db
      .select(getTableColumns(proposalExecutionEvents))
      .from(proposalExecutionEvents)
      .innerJoin(
        proposalExecutions,
        and(
          eq(proposalExecutions.id, proposalExecutionEvents.executionId),
          eq(proposalExecutions.projectId, proposalExecutionEvents.projectId),
        ),
      )
      .where(
        and(
          eq(proposalExecutionEvents.projectId, projectId),
          eq(proposalExecutions.proposalId, id),
        ),
      )
      .orderBy(
        desc(proposalExecutionEvents.createdAt),
        desc(proposalExecutionEvents.id),
      )
      .limit(100),
    // RFC-0012 5.4: the edits of a copy change; none for metadata.
    db
      .select(textEditColumns)
      .from(proposalTextEdits)
      .where(
        and(
          eq(proposalTextEdits.projectId, projectId),
          eq(proposalTextEdits.proposalId, id),
        ),
      )
      .orderBy(proposalTextEdits.ordinal),
  ]);
  return { proposal, connection, approvals, executions, events, textEdits };
}

export async function listProposals(
  projectId: string,
  opportunityId: string,
): Promise<ProposalWithHistory[]> {
  const rows = await db
    .select()
    .from(opportunityProposals)
    .where(
      and(
        eq(opportunityProposals.projectId, projectId),
        eq(opportunityProposals.opportunityId, opportunityId),
      ),
    )
    .orderBy(
      desc(opportunityProposals.createdAt),
      desc(opportunityProposals.id),
    )
    .limit(20);
  const results = await Promise.all(rows.map(history));
  return results.filter((row) => row !== null);
}

export async function getProposal(
  projectId: string,
  proposalId: string,
): Promise<ProposalWithHistory | null> {
  const [proposal] = await db
    .select()
    .from(opportunityProposals)
    .where(
      and(
        eq(opportunityProposals.projectId, projectId),
        eq(opportunityProposals.id, proposalId),
      ),
    )
    .limit(1);
  return proposal ? history(proposal) : null;
}

// A new change needs the current evidence approved and the opportunity
// approved at the proposal's version.
function approvalEligible(tx: Executor, proposal: MetadataProposal) {
  const opportunity = and(
    eq(opportunities.projectId, proposal.projectId),
    eq(opportunities.id, proposal.opportunityId),
  );
  return and(
    exists(
      tx
        .select({ id: opportunityDecisions.id })
        .from(opportunityDecisions)
        .where(
          and(
            eq(opportunityDecisions.projectId, proposal.projectId),
            eq(opportunityDecisions.opportunityId, proposal.opportunityId),
            eq(opportunityDecisions.evidenceRunId, proposal.evidenceRunId),
            eq(opportunityDecisions.decision, "approved"),
          ),
        ),
    ),
    exists(
      tx
        .select({ id: opportunities.id })
        .from(opportunities)
        .where(
          and(
            opportunity,
            eq(opportunities.status, "approved"),
            eq(opportunities.version, proposal.opportunityVersion),
            eq(opportunities.evidenceRunId, proposal.evidenceRunId),
          ),
        ),
    ),
  );
}

// A revert needs the reverted proposal on the same opportunity, with a
// succeeded pull request, and the opportunity still implemented or in progress.
function revertEligible(tx: Executor, proposal: MetadataProposal) {
  return and(
    sql`exists (select 1 from ${opportunityProposals} reverted join ${proposalExecutions} execution on execution.proposal_id = reverted.id and execution.project_id = reverted.project_id where reverted.project_id = ${proposal.projectId} and reverted.id = ${proposal.revertsProposalId} and reverted.opportunity_id = ${proposal.opportunityId} and reverted.reverts_proposal_id is null and execution.status = 'succeeded')`,
    exists(
      tx
        .select({ id: opportunities.id })
        .from(opportunities)
        .where(
          and(
            eq(opportunities.projectId, proposal.projectId),
            eq(opportunities.id, proposal.opportunityId),
            inArray(opportunities.status, ["in_progress", "implemented"]),
            eq(opportunities.version, proposal.opportunityVersion),
            eq(opportunities.evidenceRunId, proposal.evidenceRunId),
          ),
        ),
    ),
  );
}

export async function saveProposal(input: {
  proposal: MetadataProposal;
  /** RFC-0012 5.4: a copy change's edits, saved only with the proposal. */
  textEdits?: ProposalTextEdit[];
  claimToken: string;
  organizationId: string;
  audit?: AuditInput;
}): Promise<boolean> {
  const { proposal } = input;
  const scope = { ...input, projectId: proposal.projectId };
  await runBatch((tx) => {
    const opportunity = and(
      eq(opportunities.projectId, proposal.projectId),
      eq(opportunities.id, proposal.opportunityId),
    );
    return [
      lockClaim(tx, scope),
      tx
        .update(opportunities)
        .set({ version: sql`${opportunities.version}` })
        .where(and(opportunity, claimExists(tx, scope))),
      tx
        .insert(opportunityProposals)
        .select(
          selectedValues(
            opportunityProposals,
            proposal,
            and(
              claimExists(tx, scope),
              activeConnection(tx, proposal.projectId, proposal.connectionId),
              proposal.revertsProposalId
                ? revertEligible(tx, proposal)
                : approvalEligible(tx, proposal),
            )!,
          ),
        ),
      // RFC-0004: a draft becomes "used" only with the proposal that used it.
      ...(proposal.draftId
        ? [
            tx
              .update(proposalDrafts)
              .set({ status: "used" })
              .where(
                and(
                  eq(proposalDrafts.projectId, proposal.projectId),
                  eq(proposalDrafts.id, proposal.draftId),
                  eq(proposalDrafts.opportunityId, proposal.opportunityId),
                  exists(
                    tx
                      .select({ id: opportunityProposals.id })
                      .from(opportunityProposals)
                      .where(eq(opportunityProposals.id, proposal.id)),
                  ),
                ),
              ),
          ]
        : []),
      ...(input.textEdits ?? []).map((edit) =>
        tx.insert(proposalTextEdits).select(
          selectedValues(
            proposalTextEdits,
            {
              id: crypto.randomUUID(),
              projectId: proposal.projectId,
              proposalId: proposal.id,
              ...edit,
            },
            exists(
              tx
                .select({ id: opportunityProposals.id })
                .from(opportunityProposals)
                .where(eq(opportunityProposals.id, proposal.id)),
            ),
          ),
        ),
      ),
      // RFC-0009: services pass the event; it lands only with the proposal.
      ...(input.audit
        ? [
            auditInsert(
              tx,
              input.audit,
              exists(
                tx
                  .select({ id: opportunityProposals.id })
                  .from(opportunityProposals)
                  .where(eq(opportunityProposals.id, proposal.id)),
              ),
            ),
          ]
        : []),
    ];
  });
  const [saved] = await db
    .select({ id: opportunityProposals.id })
    .from(opportunityProposals)
    .where(
      and(
        eq(opportunityProposals.projectId, proposal.projectId),
        eq(opportunityProposals.id, proposal.id),
      ),
    );
  return Boolean(saved);
}
