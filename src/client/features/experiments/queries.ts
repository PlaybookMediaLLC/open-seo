import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { getExperiment, listExperiments } from "@/serverFunctions/experiments";
import { opportunityKeys } from "@/client/features/opportunities/shared";

const experimentKeys = {
  all: (projectId: string) => ["experiments", projectId] as const,
};
export const experimentListOptions = (projectId: string, offset: number) =>
  queryOptions({
    queryKey: [...experimentKeys.all(projectId), "list", offset],
    queryFn: () => listExperiments({ data: { projectId, offset, limit: 50 } }),
    staleTime: 0,
  });
export const experimentDetailOptions = (
  projectId: string,
  experimentId: string,
) =>
  queryOptions({
    queryKey: [...experimentKeys.all(projectId), "detail", experimentId],
    queryFn: () => getExperiment({ data: { projectId, experimentId } }),
    staleTime: 0,
  });
export function useRefreshExperiments(projectId: string) {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: experimentKeys.all(projectId) }),
      client.invalidateQueries({ queryKey: opportunityKeys.all(projectId) }),
      client.invalidateQueries({ queryKey: ["publishing", projectId] }),
    ]);
}
