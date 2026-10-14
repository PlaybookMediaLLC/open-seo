import { and, desc, eq, exists, getTableColumns, sql } from "drizzle-orm";
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
} from "@/db/schema";
import type {
  MetadataProposal,
  ProposalWithHistory,
} from "@/types/schemas/publishing";
import {
  activeConnection,
  claimExists,
  lockClaim,
  selectedValues,
} from "./publishingSql";

const {
  encryptedToken: _encryptedToken,
  lastEventId: _connectionFence,
  ...publicConnection
} = getTableColumns(publishingConnections);
const { lastEventId: _executionFence, ...publicExecution } =
  getTableColumns(proposalExecutions);

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
  const [approvals, executions, events] = await Promise.all([
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
  ]);
  return { proposal, connection, approvals, executions, events };
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

export async function saveProposal(input: {
  proposal: MetadataProposal;
  claimToken: string;
  organizationId: string;
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
      tx.insert(opportunityProposals).select(
        selectedValues(
          opportunityProposals,
          proposal,
          and(
            claimExists(tx, scope),
            activeConnection(tx, proposal.projectId, proposal.connectionId),
            exists(
              tx
                .select({ id: opportunityDecisions.id })
                .from(opportunityDecisions)
                .where(
                  and(
                    eq(opportunityDecisions.projectId, proposal.projectId),
                    eq(
                      opportunityDecisions.opportunityId,
                      proposal.opportunityId,
                    ),
                    eq(
                      opportunityDecisions.evidenceRunId,
                      proposal.evidenceRunId,
                    ),
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
          )!,
        ),
      ),
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
