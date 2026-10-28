import {
  hasOrgPermission,
  type OrgPermissionRequest,
} from "@/lib/org-permissions";
import { requireOrgPermission } from "@/server/auth/org-gate";
import { AppError } from "@/server/lib/errors";
import {
  authorizePublishing,
  canApprove,
  type PublishingContext,
} from "./publishingAccess";
import { PublishingRepository } from "./repositories/PublishingRepository";

// RFC-0007 6.5: a project's delegated execution authority. Members see who
// may approve its pull requests; only owners change the list.
// billing:manage is the owner-only statement.
const OWNER: OrgPermissionRequest = { billing: ["manage"] };
const MANAGE: OrgPermissionRequest = { integration: ["manage"] };

async function list(context: PublishingContext, projectId: string) {
  await authorizePublishing(context, projectId);
  const members = await PublishingRepository.listApproverCandidates(
    projectId,
    context.organizationId,
  );
  const restricted = members.some((row) => row.listed);
  return {
    canManage: hasOrgPermission(context.role, OWNER),
    canApprove: await canApprove(context, projectId),
    restricted,
    // Only members who can prepare changes can be listed.
    members: members
      .filter((row) => hasOrgPermission(row.role, MANAGE))
      .map((row) => ({
        memberId: row.memberId,
        name: row.name,
        email: row.email,
        isOwner: hasOrgPermission(row.role, OWNER),
        listed: row.listed,
        approves:
          hasOrgPermission(row.role, OWNER) ||
          (restricted
            ? row.listed
            : hasOrgPermission(row.role, { publishing: ["approve"] })),
      })),
  };
}

/** Replaces the list. An empty list returns approval to the role. */
async function save(
  context: PublishingContext,
  input: { projectId: string; memberIds: readonly string[] },
): Promise<void> {
  await authorizePublishing(context, input.projectId);
  requireOrgPermission(context, OWNER);
  const memberIds = [...new Set(input.memberIds)];
  const found = await PublishingRepository.membersIn(
    context.organizationId,
    memberIds,
  );
  if (
    found.length !== memberIds.length ||
    found.some((row) => !hasOrgPermission(row.role, MANAGE))
  )
    throw new AppError(
      "VALIDATION_ERROR",
      "Approvers must be members of this organization who can manage integrations.",
    );
  const current = await PublishingRepository.listApproverCandidates(
    input.projectId,
    context.organizationId,
  );
  const listed = current.filter((row) => row.listed).map((row) => row.memberId);
  if (
    listed.length === memberIds.length &&
    memberIds.every((memberId) => listed.includes(memberId))
  )
    return;
  await PublishingRepository.replaceApprovers({
    projectId: input.projectId,
    memberIds,
    grantedByUserId: context.userId,
    audit: {
      organizationId: context.organizationId,
      projectId: input.projectId,
      actor: context,
      action: "publishing.approvers_changed",
      targetType: "project",
      targetId: input.projectId,
      summary: memberIds.length
        ? `Limited pull request approval to ${memberIds.length} ${memberIds.length === 1 ? "member" : "members"}`
        : "Let every approver approve pull requests",
    },
  });
}

export const PublishingApproverService = { list, save };
