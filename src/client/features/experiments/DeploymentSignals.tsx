import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Label } from "@/client/components/ui/label";
import {
  confirmVerifiedDeployment,
  refreshDeploymentSignals,
} from "@/serverFunctions/experiments";
import type { DeploymentSignal } from "@/types/schemas/experiments";
import { useRefreshExperiments } from "./queries";

const KIND_LABELS: Record<DeploymentSignal["kind"], string> = {
  github_deployment: "GitHub deployment",
  live_content_match: "Live page",
  human_attestation: "Your attestation",
};

// Read-only evidence that the merged change reached production. Measurement
// can start on the verified basis only when both GitHub and the live page agree.
export function DeploymentSignals({
  projectId,
  experimentId,
  signals,
}: {
  projectId: string;
  experimentId: string;
  signals: DeploymentSignal[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [otherChanges, setOtherChanges] = useState(false);
  const [seasonalRisk, setSeasonalRisk] = useState(false);
  const refresh = useRefreshExperiments(projectId);
  const check = useMutation({
    meta: { errorToast: false },
    mutationFn: () =>
      refreshDeploymentSignals({ data: { projectId, experimentId } }),
    onSuccess: (result) => setMessage(result.message),
    onError: () => setMessage("Could not check deployment signals."),
    onSettled: () => refresh(),
  });
  const verify = useMutation({
    meta: { errorToast: false },
    mutationFn: () =>
      confirmVerifiedDeployment({
        data: { projectId, experimentId, otherChanges, seasonalRisk },
      }),
    onSuccess: (result) => setMessage(result.message),
    onError: () => setMessage("Could not start measurement."),
    onSettled: () => refresh(),
  });
  const verified =
    signals.some((signal) => signal.kind === "github_deployment") &&
    signals.some((signal) => signal.kind === "live_content_match");
  return (
    <div className="space-y-3 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">Deployment signals</p>
        <Button
          variant="outline"
          size="sm"
          pending={check.isPending}
          onClick={() => {
            setMessage(null);
            check.mutate();
          }}
        >
          Check signals
        </Button>
      </div>
      {signals.length ? (
        <ul className="space-y-2">
          {signals.map((signal) => (
            <li key={signal.id}>
              <span className="font-medium">{KIND_LABELS[signal.kind]}</span>
              {" · "}
              {new Date(signal.effectiveAt).toLocaleString()}
              <p className="text-muted-foreground">{signal.detail}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">
          No signals yet. Relay reads GitHub deployments of the merge commit and
          the live page. Nothing is changed.
        </p>
      )}
      {verified && (
        <div className="space-y-2 border-t pt-3">
          <p>
            GitHub and the live page both confirm the change. Measurement can
            start from the GitHub deployment time. Declare anything else that
            could move results.
          </p>
          <div className="flex items-center gap-2">
            <Checkbox
              id="verified-other-changes"
              checked={otherChanges}
              onCheckedChange={(value) => setOtherChanges(value)}
            />
            <Label htmlFor="verified-other-changes">
              Other changes to this page or site shipped in the same period
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="verified-seasonal-risk"
              checked={seasonalRisk}
              onCheckedChange={(value) => setSeasonalRisk(value)}
            />
            <Label htmlFor="verified-seasonal-risk">
              Seasonal demand may differ between the two periods
            </Label>
          </div>
          <Button
            size="sm"
            pending={verify.isPending}
            onClick={() => {
              setMessage(null);
              verify.mutate();
            }}
          >
            Start measurement on the verified basis
          </Button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
