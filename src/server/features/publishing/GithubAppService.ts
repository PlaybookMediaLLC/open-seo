import type { githubAppInstallations } from "@/db/schema";
import {
  hasOrgPermission,
  type OrgPermissionRequest,
} from "@/lib/org-permissions";
import { resolveUserContextFromHeaders } from "@/middleware/ensure-user/resolve";
import { AppError } from "@/server/lib/errors";
import {
  connectGithubAppInputSchema,
  publishingProjectInputSchema,
  type ConnectGithubAppInput,
} from "@/types/schemas/publishing";
import { createGithubClient } from "./githubClient";
import {
  exchangeUserCode,
  githubAppConfig,
  installationRepositories,
  installationToken,
  userInstallationRepositoryIds,
  userInstallations,
} from "./githubApp";
import { consumeAppState, createAppState } from "./githubAppState";
import {
  authorizePublishing,
  publishingFailure,
  withPublishingClaim,
  type PublishingContext,
} from "./publishingAccess";
import { PublishingRepository } from "./repositories/PublishingRepository";

// GitHub App connections (RFC-0005 5.7). Personal tokens stay available.

// Starting an install and completing its setup both need this permission.
const INSTALL_PERMISSION: OrgPermissionRequest = { integration: ["manage"] };

async function state(context: PublishingContext, raw: { projectId: string }) {
  await authorizePublishing(context, raw.projectId);
  const input = publishingProjectInputSchema.parse(raw);
  const config = await githubAppConfig();
  if (!config) return { configured: false as const };
  const installations = await PublishingRepository.listInstallations(
    context.organizationId,
  );
  const canManage = hasOrgPermission(context.role, INSTALL_PERMISSION);
  return {
    configured: true as const,
    installUrl: canManage
      ? `https://github.com/apps/${config.slug}/installations/new?state=${await createAppState(
          {
            userId: context.userId,
            organizationId: context.organizationId,
            projectId: input.projectId,
          },
        )}`
      : null,
    installations: installations.map((installation) => ({
      id: installation.id,
      accountLogin: installation.accountLogin,
    })),
  };
}

/**
 * The setup callback. The signed-in Relay user must be the one who started
 * the install, still able to manage integrations in its organization, and the
 * installation must be one that their GitHub user token can access. The URL
 * parameters alone are never trusted. Only the repositories that the user
 * token can reach are saved, and the token is then discarded.
 */
async function handleSetup(request: Request) {
  const url = new URL(request.url);
  const payload = await consumeAppState(url.searchParams.get("state"));
  const code = url.searchParams.get("code");
  const installationId = Number(url.searchParams.get("installation_id"));
  const back = (projectId: string, result: string) =>
    Response.redirect(
      new URL(
        `/p/${projectId}/settings/integrations?githubApp=${result}`,
        url.origin,
      ),
      302,
    );
  if (!payload) return Response.redirect(new URL("/", url.origin), 302);
  if (!code || !Number.isSafeInteger(installationId) || installationId < 1) {
    console.error("GitHub App setup callback is incomplete", {
      hasCode: Boolean(code),
      installationId: url.searchParams.get("installation_id"),
      setupAction: url.searchParams.get("setup_action"),
    });
    return back(payload.projectId, "failed");
  }
  try {
    // The state is consumed first, so one presented by the wrong session is
    // burned. Without this check, a victim who completes an attacker's
    // install link would link the victim's installation to the attacker's
    // organization. The organization and role come from the session.
    const context = await resolveUserContextFromHeaders(request.headers);
    if (
      context.userId !== payload.userId ||
      context.organizationId !== payload.organizationId ||
      !hasOrgPermission(context.role, INSTALL_PERMISSION)
    ) {
      console.error("GitHub App setup session does not match its state", {
        installationId,
      });
      return back(payload.projectId, "refused");
    }
    const userToken = await exchangeUserCode(code);
    const installation = (await userInstallations(userToken)).find(
      (item) => item.id === installationId,
    );
    if (!installation) {
      console.error("GitHub App installation is not visible to the user", {
        installationId,
      });
      return back(payload.projectId, "refused");
    }
    await PublishingRepository.saveInstallation(
      {
        organizationId: payload.organizationId,
        installationId,
        accountLogin: installation.account.login,
        accountType: installation.account.type,
        createdBy: payload.userId,
        createdAt: new Date().toISOString(),
      },
      await userInstallationRepositoryIds(userToken, installationId),
      {
        organizationId: payload.organizationId,
        projectId: payload.projectId,
        actor: { userId: payload.userId },
        action: "github_app.installed",
        targetType: "github_installation",
        targetId: String(installationId),
        summary: `Installed the GitHub App on ${installation.account.login}`,
      },
    );
    return back(payload.projectId, "installed");
  } catch (error) {
    // The redirect hides the reason. Error messages here hold no token.
    console.error("GitHub App setup failed", {
      installationId,
      code: error instanceof AppError ? error.code : undefined,
      message: error instanceof Error ? error.message : String(error),
    });
    return back(payload.projectId, "failed");
  }
}

// The App token reaches every repository in the installation. Only those
// that the linking user could access at setup are offered or connected.
async function linkedRepositories(
  installation: Pick<
    typeof githubAppInstallations.$inferSelect,
    "id" | "installationId"
  >,
) {
  const [reachable, allowed] = await Promise.all([
    installationRepositories(installation.installationId),
    PublishingRepository.listInstallationRepositoryIds(installation.id),
  ]);
  const ids = new Set(allowed);
  return reachable.filter((repository) => ids.has(repository.id));
}

async function repositories(
  context: PublishingContext,
  raw: { projectId: string },
) {
  await authorizePublishing(context, raw.projectId, true);
  const installations = await PublishingRepository.listInstallations(
    context.organizationId,
  );
  const lists = await Promise.all(
    installations.map(async (installation) =>
      (await linkedRepositories(installation)).map((repository) => ({
        ...repository,
        installationRef: installation.id,
      })),
    ),
  );
  return lists.flat();
}

async function connect(context: PublishingContext, raw: ConnectGithubAppInput) {
  await authorizePublishing(context, raw.projectId, true);
  const input = connectGithubAppInputSchema.parse(raw);
  try {
    return await withPublishingClaim(
      context,
      input.projectId,
      async (claimToken, signal) => {
        const installation = await PublishingRepository.getInstallation(
          input.installationRef,
        );
        if (
          !installation ||
          installation.organizationId !== context.organizationId ||
          installation.revokedAt
        )
          throw new AppError("NOT_FOUND");
        const repository = (await linkedRepositories(installation)).find(
          (item) => item.id === input.repositoryId,
        );
        if (!repository) throw new AppError("NOT_FOUND");
        const client = createGithubClient({
          token: await installationToken({
            installationId: installation.installationId,
            repositoryId: repository.id,
            permissions: { metadata: "read", contents: "read" },
          }),
          owner: repository.owner,
          repository: repository.name,
          signal,
          maxRequests: 2,
          assumePush: true,
        });
        if ((await client.getRepository()).archived)
          throw new AppError("FORBIDDEN");
        if (!(await client.getRef(input.baseBranch)))
          throw new AppError("NOT_FOUND");
        const saved = await PublishingRepository.replaceConnection({
          connection: {
            id: crypto.randomUUID(),
            projectId: input.projectId,
            repositoryId: repository.id,
            owner: repository.owner,
            repository: repository.name,
            baseBranch: input.baseBranch,
            rootDirectory: input.rootDirectory,
            productionEnvironment: input.productionEnvironment,
            transport: "github_app",
            installationRef: installation.id,
            encryptedToken: null,
            tokenKeyVersion: 0,
            createdBy: context.userId,
            createdAt: new Date().toISOString(),
            revokedAt: null,
          },
          audit: {
            organizationId: context.organizationId,
            projectId: input.projectId,
            actor: context,
            action: "publishing.connected",
            targetType: "repository",
            targetId: `${repository.owner}/${repository.name}`,
            summary: `Connected ${repository.owner}/${repository.name} with the GitHub App`,
          },
          claimToken,
          organizationId: context.organizationId,
        });
        if (!saved) throw new AppError("CONFLICT");
        return {
          ok: true,
          message:
            "Repository connected through the GitHub App. No branch, commit or pull request was created.",
        };
      },
    );
  } catch (error) {
    return { ok: false, message: publishingFailure(error) };
  }
}

export const GithubAppService = { state, handleSetup, repositories, connect };
