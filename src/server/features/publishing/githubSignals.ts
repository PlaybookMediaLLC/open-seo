import { z } from "zod";
import {
  githubShaSchema,
  validateGithubSha,
  type GithubRequest,
} from "./githubRead";

export type RepositoryChecks =
  | "passing"
  | "failing"
  | "pending"
  | "not_configured";

const FAILED = new Set([
  "failure",
  "timed_out",
  "cancelled",
  "action_required",
  "startup_failure",
]);

// Read-only GitHub calls for deployment evidence and the repository's own
// checks. They never change repository state.
export function createGithubSignals(request: GithubRequest) {
  return {
    listDeployments(sha: string) {
      return request(
        `/deployments?sha=${validateGithubSha(sha)}&per_page=30`,
        z.array(
          z.object({
            id: z.number().int().positive(),
            environment: z.string(),
            sha: githubShaSchema,
          }),
        ),
      );
    },
    listDeploymentStatuses(deploymentId: number) {
      return request(
        `/deployments/${deploymentId}/statuses?per_page=30`,
        z.array(z.object({ state: z.string(), created_at: z.iso.datetime() })),
      );
    },
    async getChecks(sha: string): Promise<RepositoryChecks> {
      validateGithubSha(sha);
      const runs = await request(
        `/commits/${sha}/check-runs?per_page=100`,
        z.object({
          check_runs: z.array(
            z.object({ status: z.string(), conclusion: z.string().nullable() }),
          ),
        }),
      );
      const status = await request(
        `/commits/${sha}/status`,
        z.object({ state: z.string(), total_count: z.number().int() }),
      );
      const statuses = status.total_count > 0 ? [status.state] : [];
      if (!runs.check_runs.length && !statuses.length) return "not_configured";
      if (
        runs.check_runs.some((run) => FAILED.has(run.conclusion ?? "")) ||
        statuses.some((state) => state === "failure" || state === "error")
      )
        return "failing";
      if (
        runs.check_runs.some((run) => run.status !== "completed") ||
        statuses.includes("pending")
      )
        return "pending";
      return "passing";
    },
  };
}
