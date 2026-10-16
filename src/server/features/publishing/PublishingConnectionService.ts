import { symmetricEncrypt } from "better-auth/crypto";
import { hasOrgPermission } from "@/lib/org-permissions";
import { AppError } from "@/server/lib/errors";
import {
  connectPublishingInputSchema,
  productionEnvironmentInputSchema,
  type ConnectPublishingInput,
  type ProductionEnvironmentInput,
} from "@/types/schemas/publishing";
import { createGithubClient } from "./githubClient";
import {
  authorizePublishing,
  connectionSummary,
  publishingEncryptionKey,
  publishingFailure,
  withPublishingClaim,
  type PublishingContext,
} from "./publishingAccess";
import { PublishingRepository } from "./repositories/PublishingRepository";

async function get(context: PublishingContext, projectId: string) {
  await authorizePublishing(context, projectId);
  const [connection, key] = await Promise.all([
    PublishingRepository.getConnection(projectId),
    publishingEncryptionKey(),
  ]);
  return {
    configured: Boolean(key),
    canManage: hasOrgPermission(context.role, { integration: ["manage"] }),
    connection: connection ? connectionSummary(connection) : null,
  };
}

async function connect(
  context: PublishingContext,
  raw: ConnectPublishingInput,
) {
  await authorizePublishing(context, raw.projectId, true);
  const input = connectPublishingInputSchema.parse(raw);
  try {
    const key = await publishingEncryptionKey();
    if (!key) throw new AppError("AUTH_CONFIG_MISSING");
    return await withPublishingClaim(
      context,
      input.projectId,
      async (claimToken, signal) => {
        const client = createGithubClient({ ...input, signal, maxRequests: 2 });
        const repository = await client.getRepository();
        if (!repository.canPush || repository.archived)
          throw new AppError("FORBIDDEN");
        if (!(await client.getRef(input.baseBranch)))
          throw new AppError("NOT_FOUND");
        const encryptedToken = await symmetricEncrypt({
          key,
          data: input.token,
        });
        signal.throwIfAborted();
        const saved = await PublishingRepository.replaceConnection({
          connection: {
            id: crypto.randomUUID(),
            projectId: input.projectId,
            repositoryId: repository.id,
            owner: input.owner,
            repository: input.repository,
            baseBranch: input.baseBranch,
            rootDirectory: input.rootDirectory,
            productionEnvironment: input.productionEnvironment,
            encryptedToken,
            createdBy: context.userId,
            createdAt: new Date().toISOString(),
            revokedAt: null,
          },
          claimToken,
          organizationId: context.organizationId,
        });
        if (!saved) throw new AppError("CONFLICT");
        return {
          ok: true,
          message:
            "Repository connected. No branch, commit or pull request was created.",
        };
      },
    );
  } catch (error) {
    return { ok: false, message: publishingFailure(error) };
  }
}

async function disconnect(context: PublishingContext, projectId: string) {
  await authorizePublishing(context, projectId, true);
  try {
    return await withPublishingClaim(context, projectId, async (claimToken) => {
      if (!(await PublishingRepository.getConnection(projectId)))
        return { ok: true, message: "GitHub is already disconnected." };
      if (
        !(await PublishingRepository.disconnect({
          projectId,
          claimToken,
          organizationId: context.organizationId,
        }))
      )
        throw new AppError("CONFLICT");
      return {
        ok: true,
        message:
          "Stored GitHub access was removed. Existing pull requests were not closed or reverted. Revoke the token in GitHub if it is no longer needed.",
      };
    });
  } catch (error) {
    return { ok: false, message: publishingFailure(error) };
  }
}

async function setProductionEnvironment(
  context: PublishingContext,
  raw: ProductionEnvironmentInput,
) {
  await authorizePublishing(context, raw.projectId, true);
  const input = productionEnvironmentInputSchema.parse(raw);
  try {
    return await withPublishingClaim(
      context,
      input.projectId,
      async (claimToken) => {
        if (
          !(await PublishingRepository.setProductionEnvironment({
            ...input,
            claimToken,
            organizationId: context.organizationId,
          }))
        )
          throw new AppError("CONFLICT");
        return {
          ok: true,
          message: `Deployment signals now look for the "${input.productionEnvironment}" environment.`,
        };
      },
    );
  } catch (error) {
    return { ok: false, message: publishingFailure(error) };
  }
}

export const PublishingConnectionService = {
  get,
  connect,
  disconnect,
  setProductionEnvironment,
};
