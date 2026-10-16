import { createFileRoute } from "@tanstack/react-router";
import { ProjectPageHeader } from "@/client/features/projects/ProjectPageHeader";
import { ProjectContextPage } from "@/client/features/projects/project-context/ProjectContextPage";
import { BrandTermsSection } from "@/client/features/opportunities/BrandTermsSection"; // playbook-seam

export const Route = createFileRoute("/_app/p/$projectId/context")({
  component: ProjectContextRoute,
});

function ProjectContextRoute() {
  const { projectId } = Route.useParams();
  return (
    <div className="h-full overflow-auto page-pad">
      <div className="mx-auto max-w-7xl space-y-8">
        <ProjectPageHeader projectId={projectId} title="Context" />

        <ProjectContextPage projectId={projectId} />
        <BrandTermsSection projectId={projectId} /* playbook-seam */ />
      </div>
    </div>
  );
}
