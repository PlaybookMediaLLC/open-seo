import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { confirmRevertDeployed } from "@/serverFunctions/experiments";
import { useRefreshPublishing } from "./queries";

// After the revert pull request merges and ships, the person confirms the
// production time. Relay checks the merge on GitHub before it records it.
export function ConfirmRevertForm({
  projectId,
  proposalId,
}: {
  projectId: string;
  proposalId: string;
}) {
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const refresh = useRefreshPublishing(projectId);
  const deployedAt =
    date && Number.isFinite(new Date(date).getTime())
      ? new Date(date).toISOString()
      : null;
  const mutation = useMutation({
    meta: { errorToast: false },
    mutationFn: () => {
      if (!deployedAt || !confirmed || !note.trim())
        throw new Error("Enter the production time and a note, and confirm.");
      return confirmRevertDeployed({
        data: {
          projectId,
          proposalId,
          deployedAt,
          note,
          confirmProductionDeployment: true,
        },
      });
    },
    onSuccess: (result) => setMessage(result.message),
    onError: () => setMessage("Could not record the revert."),
    onSettled: () => refresh(),
  });
  return (
    <form
      className="space-y-3 border-t pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage(null);
        mutation.mutate();
      }}
    >
      <p className="text-sm font-medium">Confirm the revert shipped</p>
      <div className="space-y-1">
        <Label htmlFor={`revert-time-${proposalId}`}>
          Production deployment time
        </Label>
        <Input
          id={`revert-time-${proposalId}`}
          type="datetime-local"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`revert-note-${proposalId}`}>Note</Label>
        <Textarea
          id={`revert-note-${proposalId}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={2000}
          rows={2}
          required
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`revert-confirm-${proposalId}`}
          checked={confirmed}
          onCheckedChange={(value) => setConfirmed(value)}
        />
        <Label htmlFor={`revert-confirm-${proposalId}`}>
          The merged revert runs in production
        </Label>
      </div>
      <Button
        type="submit"
        size="sm"
        pending={mutation.isPending}
        disabled={!deployedAt || !confirmed || !note.trim()}
      >
        Record the revert
      </Button>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </form>
  );
}
