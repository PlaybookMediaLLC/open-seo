import { queryOptions, useQueryClient } from "@tanstack/react-query";
import {
  getProposalRepositoryChecks,
  getPublishingConnection,
  getPublishingOpportunity,
} from "@/serverFunctions/publishing";
import { opportunityKeys } from "@/client/features/opportunities/shared";

const publishingKey = (projectId: string) => ["publishing", projectId] as const;
export const publishingConnectionOptions = (projectId: string) =>
  queryOptions({
    queryKey: [...publishingKey(projectId), "connection"],
    queryFn: () => getPublishingConnection({ data: { projectId } }),
    staleTime: 0,
  });
export const publishingOpportunityOptions = (
  projectId: string,
  opportunityId: string,
) =>
  queryOptions({
    queryKey: [...publishingKey(projectId), "opportunity", opportunityId],
    queryFn: () =>
      getPublishingOpportunity({ data: { projectId, opportunityId } }),
    staleTime: 0,
    refetchInterval: (query) =>
      query.state.data?.proposals.some((item) =>
        item.executions.some((execution) => execution.status === "running"),
      )
        ? 10_000
        : false,
  });
// The repository's own checks, cached for 60 seconds (RFC-0005 5.5).
export const repositoryChecksOptions = (
  projectId: string,
  proposalId: string,
) =>
  queryOptions({
    queryKey: [...publishingKey(projectId), "checks", proposalId],
    queryFn: () =>
      getProposalRepositoryChecks({ data: { projectId, proposalId } }),
    staleTime: 60_000,
  });
export function useRefreshPublishing(projectId: string) {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: publishingKey(projectId) }),
      client.invalidateQueries({ queryKey: opportunityKeys.all(projectId) }),
    ]);
}
