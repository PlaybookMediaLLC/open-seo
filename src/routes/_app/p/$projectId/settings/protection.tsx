import { createFileRoute } from "@tanstack/react-router";
import { ProtectionSettings } from "@/client/features/protection/ProtectionSettings";

// RFC-0026 phase A: the project's protected-site scope and readiness.
export const Route = createFileRoute("/_app/p/$projectId/settings/protection")({
  component: ProtectionRoute,
});

function ProtectionRoute() {
  const { projectId } = Route.useParams();
  return <ProtectionSettings projectId={projectId} />;
}
