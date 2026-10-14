import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/client/components/ui/button";
import { registerExperiment } from "@/serverFunctions/experiments";
import { useRefreshExperiments } from "./queries";

export function TrackResultsButton({
  projectId,
  executionId,
}: {
  projectId: string;
  executionId: string;
}) {
  const navigate = useNavigate();
  const refresh = useRefreshExperiments(projectId);
  const [message, setMessage] = useState<string | null>(null);
  const mutation = useMutation({
    meta: { errorToast: false },
    mutationFn: () => registerExperiment({ data: { projectId, executionId } }),
    onSuccess: async (result) => {
      await refresh();
      if (result.ok && result.experimentId) {
        await navigate({
          to: "/p/$projectId/experiments/$experimentId",
          params: { projectId, experimentId: result.experimentId },
        });
        return;
      }
      setMessage(result.message);
    },
    onError: () =>
      setMessage(
        "Could not start tracking. Reload the publishing history and retry.",
      ),
  });
  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        pending={mutation.isPending}
        onClick={() => {
          setMessage(null);
          mutation.mutate();
        }}
      >
        Track results
      </Button>
      {message && (
        <p role="status" className="text-xs">
          {message}
        </p>
      )}
    </div>
  );
}
