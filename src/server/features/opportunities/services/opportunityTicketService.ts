import { ProposalDraftRepository } from "@/server/features/publishing/repositories/ProposalDraftRepository";
import { AppError } from "@/server/lib/errors";
import { get, type OpportunityContext } from "./opportunityAccess";
import { opportunityTicket, TICKET_STATUSES } from "./opportunityTicket";

// RFC-0003: the ticket text for an approved item. RFC-0004 adds the latest
// checked anchor draft for an internal-link item.
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
  return opportunityTicket(
    detail,
    await ProposalDraftRepository.latestAnchor(projectId, detail.opportunity),
  );
}
