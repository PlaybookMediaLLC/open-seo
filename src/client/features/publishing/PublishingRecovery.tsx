import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Label } from "@/client/components/ui/label";
import { recoverPublishingOpportunity } from "@/serverFunctions/publishing";
import { useRefreshPublishing } from "./queries";

export function PublishingRecovery({
  projectId,
  opportunityId,
  expectedVersion,
}: {
  projectId: string;
  opportunityId: string;
  expectedVersion: number;
}) {
  const [authorized, setAuthorized] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const refresh = useRefreshPublishing(projectId);
  const mutation = useMutation({
    meta: { errorToast: false },
    mutationFn: () =>
      recoverPublishingOpportunity({
        data: {
          projectId,
          opportunityId,
          expectedVersion,
          confirmRecovery: true,
        },
      }),
    onSuccess: (result) => setMessage(result.message),
    onError: () =>
      setMessage(
        "Could not verify recovery. Refresh the execution history and try again.",
      ),
    onSettled: () => {
      setConfirm(false);
      setAuthorized(false);
      void refresh();
    },
  });
  return (
    <div className="space-y-3 rounded-lg border border-amber-500/30 p-4">
      <h3 className="text-sm font-semibold">Re-review a failed execution</h3>
      <p className="text-sm text-muted-foreground">
        If the base branch advanced, you can return this opportunity to review
        before preparing a fresh proposal. This check reads GitHub to confirm
        the last failed attempt has no open or merged pull request. The active
        connection must match its repository and base branch.
      </p>
      <p className="text-sm text-muted-foreground">
        Recovery preserves all history and branches, makes no remote writes, and
        moves the opportunity back to Reviewed. Fresh opportunity approval and
        proposal preparation are required before another pull request.
      </p>
      <div className="flex items-start gap-3">
        <Checkbox
          id="authorize-publishing-recovery"
          checked={authorized}
          onCheckedChange={setAuthorized}
          disabled={mutation.isPending}
        />
        <Label
          htmlFor="authorize-publishing-recovery"
          className="text-sm leading-relaxed"
        >
          I authorize the GitHub verification and returning this failed
          opportunity to review if recovery is safe.
        </Label>
      </div>
      <Button
        variant="outline"
        disabled={!authorized}
        pending={mutation.isPending}
        onClick={() => {
          setMessage(null);
          setConfirm(true);
        }}
      >
        Re-review failed execution
      </Button>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {confirm && (
        <ConfirmDialog
          title="Re-review failed execution?"
          confirmLabel="Re-review failed execution"
          pending={mutation.isPending}
          onClose={() => setConfirm(false)}
          onConfirm={() => {
            if (authorized) mutation.mutate();
          }}
        >
          Read GitHub to verify the last failed attempt has no open or merged
          pull request, then return this opportunity to Reviewed. History and
          branches are preserved. This does not write to GitHub or authorize a
          new pull request.
        </ConfirmDialog>
      )}
    </div>
  );
}
