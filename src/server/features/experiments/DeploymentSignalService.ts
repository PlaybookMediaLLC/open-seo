import {
  authorizePublishing,
  connectedGithub,
  withPublishingClaim,
  type PublishingContext,
} from "@/server/features/publishing/publishingAccess";
import { PublishingRepository } from "@/server/features/publishing/repositories/PublishingRepository";
import { AppError } from "@/server/lib/errors";
import {
  experimentInputSchema,
  type DeploymentSignal,
  type ExperimentInput,
  type ExperimentMutationResult,
} from "@/types/schemas/experiments";
import { fetchLiveMetadata } from "./liveMetadata";
import { ExperimentRepository } from "./repositories/ExperimentRepository";

const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

// Checks two read-only signals after a merge: a successful GitHub deployment
// of the merge commit to the production environment, and the approved text on
// the live page. Neither one alone starts measurement (RFC-0005 5.4).
async function refresh(
  context: PublishingContext,
  raw: ExperimentInput,
): Promise<ExperimentMutationResult> {
  await authorizePublishing(context, raw.projectId, true);
  const input = experimentInputSchema.parse(raw);
  return withPublishingClaim(
    context,
    input.projectId,
    async (claimToken, signal) => {
      const detail = await ExperimentRepository.get(
        input.projectId,
        input.experimentId,
      );
      if (!detail) throw new AppError("NOT_FOUND");
      const { experiment, publishing } = detail;
      const sha = experiment.mergeCommitSha;
      if (experiment.pullRequestState !== "merged" || !sha)
        return {
          ok: false,
          message:
            "Refresh the pull request status first. Deployment signals start after the merge.",
        };
      const connection = await PublishingRepository.getConnection(
        input.projectId,
      );
      if (
        !connection ||
        connection.repositoryId !== publishing.connection.repositoryId
      )
        throw new AppError("CONFLICT");
      const record = (
        signalInput: Pick<
          DeploymentSignal,
          "kind" | "effectiveAt" | "environment" | "externalId" | "detail"
        >,
      ) =>
        ExperimentRepository.recordSignal({
          projectId: input.projectId,
          experimentId: input.experimentId,
          claimToken,
          organizationId: context.organizationId,
          signal: {
            ...signalInput,
            id: crypto.randomUUID(),
            projectId: input.projectId,
            experimentId: input.experimentId,
            observedAt: new Date().toISOString(),
            createdBy: "system",
          },
        });
      const messages: string[] = [];

      const client = await connectedGithub(connection, signal);
      try {
        const deployments = (await client.listDeployments(sha)).filter(
          (deployment) =>
            deployment.sha === sha &&
            deployment.environment.toLowerCase() ===
              connection.productionEnvironment.toLowerCase(),
        );
        let deployed = false;
        for (const deployment of deployments.slice(0, 5)) {
          const success = (
            await client.listDeploymentStatuses(deployment.id)
          ).find((status) => status.state === "success");
          if (!success) continue;
          await record({
            kind: "github_deployment",
            effectiveAt: new Date(success.created_at).toISOString(),
            environment: deployment.environment,
            externalId: String(deployment.id),
            detail: `GitHub deployment ${deployment.id} of the merge commit to ${deployment.environment} succeeded.`,
          });
          deployed = true;
          break;
        }
        messages.push(
          deployed
            ? "GitHub reports a successful production deployment of the merge commit."
            : `GitHub reports no successful "${connection.productionEnvironment}" deployment of the merge commit yet.`,
        );
      } catch (error) {
        if (!(error instanceof AppError && error.code === "FORBIDDEN"))
          throw error;
        messages.push("Add Deployments read access to see deployment status.");
      }

      const { proposal } = publishing;
      let live: Awaited<ReturnType<typeof fetchLiveMetadata>>;
      try {
        live = await fetchLiveMetadata(experiment.targetUrl);
      } catch {
        live = null;
      }
      const descriptionChanged =
        proposal.descriptionAfter !== proposal.descriptionBefore;
      // The rendered title includes the layout template, so it must contain
      // the approved title rather than equal it.
      const matches =
        live !== null &&
        (!descriptionChanged ||
          live.description === normalize(proposal.descriptionAfter)) &&
        (proposal.titleAfter === null ||
          (live.title?.includes(normalize(proposal.titleAfter)) ?? false));
      if (matches) {
        await record({
          kind: "live_content_match",
          effectiveAt: new Date().toISOString(),
          environment: null,
          externalId: "live",
          detail:
            "The live page shows the approved text. This proves the change is visible. It does not prove which commit runs.",
        });
        messages.push("The live page shows the approved text.");
      } else
        messages.push(
          live
            ? "The live page does not show the approved text yet."
            : "Relay could not read the live page.",
        );
      return { ok: true, message: messages.join(" ") };
    },
  ).catch(() => ({
    ok: false,
    message:
      "Could not check deployment signals. Check the GitHub connection and retry. Existing history was preserved.",
  }));
}

export const DeploymentSignalService = { refresh };
