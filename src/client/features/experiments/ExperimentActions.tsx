import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { dateLabel } from "@/client/features/opportunities/shared";
import {
  refreshExperimentMeasurements,
  refreshExperimentPullRequest,
} from "@/serverFunctions/experiments";
import type {
  DeploymentSignal,
  GrowthExperiment,
} from "@/types/schemas/experiments";
import { DeploymentAttestation } from "./DeploymentAttestation";
import { DeploymentSignals } from "./DeploymentSignals";
import { useRefreshExperiments } from "./queries";

export function ExperimentActions({
  experiment,
  signals,
  canManage,
  configured,
  connected,
  githubConnected,
}: {
  experiment: GrowthExperiment;
  signals: DeploymentSignal[];
  canManage: boolean;
  configured: boolean;
  connected: boolean;
  githubConnected: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const refresh = useRefreshExperiments(experiment.projectId);
  const data = { projectId: experiment.projectId, experimentId: experiment.id };
  const pullRequest = useMutation({
    meta: { errorToast: false },
    mutationFn: () => refreshExperimentPullRequest({ data }),
    onSuccess: (result) => setMessage(result.message),
    onError: () =>
      setMessage(
        "Could not verify the pull request. Check the GitHub connection and retry explicitly.",
      ),
    onSettled: refresh,
  });
  const measurement = useMutation({
    meta: { errorToast: false },
    mutationFn: () => refreshExperimentMeasurements({ data }),
    onSuccess: (result) => setMessage(result.message),
    onError: () =>
      setMessage(
        "Could not refresh measurements. Review the run history and Search Console connection before retrying.",
      ),
    onSettled: refresh,
  });
  const busy = pullRequest.isPending || measurement.isPending;
  const canCheckGithub = canManage && configured && githubConnected;
  return (
    <div className="space-y-4">
      {!canManage && (
        <p className="rounded-lg border p-3 text-sm text-muted-foreground">
          Read-only access. Only project owners and administrators can refresh
          providers or attest to production deployment.
        </p>
      )}
      <section
        className="rounded-xl border bg-card p-5 space-y-4"
        aria-label="Pull request status"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Pull request status</h2>
          <Badge variant="outline">{experiment.pullRequestState}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {experiment.pullRequestCheckedAt
            ? `Last checked ${dateLabel(experiment.pullRequestCheckedAt)}.`
            : "Not checked yet."}{" "}
          Status is never refreshed automatically. A merge is not proof of
          production deployment.
        </p>
        {experiment.mergedAt && (
          <p className="text-sm break-all">
            Merged {dateLabel(experiment.mergedAt)}
            {experiment.mergeCommitSha ? ` · ${experiment.mergeCommitSha}` : ""}
          </p>
        )}
        {canManage && (
          <>
            <p className="text-sm text-muted-foreground">
              Refresh performs read-only GitHub checks against the pinned pull
              request and approved change. It does not merge, deploy, or write
              to the repository.
            </p>
            {!canCheckGithub && (
              <p className="text-sm text-muted-foreground">
                An encryption-configured, active GitHub connection to the same
                repository and base branch is required.
              </p>
            )}
            <Button
              variant="outline"
              pending={pullRequest.isPending}
              disabled={!canCheckGithub || busy}
              onClick={() => {
                setMessage(null);
                pullRequest.mutate();
              }}
            >
              Refresh GitHub status
            </Button>
          </>
        )}
      </section>
      <section
        className="rounded-xl border bg-card p-5 space-y-4"
        aria-label="Production deployment"
      >
        <h2 className="text-lg font-semibold">Production deployment</h2>
        {experiment.deployedAt ? (
          <div className="space-y-3 text-sm">
            <Badge variant="outline">
              {experiment.deploymentBasis === "verified"
                ? "Verified by GitHub and the live page · immutable"
                : "Human-attested · immutable"}
            </Badge>
            <p>Production time: {dateLabel(experiment.deployedAt)}</p>
            <p className="text-muted-foreground">
              {experiment.deploymentBasis === "verified"
                ? "The time comes from GitHub's successful production deployment of the merge commit. The live page showed the approved text."
                : `Attested by ${experiment.deploymentConfirmedBy}${
                    experiment.deploymentConfirmedAt
                      ? ` on ${dateLabel(experiment.deploymentConfirmedAt)}`
                      : ""
                  }. This is not GitHub-verified deployment proof.`}
            </p>
            <p className="whitespace-pre-wrap break-words rounded-lg bg-muted p-3">
              {experiment.deploymentNote}
            </p>
            <p>
              Other changes:{" "}
              {experiment.otherChanges ? "reported" : "not reported"} · Seasonal
              risk: {experiment.seasonalRisk ? "reported" : "not reported"}
            </p>
          </div>
        ) : canCheckGithub &&
          connected &&
          experiment.pullRequestState === "merged" ? (
          <>
            <DeploymentSignals
              projectId={experiment.projectId}
              experimentId={experiment.id}
              signals={signals}
            />
            <DeploymentAttestation
              projectId={experiment.projectId}
              experimentId={experiment.id}
              mergedAt={experiment.mergedAt}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Not confirmed. An administrator must verify the pull request is
            merged, retain the matching GitHub and Search Console connections,
            then explicitly attest to the actual production deployment. GitHub
            merge alone is insufficient.
          </p>
        )}
      </section>
      <section
        className="rounded-xl border bg-card p-5 space-y-4"
        aria-label="Measurement refresh"
      >
        <h2 className="text-lg font-semibold">Refresh measurements</h2>
        <p className="text-sm text-muted-foreground">
          One explicit refresh uses at most one Search Console Search Analytics
          request with up to 100 daily rows, plus an OAuth token refresh if
          needed. At most 5 attempts per project in a rolling 24 hours.
          Successful results are cached for 24 hours; failed attempts have a
          5-minute cooldown. No paid provider calls or automatic measurements.
        </p>
        <p className="text-sm text-muted-foreground">
          Measurement requires the same Search Console property and a confirmed
          production deployment. It keeps working after GitHub is disconnected.
        </p>
        {!connected && (
          <p className="text-sm text-muted-foreground">
            Reconnect the experiment's original Search Console property to
            request measurements.
          </p>
        )}
        {canManage && (
          <Button
            pending={measurement.isPending}
            disabled={!experiment.deployedAt || !connected || busy}
            onClick={() => {
              setMessage(null);
              measurement.mutate();
            }}
          >
            Refresh Search Console measurements
          </Button>
        )}
      </section>
      {message && (
        <p role="status" className="rounded-lg border p-3 text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
