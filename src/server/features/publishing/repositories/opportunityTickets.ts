import { and, eq, exists, isNull } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import { opportunities, opportunityTickets } from "@/db/schema";
import type { OpportunityTicket } from "@/types/schemas/publishing";
import {
  activeConnection,
  claimExists,
  lockClaim,
  selectedValues,
  type ClaimScope,
} from "./publishingSql";
import {
  auditInsert,
  type AuditInput,
} from "@/server/features/activity/auditLog";

// Stores the approval before the GitHub call. The unique text hash per
// opportunity returns the first row on a repeat, so one approval makes one issue.
export async function claimTicket(
  input: ClaimScope & { ticket: OpportunityTicket; audit: AuditInput },
): Promise<OpportunityTicket | null> {
  const { ticket } = input;
  await runBatch((tx) => [
    lockClaim(tx, input),
    tx
      .insert(opportunityTickets)
      .select(
        selectedValues(
          opportunityTickets,
          ticket,
          // oxlint-disable-next-line typescript/no-non-null-assertion -- and() is undefined only when every condition is, and claimExists() always returns SQL
          and(
            claimExists(tx, input),
            activeConnection(tx, ticket.projectId, ticket.connectionId),
            exists(
              tx
                .select({ id: opportunities.id })
                .from(opportunities)
                .where(
                  and(
                    eq(opportunities.projectId, ticket.projectId),
                    eq(opportunities.id, ticket.opportunityId),
                  ),
                ),
            ),
          )!,
        ),
      )
      .onConflictDoNothing(),
    // Only a new ticket, not the first row of a repeat, is an event.
    auditInsert(
      tx,
      input.audit,
      exists(
        tx
          .select({ id: opportunityTickets.id })
          .from(opportunityTickets)
          .where(
            and(
              eq(opportunityTickets.projectId, ticket.projectId),
              eq(opportunityTickets.id, ticket.id),
            ),
          ),
      ),
    ),
  ]);
  const [row] = await db
    .select()
    .from(opportunityTickets)
    .where(
      and(
        eq(opportunityTickets.projectId, ticket.projectId),
        eq(opportunityTickets.opportunityId, ticket.opportunityId),
        eq(opportunityTickets.textHash, ticket.textHash),
      ),
    );
  return row ?? null;
}

export async function completeTicket(
  input: ClaimScope & { id: string; issueNumber: number; issueUrl: string },
): Promise<boolean> {
  await runBatch((tx) => [
    lockClaim(tx, input),
    tx
      .update(opportunityTickets)
      .set({ issueNumber: input.issueNumber, issueUrl: input.issueUrl })
      .where(
        and(
          eq(opportunityTickets.projectId, input.projectId),
          eq(opportunityTickets.id, input.id),
          isNull(opportunityTickets.issueNumber),
          claimExists(tx, input),
        ),
      ),
  ]);
  const [row] = await db
    .select({ issueNumber: opportunityTickets.issueNumber })
    .from(opportunityTickets)
    .where(
      and(
        eq(opportunityTickets.projectId, input.projectId),
        eq(opportunityTickets.id, input.id),
      ),
    );
  return row?.issueNumber === input.issueNumber;
}

export async function getTicket(
  projectId: string,
  opportunityId: string,
  textHash: string,
): Promise<OpportunityTicket | null> {
  const [row] = await db
    .select()
    .from(opportunityTickets)
    .where(
      and(
        eq(opportunityTickets.projectId, projectId),
        eq(opportunityTickets.opportunityId, opportunityId),
        eq(opportunityTickets.textHash, textHash),
      ),
    );
  return row ?? null;
}
