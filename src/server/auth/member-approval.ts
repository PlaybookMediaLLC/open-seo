import { APIError } from "better-auth/api";
import {
  hasApproverRole,
  hasOrgPermission,
  withApproverRole,
  type OrgPermissionRequest,
} from "@/lib/org-permissions";
import type { EnsuredUserContext } from "@/middleware/ensure-user/types";
import { requireOrgPermission } from "@/server/auth/org-gate";
import { AuthRepository } from "@/server/auth/repositories/AuthRepository";
import { MemberApprovalRepository } from "@/server/auth/repositories/MemberApprovalRepository";
import { AppError } from "@/server/lib/errors";

// billing:manage is the owner-only statement.
const OWNER: OrgPermissionRequest = { billing: ["manage"] };

/**
 * RFC-0007 6.4: better-auth's update-member-role lets any admin set any
 * non-owner role, so it may not add or remove the approver role. Approval
 * moves only through setMemberApproval, which only an owner may call.
 */
export function refuseApproverChange(currentRole: string, newRole: string) {
  if (hasApproverRole(currentRole) !== hasApproverRole(newRole))
    throw new APIError("BAD_REQUEST", {
      message:
        "Pull request approval is granted and removed in organization settings.",
    });
}

/** An owner lets a member approve pull requests, or stops them. */
export async function setMemberApproval(
  context: Pick<EnsuredUserContext, "userId" | "organizationId" | "role">,
  input: { memberId: string; approve: boolean },
): Promise<{ memberId: string; approve: boolean }> {
  requireOrgPermission(context, OWNER);
  const target = await AuthRepository.getMemberInOrganization(
    input.memberId,
    context.organizationId,
  );
  if (!target) throw new AppError("NOT_FOUND");
  if (hasOrgPermission(target.role, OWNER))
    throw new AppError(
      "VALIDATION_ERROR",
      "Owners always approve pull requests.",
    );
  const role = withApproverRole(target.role, input.approve);
  if (role === target.role) return input;
  await MemberApprovalRepository.setRole({
    organizationId: context.organizationId,
    memberId: input.memberId,
    from: target.role,
    to: role,
    audit: {
      organizationId: context.organizationId,
      projectId: null,
      actor: context,
      action: input.approve
        ? "member.approval_granted"
        : "member.approval_removed",
      targetType: "member",
      targetId: input.memberId,
      summary: input.approve
        ? "Allowed a member to approve pull requests"
        : "Stopped a member from approving pull requests",
    },
  });
  const changed = await AuthRepository.getMemberInOrganization(
    input.memberId,
    context.organizationId,
  );
  if (changed?.role !== role) throw new AppError("CONFLICT");
  return input;
}
