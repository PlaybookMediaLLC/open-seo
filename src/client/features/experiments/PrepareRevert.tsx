import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/client/components/ui/button";
import { prepareRevertProposal } from "@/serverFunctions/experiments";
import { useRefreshExperiments } from "./queries";

// Prepares the exact inverse of the merged change as a new proposal. Approval
// and the pull request happen on the opportunity page, like any change.
export function PrepareRevert({
  projectId,
  experimentId,
  opportunityId,
  negative,
}: {
  projectId: string;
  experimentId: string;
  opportunityId: string;
  negative: boolean;
}) {
  const [result, setResult] = useState<{ ok: boolean; message: string }>();
  const refresh = useRefreshExperiments(projectId);
  const mutation = useMutation({
    meta: { errorToast: false },
    mutationFn: () =>
      prepareRevertProposal({ data: { projectId, experimentId } }),
    onSuccess: setResult,
    onError: () =>
      setResult({ ok: false, message: "Could not prepare the revert." }),
    onSettled: () => refresh(),
  });
  return (
    <section
      className="rounded-xl border bg-card p-5 space-y-3"
      aria-label="Revert"
    >
      <h2 className="text-lg font-semibold">Revert this change</h2>
      <p className="text-sm text-muted-foreground">
        {negative ? "The result is negative. " : ""}
        Relay can prepare a proposal that restores the earlier text. It checks
        that the page still shows the approved text, and writes nothing to
        GitHub until you approve it.
      </p>
      <Button
        variant={negative ? "default" : "outline"}
        pending={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        Prepare revert
      </Button>
      {result && (
        <p role="status" className="text-sm">
          {result.message}{" "}
          {result.ok && (
            <Link
              to="/p/$projectId/opportunities/$opportunityId"
              params={{ projectId, opportunityId }}
              className="underline"
            >
              Open the opportunity
            </Link>
          )}
        </p>
      )}
    </section>
  );
}
