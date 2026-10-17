import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { getExperiment, listExperiments } from "@/serverFunctions/experiments";
import { opportunityKeys } from "@/client/features/opportunities/shared";
import type { ExperimentLabel } from "@/types/schemas/experiments";

const experimentKeys = {
  all: (projectId: string) => ["experiments", projectId] as const,
};
export const experimentListOptions = (
  projectId: string,
  offset: number,
  label?: ExperimentLabel,
) =>
  queryOptions({
    queryKey: [...experimentKeys.all(projectId), "list", offset, label],
    queryFn: () =>
      listExperiments({ data: { projectId, offset, limit: 50, label } }),
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
