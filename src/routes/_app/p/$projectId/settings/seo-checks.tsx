import { createFileRoute } from "@tanstack/react-router";
import { SeoChecksSettings } from "@/client/features/seo-checks/SeoChecksSettings";

// RFC-0010 5.11: SEO checks on pull requests.
export const Route = createFileRoute("/_app/p/$projectId/settings/seo-checks")({
  component: SeoChecksRoute,
});

function SeoChecksRoute() {
  const { projectId } = Route.useParams();
  return <SeoChecksSettings projectId={projectId} />;
}
