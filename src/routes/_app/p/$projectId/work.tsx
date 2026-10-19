import { createFileRoute } from "@tanstack/react-router";
import { ThisWeekPage } from "@/client/features/work/ThisWeekPage";

// RFC-0018 5.9: the project's weekly work view.
export const Route = createFileRoute("/_app/p/$projectId/work")({
  component: ThisWeekRoute,
});

function ThisWeekRoute() {
  const { projectId } = Route.useParams();
  return <ThisWeekPage key={projectId} projectId={projectId} />;
}
