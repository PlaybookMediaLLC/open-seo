import { AppError } from "@/server/lib/errors";
import {
  proposalInputSchema,
  type ProposalInput,
} from "@/types/schemas/publishing";
import type { RepositoryChecks } from "./githubSignals";
import {
  authorizePublishing,
  connectedGithub,
  type PublishingContext,
} from "./publishingAccess";
import { PublishingRepository } from "./repositories/PublishingRepository";

// The repository's own checks on the pull request head. Read on demand and
// never stored. They are the customer's CI, not a Relay build (RFC-0005 5.5).
export async function getRepositoryChecks(
  context: PublishingContext,
  raw: ProposalInput,
): Promise<{ state: RepositoryChecks | null; message: string | null }> {
  await authorizePublishing(context, raw.projectId);
  const input = proposalInputSchema.parse(raw);
  const history = await PublishingRepository.getProposal(
    input.projectId,
    input.proposalId,
  );
  const head = history?.executions.find(
    (execution) => execution.status === "succeeded",
  )?.commitSha;
  if (!history || !head) throw new AppError("NOT_FOUND");
  const connection = await PublishingRepository.getConnectionById(
    input.projectId,
    history.proposal.connectionId,
  );
  if (!connection) throw new AppError("NOT_FOUND");
  try {
    const client = await connectedGithub(
      connection,
      AbortSignal.timeout(20_000),
      { metadata: "read", checks: "read", statuses: "read" },
    );
    return { state: await client.getChecks(head), message: null };
  } catch (error) {
    if (error instanceof AppError && error.code === "FORBIDDEN")
      return {
        state: null,
        message:
          "Add Checks read and Commit statuses read access to the token to see your repository's checks.",
      };
    if (error instanceof AppError && error.code === "CONFLICT")
      return {
        state: null,
        message: "Reconnect GitHub to see your repository's checks.",
      };
    throw error;
  }
}
