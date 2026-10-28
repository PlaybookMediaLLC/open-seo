import {
  hasOrgPermission,
  type OrgPermissionRequest,
} from "@/lib/org-permissions";
import type { EnsuredUserContext } from "@/middleware/ensure-user/types";
import { requireOrgPermission } from "@/server/auth/org-gate";
import { AuthRepository } from "@/server/auth/repositories/AuthRepository";
import type { AuditInput } from "@/server/features/activity/auditLog";
import { AppError } from "@/server/lib/errors";
import type { AgencyLink } from "@/types/schemas/portfolio";
import { PortfolioRepository } from "../repositories/PortfolioRepository";

// RFC-0007 6.6: an agency organization sees the portfolio summary of each
// client organization whose owner accepted it. The agency's owner asks for a
// client organization they belong to; either owner ends the link at any time.
// Client projects never move into the agency organization.
type LinkContext = Pick<
  EnsuredUserContext,
  "organizationId" | "userId" | "role"
>;

// billing:manage is the owner-only statement.
const OWNER: OrgPermissionRequest = { billing: ["manage"] };

function audits(
  context: LinkContext,
  link: {
    id: string;
    agencyOrganizationId: string;
    clientOrganizationId: string;
  },
  action: AuditInput["action"],
  summary: string,
): AuditInput[] {
  // Each side's activity log shows the change.
  return [link.agencyOrganizationId, link.clientOrganizationId].map(
    (organizationId) => ({
      organizationId,
      projectId: null,
      actor: context,
      action,
      targetType: "agency_link",
      targetId: link.id,
      summary,
    }),
  );
}

const status = (acceptedAt: string | null) =>
  acceptedAt ? ("active" as const) : ("pending" as const);

async function list(context: LinkContext): Promise<{
  canManage: boolean;
  clients: AgencyLink[];
  agencies: AgencyLink[];
  candidates: { organizationId: string; organizationName: string }[];
}> {
  const canManage = hasOrgPermission(context.role, OWNER);
  const [links, memberships] = await Promise.all([
    PortfolioRepository.listOpenLinks(context.organizationId),
    canManage ? AuthRepository.listMembershipsForUser(context.userId) : [],
  ]);
  const asAgency = links.filter(
    (link) => link.agencyOrganizationId === context.organizationId,
  );
  const linked = new Set(asAgency.map((link) => link.clientOrganizationId));
  return {
    canManage,
    clients: asAgency.map((link) => ({
      id: link.id,
      organizationId: link.clientOrganizationId,
      organizationName: link.clientName,
      status: status(link.acceptedAt),
      requestedAt: link.requestedAt,
      acceptedAt: link.acceptedAt,
    })),
    agencies: links
      .filter((link) => link.clientOrganizationId === context.organizationId)
      .map((link) => ({
        id: link.id,
        organizationId: link.agencyOrganizationId,
        organizationName: link.agencyName,
        status: status(link.acceptedAt),
        requestedAt: link.requestedAt,
        acceptedAt: link.acceptedAt,
      })),
    // Other organizations the owner belongs to, not yet linked as clients.
    candidates: memberships
      .filter(
        (membership) =>
          membership.organizationId !== context.organizationId &&
          !linked.has(membership.organizationId),
      )
      .map(({ organizationId, organizationName }) => ({
        organizationId,
        organizationName,
      })),
  };
}

/** The agency's owner asks a client organization they belong to. */
async function request(
  context: LinkContext,
  input: { clientOrganizationId: string },
): Promise<{ linkId: string }> {
  requireOrgPermission(context, OWNER);
  if (input.clientOrganizationId === context.organizationId)
    throw new AppError("VALIDATION_ERROR", "Choose another organization.");
  if (
    !(await AuthRepository.getMembership(
      context.userId,
      input.clientOrganizationId,
    ))
  )
    throw new AppError("NOT_FOUND");
  const link = {
    id: crypto.randomUUID(),
    agencyOrganizationId: context.organizationId,
    clientOrganizationId: input.clientOrganizationId,
  };
  const created = await PortfolioRepository.requestLink({
    ...link,
    userId: context.userId,
    audits: audits(
      context,
      link,
      "agency.link_requested",
      "Asked for agency access to a client organization",
    ),
  });
  if (!created)
    throw new AppError(
      "CONFLICT",
      "This organization already has an open request or link.",
    );
  return { linkId: link.id };
}

/** The client's owner accepts a pending request. */
async function accept(
  context: LinkContext,
  input: { linkId: string },
): Promise<void> {
  requireOrgPermission(context, OWNER);
  const link = await PortfolioRepository.getOpenLink(
    input.linkId,
    context.organizationId,
  );
  if (!link || link.clientOrganizationId !== context.organizationId)
    throw new AppError("NOT_FOUND");
  if (link.acceptedAt) return;
  const accepted = await PortfolioRepository.acceptLink({
    linkId: link.id,
    clientOrganizationId: context.organizationId,
    userId: context.userId,
    audits: audits(
      context,
      link,
      "agency.link_accepted",
      "Gave an agency read access to the portfolio summary",
    ),
  });
  if (!accepted) throw new AppError("CONFLICT");
}

/** Either owner declines, withdraws or ends a link. */
async function end(
  context: LinkContext,
  input: { linkId: string },
): Promise<void> {
  requireOrgPermission(context, OWNER);
  const link = await PortfolioRepository.getOpenLink(
    input.linkId,
    context.organizationId,
  );
  if (!link) throw new AppError("NOT_FOUND");
  const ended = await PortfolioRepository.endLink({
    linkId: link.id,
    organizationId: context.organizationId,
    userId: context.userId,
    audits: audits(context, link, "agency.link_ended", "Ended agency access"),
  });
  if (!ended) throw new AppError("CONFLICT");
}

export const AgencyLinkService = { list, request, accept, end };
