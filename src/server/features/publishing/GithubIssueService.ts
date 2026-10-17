import { OpportunityRepository } from "@/server/features/opportunities/repositories/OpportunityRepository";
import { AppError } from "@/server/lib/errors";
import {
  opportunityTicket,
  TICKET_STATUSES,
} from "@/server/features/opportunities/services/opportunityTicket";
import {
  createIssueInputSchema,
  publishingOpportunityInputSchema,
  type CreateIssueInput,
} from "@/types/schemas/publishing";
import {
  authorizePublishing,
  connectedGithub,
  publishingFailure,
  withPublishingClaim,
  type PublishingContext,
} from "./publishingAccess";
import { ProposalDraftRepository } from "./repositories/ProposalDraftRepository";
import { PublishingRepository } from "./repositories/PublishingRepository";

// RFC-0005 5.10: a GitHub issue from an approved opportunity, created only
// after the person approves the exact text. The text is the RFC-0003 ticket.
async function textHash(text: { title: string; body: string }) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify([text.title, text.body])),
  );
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function eligibleDetail(projectId: string, opportunityId: string) {
  const detail = await OpportunityRepository.getDetail(
    projectId,
    opportunityId,
  );
  if (!detail) throw new AppError("NOT_FOUND");
  return TICKET_STATUSES.includes(detail.opportunity.status) ? detail : null;
}

async function preview(
  context: PublishingContext,
  raw: { projectId: string; opportunityId: string },
) {
  await authorizePublishing(context, raw.projectId);
  const input = publishingOpportunityInputSchema.parse(raw);
  const detail = await eligibleDetail(input.projectId, input.opportunityId);
  if (!detail) return null;
  const text = opportunityTicket(
    detail,
    await ProposalDraftRepository.latestAnchor(
      input.projectId,
      detail.opportunity,
    ),
  );
  const hash = await textHash(text);
  return {
    ...text,
    textHash: hash,
    ticket: await PublishingRepository.getTicket(
      input.projectId,
      input.opportunityId,
      hash,
    ),
  };
}

async function create(
  context: PublishingContext,
  raw: CreateIssueInput,
): Promise<{ ok: boolean; message: string; issueUrl?: string }> {
  await authorizePublishing(context, raw.projectId, true);
  const input = createIssueInputSchema.parse(raw);
  try {
    return await withPublishingClaim(
      context,
      input.projectId,
      async (claimToken, signal) => {
        const detail = await eligibleDetail(
          input.projectId,
          input.opportunityId,
        );
        if (!detail)
          return {
            ok: false,
            message: "Approve the opportunity before you create an issue.",
          };
        const opportunity = detail.opportunity;
        const text = opportunityTicket(
          detail,
          await ProposalDraftRepository.latestAnchor(
            input.projectId,
            detail.opportunity,
          ),
        );
        if ((await textHash(text)) !== input.textHash)
          return {
            ok: false,
            message: "The ticket text changed. Review it again.",
          };
        const connection = await PublishingRepository.getConnection(
          input.projectId,
        );
        if (!connection) throw new AppError("NOT_FOUND");
        const scope = {
          projectId: input.projectId,
          claimToken,
          organizationId: context.organizationId,
        };
        const id = crypto.randomUUID();
        const ticket = await PublishingRepository.claimTicket({
          ...scope,
          ticket: {
            id,
            projectId: input.projectId,
            opportunityId: opportunity.id,
            connectionId: connection.id,
            textHash: input.textHash,
            issueNumber: null,
            issueUrl: null,
            createdBy: context.userId,
            createdAt: new Date().toISOString(),
          },
        });
        if (!ticket) throw new AppError("CONFLICT");
        if (ticket.issueUrl)
          return {
            ok: true,
            message: `This approved text already has issue #${ticket.issueNumber}. No GitHub request was made.`,
            issueUrl: ticket.issueUrl,
          };
        const client = await connectedGithub(connection, signal, {
          metadata: "read",
          issues: "write",
        });
        const marker = `<!-- Relay ticket:${input.textHash} -->`;
        // A retry first looks for the issue that an interrupted create made.
        const issue =
          (ticket.id === id ? null : await client.findIssue(marker)) ??
          (await client.createIssue({
            title: text.title,
            body: `${text.body}\n\n${marker}`,
          }));
        if (
          !(await PublishingRepository.completeTicket({
            ...scope,
            id: ticket.id,
            issueNumber: issue.number,
            issueUrl: issue.url,
          }))
        )
          throw new AppError("CONFLICT");
        return {
          ok: true,
          message: `Issue #${issue.number} was created from the approved text.`,
          issueUrl: issue.url,
        };
      },
    );
  } catch (error) {
    if (error instanceof AppError && error.code === "FORBIDDEN")
      return {
        ok: false,
        message:
          "Add Issues read and write access to the token to create issues.",
      };
    return { ok: false, message: publishingFailure(error) };
  }
}

export const GithubIssueService = { preview, create };
