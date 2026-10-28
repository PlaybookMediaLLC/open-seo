import type { EnsuredUserContext } from "@/middleware/ensure-user/types";
import { openToken } from "./tokenKeys";
import { hasOrgPermission } from "@/lib/org-permissions";
import { requireOrgPermission } from "@/server/auth/org-gate";
import { DataRefreshClaimRepository } from "@/server/features/dashboard/repositories/DataRefreshClaimRepository";
import { ProjectRepository } from "@/server/features/projects/repositories/ProjectRepository";
import { AppError } from "@/server/lib/errors";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";
import type { ErrorCode } from "@/shared/error-codes";
import { MIN_BETTER_AUTH_SECRET_LENGTH } from "@/shared/selfhost-checks";
import type {
  PublishingConnection,
  PublishingConnectionRecord,
} from "@/types/schemas/publishing";
import { createGithubClient } from "./githubClient";
import {
  installationToken,
  PUBLISH_PERMISSIONS,
  type AppPermissions,
} from "./githubApp";
import { PublishingRepository } from "./repositories/PublishingRepository";

export type PublishingContext = Pick<
  EnsuredUserContext,
  "organizationId" | "userId" | "role"
>;

export async function authorizePublishing(
  context: PublishingContext,
  projectId: string,
  manage = false,
) {
  const project = await ProjectRepository.getProjectForOrganization(
    projectId,
    context.organizationId,
  );
  if (!project) throw new AppError("NOT_FOUND", "Project not found.");
  if (manage) requireOrgPermission(context, { integration: ["manage"] });
}

/**
 * RFC-0007 6.4-6.5: who may approve a pull request Relay opens for the
 * project. Owners always may. A project's approver list, when it has one,
 * names the others; otherwise every holder of publishing:approve may.
 */
export async function canApprove(
  context: PublishingContext,
  projectId: string,
): Promise<boolean> {
  if (!hasOrgPermission(context.role, { integration: ["manage"] }))
    return false;
  // billing:manage is the owner-only statement.
  if (hasOrgPermission(context.role, { billing: ["manage"] })) return true;
  const listed = await PublishingRepository.listApproverUserIds(
    projectId,
    context.organizationId,
  );
  return listed.length
    ? listed.includes(context.userId)
    : hasOrgPermission(context.role, { publishing: ["approve"] });
}

/** Every path that writes to a customer repository authorizes here first. */
export async function authorizeApproval(
  context: PublishingContext,
  projectId: string,
) {
  await authorizePublishing(context, projectId, true);
  if (!(await canApprove(context, projectId)))
    throw new AppError(
      "FORBIDDEN",
      "You can't approve pull requests for this project. Ask an owner to add you as an approver.",
    );
}

export async function publishingEncryptionKey(): Promise<string | null> {
  const key = (await getOptionalEnvValue("BETTER_AUTH_SECRET"))?.trim();
  return key && key.length >= MIN_BETTER_AUTH_SECRET_LENGTH ? key : null;
}

export function connectionSummary(
  row: PublishingConnectionRecord,
): PublishingConnection {
  const {
    encryptedToken: _encryptedToken,
    tokenKeyVersion: _tokenKeyVersion,
    ...summary
  } = row;
  return summary;
}

export async function connectedGithub(
  connection: PublishingConnectionRecord,
  signal: AbortSignal,
  // A GitHub App token gets only this operation's permissions.
  permissions: AppPermissions = PUBLISH_PERMISSIONS,
  // RFC-0011: a bulk read of page files needs more than the default 32.
  maxRequests?: number,
) {
  if (connection.revokedAt) throw new AppError("CONFLICT");
  const target = {
    owner: connection.owner,
    repository: connection.repository,
    signal,
    maxRequests,
  };
  if (connection.transport === "github_app") {
    const installation = connection.installationRef
      ? await PublishingRepository.getInstallation(connection.installationRef)
      : null;
    if (!installation || installation.revokedAt)
      throw new AppError("CONFLICT", "Reconnect the GitHub App.");
    let token: string;
    try {
      token = await installationToken({
        installationId: installation.installationId,
        repositoryId: connection.repositoryId,
        permissions,
      });
    } catch (error) {
      if (
        error instanceof AppError &&
        (error.code === "NOT_FOUND" || error.code === "FORBIDDEN")
      ) {
        await PublishingRepository.revokeInstallation(installation.id, {
          organizationId: installation.organizationId,
          projectId: connection.projectId,
          actor: { userId: "github", scheduled: true },
          action: "github_app.revoked",
          targetType: "github_installation",
          targetId: String(installation.installationId),
          summary: `GitHub no longer grants the App access to ${installation.accountLogin}`,
        });
        throw new AppError("CONFLICT", "Reconnect the GitHub App.");
      }
      throw error;
    }
    // GitHub reports push: false for App tokens, so trust the installation.
    return createGithubClient({ ...target, token, assumePush: true });
  }
  if (!connection.encryptedToken) throw new AppError("CONFLICT");
  // RFC-0009 5.7: the key of the row's version; an older key re-encrypts.
  const { token, rewrapped } = await openToken({
    encryptedToken: connection.encryptedToken,
    tokenKeyVersion: connection.tokenKeyVersion,
  });
  if (rewrapped)
    await PublishingRepository.rewrapToken({
      projectId: connection.projectId,
      connectionId: connection.id,
      from: connection.encryptedToken,
      ...rewrapped,
    }).catch(() => undefined);
  return createGithubClient({ ...target, token });
}

// One lease serializes credential replacement, preparation and publication.
// The provider deadline is shorter than the lease, and each persisted write
// checks its token again. Do not race uncancellable database work with release.
export async function withPublishingClaim<T>(
  context: PublishingContext,
  projectId: string,
  operation: (token: string, signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const key = `publishing:${projectId}`;
  const token = await DataRefreshClaimRepository.claim(
    key,
    context.organizationId,
  );
  if (!token) throw new AppError("CONFLICT");
  const controller = new AbortController();
  const signal = AbortSignal.any([
    controller.signal,
    AbortSignal.timeout(90_000),
  ]);
  try {
    return await operation(token, signal);
  } finally {
    controller.abort();
    // A release failure must not turn a committed PR result into a failed one.
    // The original lease still expires and remains visible as a short retry wait.
    await DataRefreshClaimRepository.finish(key, token, 0).catch(
      () => undefined,
    );
  }
}

const PUBLISHING_FAILURE_MESSAGES: Partial<Record<ErrorCode, string>> = {
  AUTH_CONFIG_MISSING:
    "Configure a stable BETTER_AUTH_SECRET of at least 32 characters, then reconnect GitHub if the encryption key changed.",
  VALIDATION_ERROR:
    "This change is not supported. Use a matching static Next.js App Router page with a direct string metadata.description, and a different description of at most 320 characters.",
  FORBIDDEN:
    "GitHub access is unavailable. Check the selected repository and the token's Contents and Pull requests permissions.",
  NOT_FOUND:
    "The selected GitHub repository, branch or supported page is unavailable. Check the connection and file path.",
  CONFLICT:
    "The project, evidence, connection or repository changed, or another operation is running. Reload and review before retrying. Remote work may already exist and will be checked on an authorized retry.",
  RATE_LIMITED:
    "The bounded GitHub request allowance or provider rate limit was reached. Wait before retrying.",
};

export function publishingFailure(error: unknown): string {
  // Specific messages from the parser and checks are written for the user.
  if (
    error instanceof AppError &&
    (error.code === "VALIDATION_ERROR" || error.code === "CONFLICT") &&
    error.message !== error.code
  )
    return error.message;
  const message =
    error instanceof AppError
      ? PUBLISHING_FAILURE_MESSAGES[error.code]
      : undefined;
  if (message) return message;
  return "GitHub work could not finish. No merge or deployment was requested. A branch or pull request may already exist. An authorized retry will check existing work before creating anything.";
}
