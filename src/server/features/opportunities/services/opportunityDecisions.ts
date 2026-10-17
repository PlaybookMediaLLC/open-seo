import { requireOrgPermission } from "@/server/auth/org-gate";
import { GscService } from "@/server/features/gsc/services/GscService";
import { AppError } from "@/server/lib/errors";
import { AuthRepository } from "@/server/auth/repositories/AuthRepository";
import type {
  AssignOpportunityInput,
  OpportunityReviewInput,
  OpportunityStatus,
} from "@/types/schemas/opportunities";
import { OpportunityRepository } from "../repositories/OpportunityRepository";
import { authorize, get, type OpportunityContext } from "./opportunityAccess";

const DAY_MS = 86_400_000;

export async function review(
  context: OpportunityContext,
  input: OpportunityReviewInput,
) {
  await authorize(context, input.projectId);
  requireOrgPermission(context, { integration: ["manage"] });
  const detail = await OpportunityRepository.getDetail(
    input.projectId,
    input.opportunityId,
  );
  if (!detail) throw new AppError("NOT_FOUND", "Opportunity not found.");
  const opportunity = detail.opportunity;
  if (opportunity.version !== input.expectedVersion)
    throw new AppError(
      "CONFLICT",
      "Opportunity changed. Reload before reviewing.",
    );
  const allowed: Record<
    OpportunityReviewInput["decision"],
    OpportunityStatus[]
  > = {
    reviewed: ["discovered", "reviewed", "approved", "rejected"],
    approved: ["reviewed"],
    rejected: ["discovered", "reviewed"],
    deferred: ["discovered", "reviewed"],
  };
  if (input.deferDays !== undefined && input.decision !== "deferred")
    throw new AppError(
      "VALIDATION_ERROR",
      "A defer length applies only to a defer decision.",
    );
  if (!allowed[input.decision].includes(opportunity.status)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "This review transition is not allowed.",
    );
  }
  if (input.decision === "approved") {
    const reviewedCurrentEvidence = detail.decisions.some(
      (decision) =>
        decision.decision === "reviewed" &&
        decision.evidenceRunId === opportunity.evidenceRunId,
    );
    if (!reviewedCurrentEvidence)
      throw new AppError(
        "CONFLICT",
        "Review the current evidence before approving proposal preparation.",
      );
    const connection = await GscService.getConnection(input.projectId);
    if (
      connection?.siteUrl !== opportunity.siteUrl ||
      Date.now() - Date.parse(opportunity.lastDetectedAt) > 14 * DAY_MS
    ) {
      throw new AppError(
        "CONFLICT",
        "Reconnect and refresh evidence before approving proposal preparation.",
      );
    }
  }
  const { deferDays = 7, ...decision } = input;
  const changed = await OpportunityRepository.review({
    ...decision,
    actorUserId: context.userId,
    fromStatus: opportunity.status,
    toStatus:
      input.decision === "deferred" ? opportunity.status : input.decision,
    deferredUntil:
      input.decision === "deferred"
        ? new Date(Date.now() + deferDays * DAY_MS).toISOString()
        : null,
  });
  if (!changed)
    throw new AppError(
      "CONFLICT",
      "Opportunity changed. Reload before reviewing.",
    );
  return get(context, input.projectId, input.opportunityId);
}

/**
 * RFC-0003 5.1: one member owns an opportunity. The owner must belong to the
 * project's organization; the client's member list is not trusted.
 */
export async function assign(
  context: OpportunityContext,
  input: AssignOpportunityInput,
) {
  await authorize(context, input.projectId);
  requireOrgPermission(context, { integration: ["manage"] });
  const detail = await get(context, input.projectId, input.opportunityId);
  const opportunity = detail.opportunity;
  if (opportunity.version !== input.expectedVersion)
    throw new AppError(
      "CONFLICT",
      "Opportunity changed. Reload before assigning.",
    );
  if (opportunity.ownerUserId === input.ownerUserId) return detail;
  let note = "Unassigned";
  if (input.ownerUserId) {
    const membership = await AuthRepository.getMembership(
      input.ownerUserId,
      context.organizationId,
    );
    if (!membership)
      throw new AppError(
        "VALIDATION_ERROR",
        "The owner must be a member of this organization.",
      );
    const [owner] = await AuthRepository.getHostedUserNames([
      input.ownerUserId,
    ]);
    note = `Assigned to ${owner?.name || "a team member"}`;
  }
  const changed = await OpportunityRepository.review({
    projectId: input.projectId,
    opportunityId: input.opportunityId,
    expectedVersion: input.expectedVersion,
    actorUserId: context.userId,
    decision: "assigned",
    ownerUserId: input.ownerUserId,
    note,
    fromStatus: opportunity.status,
    toStatus: opportunity.status,
    deferredUntil: null,
  });
  if (!changed)
    throw new AppError(
      "CONFLICT",
      "Opportunity changed. Reload before assigning.",
    );
  return get(context, input.projectId, input.opportunityId);
}

/** RFC-0003 5.6: the ticket of an approved opportunity, for a person to copy. */
