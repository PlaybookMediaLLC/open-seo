import { DeploymentSignalService } from "@/server/features/experiments/DeploymentSignalService";
import { ExperimentService } from "@/server/features/experiments/ExperimentService";
import { ExperimentRepository } from "@/server/features/experiments/repositories/ExperimentRepository";
import type { JobContext } from "../growthJobs";
import { GrowthJobRepository } from "../repositories/GrowthJobRepository";

/**
 * RFC-0008 5.8: for changes not confirmed in production, refresh the pull
 * request and the deployment signals. A person still confirms deployment.
 */
export async function deploymentCheckJob(context: JobContext) {
  const { items } = await ExperimentRepository.list({
    projectId: context.projectId,
    limit: 100,
    offset: 0,
  });
  const pending = items.filter((item) => !item.deployedAt);
  let detected = 0;
  for (const item of pending) {
    const input = { projectId: context.projectId, experimentId: item.id };
    if (item.pullRequestState !== "merged") {
      const pull = await ExperimentService.refreshPull(context.actor, input);
      context.log("info", `${item.targetUrl}: ${pull.message}`);
    }
    const detail = await ExperimentRepository.get(context.projectId, item.id);
    if (detail?.experiment.pullRequestState !== "merged") continue;
    const signals = await DeploymentSignalService.refresh(context.actor, input);
    context.log(
      signals.ok ? "info" : "warn",
      `${item.targetUrl}: ${signals.message}`,
    );
    const after = await ExperimentRepository.get(context.projectId, item.id);
    if (!after?.signals.some((signal) => signal.kind !== "human_attestation"))
      continue;
    detected++;
    await GrowthJobRepository.notify({
      organizationId: context.organizationId,
      projectId: context.projectId,
      kind: "deployment_detected",
      title: `Deployment detected for ${new URL(item.targetUrl).pathname}`,
      body: "Relay saw a production deployment signal. Confirm the deployment on the experiment page to start measuring.",
      linkPath: `/p/${context.projectId}/experiments/${item.id}`,
      dedupeKey: item.id,
    });
  }
  return {
    summary: `Checked ${pending.length} changes not confirmed in production; ${detected} with deployment signals.`,
  };
}
