import { GscService } from "@/server/features/gsc/services/GscService";
import { OpportunityRepository } from "@/server/features/opportunities/repositories/OpportunityRepository";
import { AppError } from "@/server/lib/errors";

/**
 * A change may be prepared only for an approved opportunity: approved on its
 * current evidence, at the version the person saw, on the connected Search
 * Console property, and found in the last 14 days.
 */
export async function proposableOpportunity(input: {
  projectId: string;
  opportunityId: string;
  expectedOpportunityVersion: number;
}) {
  const detail = await OpportunityRepository.getDetail(
    input.projectId,
    input.opportunityId,
  );
  if (!detail) throw new AppError("NOT_FOUND");
  const opportunity = detail.opportunity;
  const gsc = await GscService.getConnection(input.projectId);
  if (
    opportunity.status !== "approved" ||
    !detail.decisions.some(
      (decision) =>
        decision.decision === "approved" &&
        decision.evidenceRunId === opportunity.evidenceRunId,
    ) ||
    opportunity.version !== input.expectedOpportunityVersion ||
    gsc?.siteUrl !== opportunity.siteUrl ||
    Date.now() - Date.parse(opportunity.lastDetectedAt) > 14 * 86_400_000
  )
    throw new AppError("CONFLICT");
  return opportunity;
}
