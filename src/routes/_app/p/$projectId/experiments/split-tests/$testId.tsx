import { createFileRoute } from "@tanstack/react-router";
import { SplitTestPage } from "@/client/features/split-tests/SplitTestPage";

export const Route = createFileRoute(
  "/_app/p/$projectId/experiments/split-tests/$testId",
)({ component: SplitTestRoute });

function SplitTestRoute() {
  const { projectId, testId } = Route.useParams();
  return (
    <SplitTestPage
      key={`${projectId}:${testId}`}
      projectId={projectId}
      testId={testId}
    />
  );
}
