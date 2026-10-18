import { createFileRoute } from "@tanstack/react-router";
import { AutomationSettings } from "@/client/features/automation/AutomationSettings";

// RFC-0008 5.10: the project's scheduled growth jobs.
export const Route = createFileRoute("/_app/p/$projectId/settings/automation")({
  component: AutomationRoute,
});

function AutomationRoute() {
  const { projectId } = Route.useParams();
  return <AutomationSettings projectId={projectId} />;
}
