import { symmetricDecrypt } from "better-auth/crypto";
import type { EnsuredUserContext } from "@/middleware/ensure-user/types";
import { requireOrgPermission } from "@/server/auth/org-gate";
import { DataRefreshClaimRepository } from "@/server/features/dashboard/repositories/DataRefreshClaimRepository";
import { ProjectRepository } from "@/server/features/projects/repositories/ProjectRepository";
import { AppError } from "@/server/lib/errors";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";
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

export async function publishingEncryptionKey(): Promise<string | null> {
  const key = (await getOptionalEnvValue("BETTER_AUTH_SECRET"))?.trim();
  return key && key.length >= MIN_BETTER_AUTH_SECRET_LENGTH ? key : null;
}

export function connectionSummary(
  row: PublishingConnectionRecord,
): PublishingConnection {
  const { encryptedToken: _encryptedToken, ...summary } = row;
  return summary;
}

export async function connectedGithub(
  connection: PublishingConnectionRecord,
  signal: AbortSignal,
  // A GitHub App token gets only this operation's permissions.
  permissions: AppPermissions = PUBLISH_PERMISSIONS,
) {
  if (connection.revokedAt) throw new AppError("CONFLICT");
  const target = {
    owner: connection.owner,
    repository: connection.repository,
    signal,
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
        await PublishingRepository.revokeInstallation(installation.id);
        throw new AppError("CONFLICT", "Reconnect the GitHub App.");
      }
      throw error;
    }
    // GitHub reports push: false for App tokens, so trust the installation.
    return createGithubClient({ ...target, token, assumePush: true });
  }
  const key = await publishingEncryptionKey();
  if (!key) throw new AppError("AUTH_CONFIG_MISSING");
  if (!connection.encryptedToken) throw new AppError("CONFLICT");
  let token: string;
  try {
    token = await symmetricDecrypt({ key, data: connection.encryptedToken });
  } catch {
    throw new AppError("AUTH_CONFIG_MISSING");
  }
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

export function publishingFailure(error: unknown): string {
  // Specific messages from the parser and checks are written for the user.
  if (
    error instanceof AppError &&
    (error.code === "VALIDATION_ERROR" || error.code === "CONFLICT") &&
    error.message !== error.code
  )
    return error.message;
  if (error instanceof AppError) {
    switch (error.code) {
      case "AUTH_CONFIG_MISSING":
        return "Configure a stable BETTER_AUTH_SECRET of at least 32 characters, then reconnect GitHub if the encryption key changed.";
      case "VALIDATION_ERROR":
        return "This change is not supported. Use a matching static Next.js App Router page with a direct string metadata.description, and a different description of at most 320 characters.";
      case "FORBIDDEN":
        return "GitHub access is unavailable. Check the selected repository and the token's Contents and Pull requests permissions.";
      case "NOT_FOUND":
        return "The selected GitHub repository, branch or supported page is unavailable. Check the connection and file path.";
      case "CONFLICT":
        return "The project, evidence, connection or repository changed, or another operation is running. Reload and review before retrying. Remote work may already exist and will be checked on an authorized retry.";
      case "RATE_LIMITED":
        return "The bounded GitHub request allowance or provider rate limit was reached. Wait before retrying.";
    }
  }
  return "GitHub work could not finish. No merge or deployment was requested. A branch or pull request may already exist. An authorized retry will check existing work before creating anything.";
}
