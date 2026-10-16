import { queryOptions, useQueryClient } from "@tanstack/react-query";
import {
  getProposalRepositoryChecks,
  getPublishingConnection,
  getPublishingOpportunity,
  listProposalDrafts,
  locateProposalFile,
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
// RFC-0004: the page file for an opportunity. Locating costs up to 12 GitHub
// requests, so the key stays outside the refreshed publishing keys.
export const proposalFileOptions = (projectId: string, opportunityId: string) =>
  queryOptions({
    queryKey: ["publishing-file", projectId, opportunityId],
    queryFn: () => locateProposalFile({ data: { projectId, opportunityId } }),
    staleTime: Infinity,
    retry: false,
  });
export const proposalDraftsOptions = (
  projectId: string,
  opportunityId: string,
) =>
  queryOptions({
    queryKey: [...publishingKey(projectId), "drafts", opportunityId],
    queryFn: () => listProposalDrafts({ data: { projectId, opportunityId } }),
  });
export function useRefreshPublishing(projectId: string) {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: publishingKey(projectId) }),
      client.invalidateQueries({ queryKey: opportunityKeys.all(projectId) }),
    ]);
}
