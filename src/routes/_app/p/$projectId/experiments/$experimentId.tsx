import { createFileRoute } from "@tanstack/react-router";
import { ExperimentDetailPage } from "@/client/features/experiments/ExperimentDetailPage";

export const Route = createFileRoute(
  "/_app/p/$projectId/experiments/$experimentId",
)({ component: ExperimentRoute });

function ExperimentRoute() {
  const { projectId, experimentId } = Route.useParams();
  return (
    <ExperimentDetailPage
      key={`${projectId}:${experimentId}`}
      projectId={projectId}
      experimentId={experimentId}
    />
  );
}
