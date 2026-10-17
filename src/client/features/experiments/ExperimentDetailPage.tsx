import { Link } from "@tanstack/react-router";
import { safeHttpUrl } from "@/shared/safe-url";
import { useQuery } from "@tanstack/react-query";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { QueryError } from "@/client/components/QueryState";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { dateLabel } from "@/client/features/opportunities/shared";
import { experimentDetailOptions } from "./queries";
import { AutoRefreshToggle } from "./AutoRefreshToggle";
import { ExperimentActions } from "./ExperimentActions";
import { DownloadCsvButton, Ga4Results } from "./Ga4Measurement";
import { LongTermCheck } from "./LongTermCheck";
import { MeasurementResults } from "./MeasurementResults";
import { PrepareRevert } from "./PrepareRevert";

export function ExperimentDetailPage({
  projectId,
  experimentId,
}: {
  projectId: string;
  experimentId: string;
}) {
  const query = useQuery(experimentDetailOptions(projectId, experimentId));
  const back = (
    <BackLink to="/p/$projectId/experiments" params={{ projectId }}>
      Experiments & Results
    </BackLink>
  );
  if (query.isPending)
    return (
      <div className="p-6 space-y-4">
        {back}
        <p role="status">Loading experiment…</p>
      </div>
    );
  if (query.isError)
    return (
      <div className="p-6 space-y-4">
        {back}
        <QueryError
          fallback="Could not load experiment. It may be unavailable or outside this project."
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  const detail = query.data;
  const { experiment, publishing, runs } = detail;
  const execution = publishing.executions.find(
    (item) => item.id === experiment.executionId,
  );
  const pinned = execution?.pullRequestUrl;
  // Use the shared URL sanitizer, then also require the pinned GitHub PR shape.
  const url =
    pinned &&
    /^https:\/\/github\.com\/[^/?#]+\/[^/?#]+\/pull\/\d+$/.test(pinned)
      ? safeHttpUrl(pinned)
      : null;
  return (
    <div className="overflow-auto page-pad">
      <div className="mx-auto max-w-7xl space-y-5">
        <PageHeader
          title="Experiment results"
          backLink={back}
          description="A recorded change, an explicit deployment attestation, and bounded Search Console evidence."
        />
        <section
          className="rounded-xl border bg-card p-5 space-y-3"
          aria-label="Tracked change"
        >
          <h2 className="text-lg font-semibold">Tracked change</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {(
              [
                ["Target URL", experiment.targetUrl],
                ["Search Console property", experiment.siteUrl],
                [
                  "Repository",
                  `${publishing.connection.owner}/${publishing.connection.repository}`,
                ],
                ["Base branch", publishing.connection.baseBranch],
                ["File", publishing.proposal.filePath],
                ["Approved commit", execution?.commitSha ?? "Unavailable"],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="break-all font-mono text-xs">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <Link
                  to="/p/$projectId/opportunities/$opportunityId"
                  params={{
                    projectId,
                    opportunityId: experiment.opportunityId,
                  }}
                />
              }
            >
              View proposal and approval history
            </Button>
            {url && (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <a href={url} target="_blank" rel="noopener noreferrer" />
                }
              >
                View pinned pull request
              </Button>
            )}
          </div>
        </section>
        <ExperimentActions
          experiment={experiment}
          signals={detail.signals}
          canManage={detail.canManage}
          configured={detail.configured}
          connected={detail.connected}
          githubConnected={detail.githubConnected}
        />
        {experiment.deployedAt && (
          <AutoRefreshToggle
            projectId={projectId}
            experimentId={experiment.id}
          />
        )}
        <MeasurementResults detail={detail} assessment={detail.assessment} />
        <Ga4Results detail={detail} />
        <LongTermCheck detail={detail} canManage={detail.canManage} />
        {detail.canManage &&
          experiment.pullRequestState === "merged" &&
          !detail.publishing.proposal.revertsProposalId && (
            <PrepareRevert
              projectId={projectId}
              experimentId={experiment.id}
              opportunityId={experiment.opportunityId}
              negative={detail.assessment.outcome === "negative"}
            />
          )}
        <section className="space-y-3" aria-label="Measurement run history">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Measurement run history</h2>
            {detail.latestRun && (
              <DownloadCsvButton
                projectId={projectId}
                experimentId={experiment.id}
              />
            )}
          </div>
          {!runs.length ? (
            <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
              No measurement attempts. Loading this page does not call Search
              Console.
            </p>
          ) : (
            <ol className="space-y-3">
              {runs.map((run) => (
                <li
                  key={run.id}
                  className="rounded-xl border bg-card p-4 space-y-2 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        run.status === "failed" ? "destructive" : "outline"
                      }
                    >
                      {run.status}
                    </Badge>
                    <span>
                      {run.status === "completed"
                        ? run.outcome
                        : "No final assessment from this attempt"}
                      {run.window === "long_term" && " (long-term check)"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Started {dateLabel(run.startedAt)}
                    {run.finishedAt
                      ? ` · Finished ${dateLabel(run.finishedAt)}`
                      : " · Not finished"}
                  </p>
                  <p className="break-all text-xs text-muted-foreground">
                    Requested by {run.requestedBy} · Search Analytics requests
                    reserved: {run.requestCount}
                  </p>
                  <p>{run.explanation}</p>
                  {run.error && (
                    <p
                      role="alert"
                      className="text-destructive whitespace-pre-wrap break-words"
                    >
                      {run.error}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {run.includesBaseline
                      ? "Includes historical baseline capture"
                      : "Saved baseline retained"}{" "}
                    · Observation through{" "}
                    {run.observationThrough ?? "not available"} ·{" "}
                    {run.windowComplete
                      ? "Window complete"
                      : "Window incomplete"}
                  </p>
                  {experiment.baselineRunId === run.id && (
                    <p className="text-xs font-medium">
                      This run captured the immutable baseline. Its collection
                      date is not the dates of the historical observations.
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
