import { createFileRoute } from "@tanstack/react-router";
import { ProjectSpending } from "@/client/features/spend/ProjectSpending";

// RFC-0009 5.5: the project's monthly credit limit.
export const Route = createFileRoute("/_app/p/$projectId/settings/spending")({
  component: SpendingRoute,
});

function SpendingRoute() {
  const { projectId } = Route.useParams();
  return <ProjectSpending projectId={projectId} />;
}
