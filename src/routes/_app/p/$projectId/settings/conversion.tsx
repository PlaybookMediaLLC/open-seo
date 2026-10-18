import { createFileRoute } from "@tanstack/react-router";
import { ConversionSettings } from "@/client/features/conversion/ConversionSettings";

// RFC-0012 5.8: the tracking gate and the chosen conversion.
export const Route = createFileRoute("/_app/p/$projectId/settings/conversion")({
  component: ConversionRoute,
});

function ConversionRoute() {
  const { projectId } = Route.useParams();
  return <ConversionSettings projectId={projectId} />;
}
