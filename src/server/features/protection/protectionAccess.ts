import type { OrgPermissionRequest } from "@/lib/org-permissions";
import type {
  EnsuredProject,
  EnsuredUserContext,
} from "@/middleware/ensure-user/types";
import type {
  AuditAction,
  AuditInput,
} from "@/server/features/activity/auditLog";
import { PublishingRepository } from "@/server/features/publishing/repositories/PublishingRepository";
import { AppError } from "@/server/lib/errors";
import { usesBetterAuthServer } from "@/server/lib/runtime-env";
import {
  ProtectionRepository,
  type ProtectionEnrollment,
} from "./repositories/ProtectionRepository";

// RFC-0026 phase A (IRFC-0001): who may change a protected-site record, and
// the write helpers its changes share. Any member reads it; integration
// managers change it, and only the reviewer confirms their test alert.
export const MANAGE: OrgPermissionRequest = { integration: ["manage"] };

export type ProtectionContext = Pick<
  EnsuredUserContext,
  "userId" | "organizationId" | "role"
> & { project: Pick<EnsuredProject, "id" | "name" | "domain"> };

export function audit(
  context: ProtectionContext,
  enrollmentId: string,
  action: AuditAction,
  summary: string,
): AuditInput {
  return {
    organizationId: context.organizationId,
    projectId: context.project.id,
    actor: context,
    action,
    targetType: "protection_enrollment",
    targetId: enrollmentId,
    summary,
  };
}

export function conflict(cause?: unknown) {
  const error = new AppError(
    "CONFLICT",
    "The protected-site record changed since it was read.",
  );
  if (cause !== undefined) error.cause = cause;
  return error;
}

export async function requireEnrollment(projectId: string) {
  const enrollment = await ProtectionRepository.getEnrollment(projectId);
  if (!enrollment) throw new AppError("NOT_FOUND");
  return enrollment;
}

/**
 * Runs a scope change. A failed batch whose fence lost to another change is
 * a conflict; anything else is rethrown.
 */
export async function fenced(
  projectId: string,
  read: ProtectionEnrollment | null,
  write: () => Promise<unknown>,
) {
  try {
    await write();
  } catch (error) {
    const current = await ProtectionRepository.getEnrollment(projectId);
    if (current?.scopeVersion !== read?.scopeVersion) throw conflict(error);
    throw error;
  }
}

/**
 * Who may review. Accounts with member rows: the organization's members.
 * Delegated and Every App modes have none, so the signed-in user and the
 * current reviewer are the candidates.
 */
export async function reviewerCandidates(
  context: ProtectionContext,
  reviewerUserId: string | null,
) {
  if (await usesBetterAuthServer()) {
    const members = await PublishingRepository.listApproverCandidates(
      context.project.id,
      context.organizationId,
    );
    return members.map(({ userId, name, email }) => ({ userId, name, email }));
  }
  return ProtectionRepository.usersByIds(
    [...new Set([context.userId, reviewerUserId])].filter(
      (userId) => userId !== null,
    ),
  );
}
