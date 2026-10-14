import { createFileRoute } from "@tanstack/react-router";
import { ExperimentsPage } from "@/client/features/experiments/ExperimentsPage";

export const Route = createFileRoute("/_app/p/$projectId/experiments/")({
  component: ExperimentsRoute,
});

function ExperimentsRoute() {
  const { projectId } = Route.useParams();
  return <ExperimentsPage key={projectId} projectId={projectId} />;
}
