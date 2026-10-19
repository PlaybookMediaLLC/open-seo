import { accessibilityTicketFacts } from "@/server/features/accessibility/accessibilityTicket";
import { ProposalDraftRepository } from "@/server/features/publishing/repositories/ProposalDraftRepository";
import { AppError } from "@/server/lib/errors";
import type { OpportunityDetail } from "@/types/schemas/opportunities";
import { get, type OpportunityContext } from "./opportunityAccess";
import { opportunityTicket, TICKET_STATUSES } from "./opportunityTicket";

/**
 * The ticket text with its stored extras: the latest checked anchor draft
 * (RFC-0004) and the accessibility facts (RFC-0013). Every caller uses this,
 * so a previewed ticket and the created issue have the same text.
 */
export async function ticketText(projectId: string, detail: OpportunityDetail) {
  const evidence = detail.accessibilityEvidence.find(
    (row) => row.runId === detail.opportunity.evidenceRunId,
  );
  return opportunityTicket(
    detail,
    await ProposalDraftRepository.latestAnchor(projectId, detail.opportunity),
    evidence ? await accessibilityTicketFacts(projectId, evidence) : null,
  );
}

// RFC-0003: the ticket text for an approved item.
export async function getTicket(
  context: OpportunityContext,
  projectId: string,
  opportunityId: string,
) {
  const detail = await get(context, projectId, opportunityId);
  if (!TICKET_STATUSES.includes(detail.opportunity.status))
    throw new AppError(
      "VALIDATION_ERROR",
      "Approve the opportunity before you create a ticket.",
    );
  return ticketText(projectId, detail);
}
