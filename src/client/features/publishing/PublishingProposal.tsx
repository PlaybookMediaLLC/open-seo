import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { dateLabel } from "@/client/features/opportunities/shared";
import { TrackResultsButton } from "@/client/features/experiments/TrackResultsButton";
import { executeMetadataProposal } from "@/serverFunctions/publishing";
import type { ProposalWithHistory } from "@/types/schemas/publishing";
import { useRefreshPublishing } from "./queries";
import { ConfirmRevertForm } from "./ConfirmRevertForm";
import { RepositoryChecks } from "./RepositoryChecks";

export function PublishingProposal({
  history,
  canExecute,
  canTrack,
  canConfirmRevert,
  blockedReason,
}: {
  history: ProposalWithHistory;
  canExecute: boolean;
  canTrack: boolean;
  canConfirmRevert: boolean;
  blockedReason: string | null;
}) {
  const { proposal, connection, executions } = history;
  const refresh = useRefreshPublishing(proposal.projectId);
  const [authorized, setAuthorized] = useState(false);
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const hasRunning = executions.some(
    (execution) => execution.status === "running",
  );
  useEffect(() => {
    if (!hasRunning) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasRunning]);
  const succeeded = executions.some(
    (execution) => execution.status === "succeeded",
  );
  const leased = executions.some(
    (execution) =>
      execution.status === "running" &&
      now - new Date(execution.startedAt).getTime() < 180_000,
  );
  const mutation = useMutation({
    meta: { errorToast: false },
    mutationFn: () =>
      executeMetadataProposal({
        data: {
          projectId: proposal.projectId,
          proposalId: proposal.id,
          changeHash: proposal.changeHash,
          authorizePullRequest: true,
          note,
        },
      }),
    onSuccess: (result) => setMessage(result.message),
    onError: () =>
      setMessage(
        "Could not complete this attempt. Review the refreshed execution history before explicitly approving a retry.",
      ),
    onSettled: () => {
      setConfirm(false);
      setAuthorized(false);
      void refresh();
    },
  });
  const disabledReason = succeeded
    ? "A pull request has already been created for this proposal."
    : (blockedReason ??
      (leased
        ? "An execution is running. Retry becomes available after the 180-second lease expires, subject to server verification."
        : null));
  const allowed = canExecute && !disabledReason && !mutation.isPending;
  return (
    <article className="overflow-hidden rounded-xl border bg-card">
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap justify-between gap-2">
          <div>
            <h3 className="font-semibold">Verified metadata proposal</h3>
            <p className="text-xs text-muted-foreground">
              Prepared {dateLabel(proposal.createdAt)} · Immutable snapshot
            </p>
          </div>
          <Badge variant={succeeded ? "success" : "outline"}>
            {succeeded ? "Pull request created" : "Review required"}
            {proposal.revertsProposalId ? " · Revert" : ""}
          </Badge>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {(
            [
              ["Target URL", proposal.targetUrl],
              ["Repository", `${connection.owner}/${connection.repository}`],
              ["Base branch", connection.baseBranch],
              ["File (repository-relative)", proposal.filePath],
              ["Root directory", connection.rootDirectory || "/"],
              ["Base commit SHA", proposal.baseSha],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="break-all font-mono text-xs">{value}</dd>
            </div>
          ))}
        </dl>
        {(
          [
            proposal.titleAfter !== null && [
              "Title",
              proposal.titleBeforeSnippet,
              proposal.titleAfterSnippet,
            ],
            proposal.descriptionAfter !== proposal.descriptionBefore && [
              "Description",
              proposal.beforeSnippet,
              proposal.afterSnippet,
            ],
          ] as const
        )
          .filter((diff) => diff !== false)
          .map(([field, before, after]) => (
            <div key={field} className="grid gap-3 lg:grid-cols-2">
              <div className="min-w-0 rounded-lg border border-red-500/20 bg-red-500/5">
                <p className="border-b border-red-500/20 px-3 py-2 text-xs font-medium">
                  − {field} before
                </p>
                <pre className="overflow-auto p-3 text-xs whitespace-pre-wrap break-words">
                  <code>{before}</code>
                </pre>
              </div>
              <div className="min-w-0 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                <p className="border-b border-emerald-500/20 px-3 py-2 text-xs font-medium">
                  + {field} after
                </p>
                <pre className="overflow-auto p-3 text-xs whitespace-pre-wrap break-words">
                  <code>{after}</code>
                </pre>
              </div>
            </div>
          ))}
        <dl className="space-y-3 text-sm">
          {(
            [
              ["Reason", proposal.reason],
              ["Expected effect", proposal.expectedEffect],
              ["Risk", proposal.risk],
              ["Verification plan", proposal.verificationPlan],
              ["Static validation", proposal.validationSummary],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt className="font-medium">{label}</dt>
              <dd className="whitespace-pre-wrap text-muted-foreground">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="rounded-lg bg-muted p-3 text-sm">
          Repository build and CI have not been run. Static validation is not
          proof of a successful build or a search performance improvement.
        </p>
        {succeeded && (
          <>
            <RepositoryChecks
              projectId={proposal.projectId}
              proposalId={proposal.id}
            />
            {canConfirmRevert && (
              <ConfirmRevertForm
                projectId={proposal.projectId}
                proposalId={proposal.id}
              />
            )}
            <p className="text-sm">
              The opportunity is in progress, not implemented. Review and merge
              the pull request through your own process.
            </p>
          </>
        )}
        {disabledReason && (
          <p className="text-sm text-muted-foreground">{disabledReason}</p>
        )}
        {canExecute && !succeeded && (
          <fieldset disabled={!allowed} className="space-y-3 border-t pt-4">
            <p className="text-sm">
              Approval creates a branch, commit, and pull request and may
              trigger your repository's CI. It never merges or deploys changes.
            </p>
            {executions.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Retry this same immutable proposal only after reviewing earlier
                attempts. The server checks whether execution can safely resume.
              </p>
            )}
            <Label htmlFor={`note-${proposal.id}`}>
              Approval note (optional)
            </Label>
            <Textarea
              id={`note-${proposal.id}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={2000}
              placeholder="Why this exact change is ready for a pull request"
            />
            <div className="flex items-start gap-3">
              <Checkbox
                id={`authorize-${proposal.id}`}
                checked={authorized}
                onCheckedChange={setAuthorized}
              />
              <Label
                htmlFor={`authorize-${proposal.id}`}
                className="text-sm leading-relaxed"
              >
                I reviewed this exact diff and authorize creating a pull request
                {executions.length > 0
                  ? " or retrying this proposal"
                  : ""} in {connection.owner}/{connection.repository}.
              </Label>
            </div>
            <Button
              disabled={!authorized || !allowed}
              pending={mutation.isPending}
              onClick={() => {
                setMessage(null);
                setConfirm(true);
              }}
            >
              Approve and create pull request
            </Button>
          </fieldset>
        )}
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </div>
      <ExecutionHistory history={history} canTrack={canTrack} />
      {confirm && (
        <ConfirmDialog
          title="Create this pull request?"
          confirmLabel="Approve and create pull request"
          pending={mutation.isPending}
          onClose={() => setConfirm(false)}
          onConfirm={() => {
            if (allowed && authorized) mutation.mutate();
            else setConfirm(false);
          }}
        >
          Create a branch, commit, and pull request in {connection.owner}/
          {connection.repository}, targeting {connection.baseBranch}, for{" "}
          {proposal.filePath}. This may trigger customer CI. Nothing will be
          merged or deployed.
        </ConfirmDialog>
      )}
    </article>
  );
}

function ExecutionHistory({
  history,
  canTrack,
}: {
  history: ProposalWithHistory;
  canTrack: boolean;
}) {
  const { proposal, approvals, executions, events } = history;
  return (
    <div className="space-y-3 border-t bg-muted/20 p-5">
      <h4 className="text-sm font-semibold">Execution history</h4>
      {!executions.length ? (
        <p className="text-sm text-muted-foreground">
          No execution attempts. Nothing has been written to GitHub.
        </p>
      ) : (
        <ol className="space-y-3">
          {executions.map((execution) => {
            const approval = approvals.find(
              (item) => item.id === execution.approvalId,
            );
            const url = execution.pullRequestUrl;
            const safeLink =
              url &&
              /^https:\/\/github\.com\/[^/?#]+\/[^/?#]+\/pull\/\d+$/.test(url);
            return (
              <li
                key={execution.id}
                className="space-y-2 rounded-lg border bg-card p-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      execution.status === "failed"
                        ? "destructive"
                        : execution.status === "succeeded"
                          ? "success"
                          : "secondary"
                    }
                  >
                    {execution.status}
                  </Badge>
                  <span>{execution.phase.replaceAll("_", " ")}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Started {dateLabel(execution.startedAt)}
                  {execution.finishedAt
                    ? ` · Finished ${dateLabel(execution.finishedAt)}`
                    : " · Not finished"}
                </p>
                <p className="break-all font-mono text-xs">
                  Branch: {execution.branchName || "Not created"}
                  {execution.commitSha
                    ? ` · Commit: ${execution.commitSha}`
                    : ""}
                </p>
                {approval && (
                  <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                    Approved {dateLabel(approval.createdAt)} by{" "}
                    {approval.actorUserId}
                    {approval.note ? ` · ${approval.note}` : ""}
                  </p>
                )}
                {execution.error && (
                  <p className="whitespace-pre-wrap break-words text-destructive">
                    {execution.error}
                  </p>
                )}
                {safeLink && (
                  <Button
                    variant="link"
                    size="sm"
                    nativeButton={false}
                    render={
                      <a href={url} target="_blank" rel="noopener noreferrer" />
                    }
                  >
                    View pull request #{execution.pullRequestNumber}
                  </Button>
                )}
                {canTrack &&
                  execution.status === "succeeded" &&
                  execution.pullRequestNumber && (
                    <TrackResultsButton
                      projectId={proposal.projectId}
                      executionId={execution.id}
                    />
                  )}
                <ol className="space-y-1 border-l pl-3 text-xs text-muted-foreground">
                  {events
                    .filter((event) => event.executionId === execution.id)
                    .map((event) => (
                      <li key={event.id}>
                        <time dateTime={event.createdAt}>
                          {dateLabel(event.createdAt)}
                        </time>{" "}
                        · {event.phase.replaceAll("_", " ")}: {event.message}
                      </li>
                    ))}
                </ol>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
