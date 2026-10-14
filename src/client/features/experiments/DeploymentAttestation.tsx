import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { confirmExperimentDeployment } from "@/serverFunctions/experiments";
import { confirmDeploymentInputSchema } from "@/types/schemas/experiments";
import { useRefreshExperiments } from "./queries";

export function DeploymentAttestation({
  projectId,
  experimentId,
  mergedAt,
}: {
  projectId: string;
  experimentId: string;
  mergedAt: string | null;
}) {
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [otherChanges, setOtherChanges] = useState(false);
  const [seasonalRisk, setSeasonalRisk] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const refresh = useRefreshExperiments(projectId);
  const deployedAt =
    date && Number.isFinite(new Date(date).getTime())
      ? new Date(date).toISOString()
      : null;
  const input = confirmDeploymentInputSchema.safeParse({
    projectId,
    experimentId,
    deployedAt,
    note,
    otherChanges,
    seasonalRisk,
    confirmProductionDeployment: authorized,
  });
  const valid =
    input.success &&
    !!deployedAt &&
    !!mergedAt &&
    Date.parse(deployedAt) <= Date.now() &&
    Date.parse(deployedAt) >= Date.now() - 90 * 86_400_000 &&
    Date.parse(deployedAt) >= Date.parse(mergedAt);
  const mutation = useMutation({
    meta: { errorToast: false },
    mutationFn: async () => {
      if (!input.success || !valid)
        throw new Error("Check the production time, note, and confirmation.");
      return confirmExperimentDeployment({ data: input.data });
    },
    onSuccess: (result) => setMessage(result.message),
    onError: () =>
      setMessage(
        "Could not save deployment confirmation. Verify the time and note, refresh the pull request status, then try again.",
      ),
    onSettled: () => {
      setConfirm(false);
      setAuthorized(false);
      return refresh();
    },
  });
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) {
          setMessage(null);
          setConfirm(true);
        }
      }}
    >
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
        <strong>Human-attested production deployment.</strong> GitHub merge is
        not deployment proof. You are asserting that this exact change reached
        production. This does not verify a deployment with GitHub or fetch any
        URL in your note. Once confirmed, the deployment date and measurement
        windows cannot be changed.
      </div>
      <fieldset disabled={mutation.isPending} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="experiment-deployed-at">
            Production deployment time (your local time)
          </Label>
          <Input
            id="experiment-deployed-at"
            type="datetime-local"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            {deployedAt
              ? `Saved as ${deployedAt} (UTC).`
              : "Enter the actual production deployment time within the last 90 days, at or after the recorded merge time, and not in the future."}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="experiment-deployment-note">
            Deployment evidence note
          </Label>
          <Textarea
            id="experiment-deployment-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            required
            maxLength={2000}
            placeholder="How did you verify that this exact change is live?"
          />
        </div>
        <div className="flex items-start gap-3">
          <Checkbox
            id="experiment-other-changes"
            checked={otherChanges}
            onCheckedChange={setOtherChanges}
          />
          <Label
            htmlFor="experiment-other-changes"
            className="text-sm leading-relaxed"
          >
            Other changes may affect this page during the measurement window.
          </Label>
        </div>
        <div className="flex items-start gap-3">
          <Checkbox
            id="experiment-seasonal-risk"
            checked={seasonalRisk}
            onCheckedChange={setSeasonalRisk}
          />
          <Label
            htmlFor="experiment-seasonal-risk"
            className="text-sm leading-relaxed"
          >
            Seasonality or unusual demand may affect the comparison.
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Unchecked flags record that you have not identified these risks, not
          that confounding factors are absent.
        </p>
        <div className="flex items-start gap-3">
          <Checkbox
            id="experiment-confirm-deployment"
            checked={authorized}
            onCheckedChange={setAuthorized}
          />
          <Label
            htmlFor="experiment-confirm-deployment"
            className="text-sm leading-relaxed"
          >
            I confirm that this exact change reached production at the time
            above, and understand this is an immutable human attestation, not
            automated deployment verification.
          </Label>
        </div>
        <Button type="submit" disabled={!valid} pending={mutation.isPending}>
          Confirm production deployment
        </Button>
      </fieldset>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {confirm && (
        <ConfirmDialog
          title="Record this production deployment?"
          confirmLabel="Confirm production deployment"
          pending={mutation.isPending}
          onClose={() => setConfirm(false)}
          onConfirm={() => {
            if (valid) mutation.mutate();
          }}
        >
          Save your human attestation for {deployedAt}. This permanently fixes
          the deployment date, 28-day baseline, and observation window. GitHub
          merge is not proof of deployment. No deployment or remote write is
          performed.
        </ConfirmDialog>
      )}
    </form>
  );
}
