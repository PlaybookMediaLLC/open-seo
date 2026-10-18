import type { EnsuredUserContext } from "@/middleware/ensure-user/types";
import { checkUsageCreditsDepleted } from "@/server/billing/subscription";
import { DataRefreshClaimRepository } from "@/server/features/dashboard/repositories/DataRefreshClaimRepository";
import { OpportunityRepository } from "@/server/features/opportunities/repositories/OpportunityRepository";
import { AppError } from "@/server/lib/errors";
import { isHostedServerAuthMode } from "@/server/lib/runtime-env";
import type {
  DraftAnchorInput,
  ProposalDraft,
} from "@/types/schemas/proposalDrafts";
import {
  authorizePublishing,
  type PublishingContext,
} from "./publishingAccess";
import { ProposalDraftRepository } from "./repositories/ProposalDraftRepository";

// RFC-0004: the gate every model draft passes before it spends credits.
export type DraftContext = PublishingContext &
  Pick<EnsuredUserContext, "userEmail">;
const PER_OPPORTUNITY_PER_DAY = 3;
const PER_PROJECT_PER_DAY = 30;
const WRITE_YOURSELF: Record<ProposalDraft["kind"], string> = {
  meta_description: "description",
  meta_title: "title",
  internal_link_anchor: "link",
  page_copy: "text",
  alt_text: "alt text",
};

/** Manage permission, an approved and unchanged item, the limits, credits. */
export async function admitDraft(
  context: DraftContext,
  input: DraftAnchorInput,
  kind: ProposalDraft["kind"],
) {
  await authorizePublishing(context, input.projectId, true);
  const detail = await OpportunityRepository.getDetail(
    input.projectId,
    input.opportunityId,
  );
  if (!detail) throw new AppError("NOT_FOUND");
  const { opportunity } = detail;
  if (kind === "internal_link_anchor" && opportunity.type !== "internal_link")
    throw new AppError(
      "VALIDATION_ERROR",
      "Relay drafts anchors for internal-link opportunities only.",
    );
  if (opportunity.status !== "approved")
    throw new AppError(
      "VALIDATION_ERROR",
      "Approve the opportunity before you draft for it.",
    );
  if (opportunity.version !== input.expectedOpportunityVersion)
    throw new AppError("CONFLICT", "The opportunity changed. Reload it.");
  const used = await ProposalDraftRepository.countSince(
    input.projectId,
    opportunity.id,
    new Date(Date.now() - 86_400_000).toISOString(),
    kind,
  );
  if (used.opportunity >= PER_OPPORTUNITY_PER_DAY)
    throw new AppError(
      "RATE_LIMITED",
      `This opportunity had ${PER_OPPORTUNITY_PER_DAY} drafts of this kind in the last 24 hours. Edit one of them, or try again tomorrow.`,
    );
  if (used.project >= PER_PROJECT_PER_DAY)
    throw new AppError(
      "RATE_LIMITED",
      `This project had ${PER_PROJECT_PER_DAY} drafts in the last 24 hours. Try again tomorrow.`,
    );
  const customer = {
    organizationId: context.organizationId,
    userId: context.userId,
    userEmail: context.userEmail,
    projectId: input.projectId,
  };
  // The per-project lease of one draft at a time bounds the small overdraft
  // race of checking before and billing after; the RFC-0009 hold in
  // generateChecked is the atomic check.
  if (
    (await isHostedServerAuthMode()) &&
    (await checkUsageCreditsDepleted(customer)).depleted
  )
    throw new AppError(
      "INSUFFICIENT_CREDITS",
      "You need usage credits to draft with AI.",
    );
  return { detail, customer };
}

/** One model draft at a time for each project. */
export async function withDraftLease<T>(
  context: DraftContext,
  projectId: string,
  run: () => Promise<T>,
): Promise<T> {
  const key = `drafts:${projectId}`;
  const token = await DataRefreshClaimRepository.claim(
    key,
    context.organizationId,
  );
  if (!token)
    throw new AppError(
      "CONFLICT",
      "Another draft is being written for this project. Try again in a minute.",
    );
  try {
    return await run();
  } finally {
    await DataRefreshClaimRepository.finish(key, token, 0);
  }
}

export async function digest(value: unknown) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** A rejected draft keeps its record, but a person never sees its text. */
export function visible(record: ProposalDraft): ProposalDraft {
  return record.status === "rejected_by_validation"
    ? {
        ...record,
        valueAfter: "",
        rationale: `Relay could not write a safe draft. Write the ${WRITE_YOURSELF[record.kind]} yourself.`,
      }
    : record;
}
