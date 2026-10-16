import { useQuery } from "@tanstack/react-query";
import { repositoryChecksOptions } from "./queries";

const LABELS = {
  passing: "passing",
  failing: "failing",
  pending: "pending",
  not_configured: "not configured",
} as const;

// The customer's own CI on the pull request. Never called a Relay build.
export function RepositoryChecks({
  projectId,
  proposalId,
}: {
  projectId: string;
  proposalId: string;
}) {
  const query = useQuery(repositoryChecksOptions(projectId, proposalId));
  return (
    <p className="text-sm" role="status">
      <span className="font-medium">Your repository's checks: </span>
      {query.isPending
        ? "loading…"
        : query.isError
          ? "unavailable right now."
          : query.data.state
            ? LABELS[query.data.state]
            : query.data.message}
    </p>
  );
}
