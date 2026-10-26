import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AiResearchSetupGate } from "@/client/features/ai-visibility/AiResearchSetupGate";
import {
  aiResearchSetupQueryOptions,
  aiTrackerQueryOptions,
} from "@/client/features/ai-visibility/shared";
import { OpenRouterKeyGate } from "@/client/features/ai-visibility/OpenRouterKeyGate";
import { ProjectWebsiteGate } from "@/client/features/projects/ProjectWebsiteGate";
import { queryClient } from "@/client/tanstack-db/queryClient";

export const Route = createFileRoute("/_app/p/$projectId/ai-visibility")({
  // The setup gate below mounts only after the website gate, and each page
  // here only after setup. Start setup and the tracker every page reads
  // together on link intent and on a full load, without holding up navigation.
  loader: ({ params }) => {
    void queryClient.prefetchQuery(
      aiResearchSetupQueryOptions(params.projectId),
    );
    void queryClient.prefetchQuery(aiTrackerQueryOptions(params.projectId));
  },
  component: AiVisibilityLayout,
});

function AiVisibilityLayout() {
  const { projectId } = Route.useParams();
  return (
    <div className="overflow-auto page-pad">
      <div className="mx-auto max-w-7xl space-y-5" key={projectId}>
        <OpenRouterKeyGate projectId={projectId} untilSetupReady>
          <ProjectWebsiteGate projectId={projectId}>
            <AiResearchSetupGate projectId={projectId}>
              <Outlet />
            </AiResearchSetupGate>
          </ProjectWebsiteGate>
        </OpenRouterKeyGate>
      </div>
    </div>
  );
}
