import { PrepareMetadataForm } from "./PrepareMetadataForm";
import { sortBy } from "remeda";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CardShell } from "@/client/components/CardShell";
import { QueryError } from "@/client/components/QueryState";
import { Button } from "@/client/components/ui/button";
import type { Opportunity } from "@/types/schemas/opportunities";
import { publishingOpportunityOptions } from "./queries";
import { PublishingRecovery } from "./PublishingRecovery";
import { GithubIssueCard } from "./GithubIssueCard";
import { CodeChangeSheets } from "./CopyTextSheet";
import { PublishingProposal } from "./PublishingProposal";

export function PublishingOpportunityPanel({
  opportunity,
  readOnly = false,
}: {
  opportunity: Pick<
    Opportunity,
    "id" | "projectId" | "url" | "status" | "version" | "type"
  > & { accessibilityRule?: string; performanceCauses?: string };
  readOnly?: boolean;
}) {
  const { projectId, id } = opportunity;
  const query = useQuery(publishingOpportunityOptions(projectId, id));
  if (query.isPending)
    return (
      <CardShell title="Metadata publishing">
        <p role="status" className="text-sm text-muted-foreground">
          Loading proposals…
        </p>
      </CardShell>
    );
  if (query.isError && !query.data)
    return (
      <CardShell title="Metadata publishing">
        <QueryError
          fallback="Could not load publishing proposals"
          onRetry={() => void query.refetch()}
        />
      </CardShell>
    );
  const {
    configured,
    canManage,
    canApprove,
    connection,
    proposals,
    appRevoked,
  } = query.data;
  const activeConnection = connection && !connection.revokedAt && !appRevoked;
  const enabled =
    configured &&
    canManage &&
    !readOnly &&
    !query.isError &&
    !!activeConnection;
  const latestAttempt = sortBy(
    proposals.flatMap((history) =>
      history.executions.map((execution) => ({
        execution,
        connection: history.connection,
      })),
    ),
    [(attempt) => Date.parse(attempt.execution.startedAt), "desc"],
  )[0];
  const canRecover =
    enabled &&
    opportunity.status === "failed" &&
    latestAttempt?.execution.status === "failed" &&
    latestAttempt.connection.repositoryId === connection?.repositoryId &&
    latestAttempt.connection.baseBranch === connection?.baseBranch;
  return (
    <section className="space-y-4" aria-label="Change review">
      {query.isError && (
        <QueryError
          error={query.error}
          title="Change review could not refresh"
          fallback="Your last loaded proposals remain available to read. Refresh before approval."
          onRetry={() => void query.refetch()}
          isRetrying={query.isFetching}
        />
      )}
      {!activeConnection && (
        <div
          role="status"
          className="space-y-2 rounded-xl border bg-muted p-4 text-sm"
        >
          <p className="font-medium">
            {appRevoked
              ? "Reconnect GitHub to create the pull request."
              : "Connect GitHub before preparing or publishing a change."}
          </p>
          <p>
            Your prepared changes remain available to read. Reconnecting may
            require a new proposal if the repository connection changes.
          </p>
          <Link
            className="underline"
            to="/p/$projectId/settings/integrations"
            params={{ projectId }}
          >
            Open GitHub connection
          </Link>
        </div>
      )}
      {proposals.map((history) => {
        const blockedReason = !enabled
          ? "Execution is unavailable without publishing configuration, management permission, and an active connection."
          : !canApprove
            ? "Only an owner or an approver of this project can approve this pull request."
            : history.connection.revokedAt ||
                history.proposal.connectionId !== connection?.id
              ? "This proposal's connection was revoked or replaced. Prepare a new proposal."
              : history.proposal.revertsProposalId
                ? ["in_progress", "implemented"].includes(opportunity.status)
                  ? null
                  : "This revert can no longer run on this opportunity."
                : !["approved", "in_progress", "failed"].includes(
                      opportunity.status,
                    )
                  ? "This opportunity is no longer approved for execution."
                  : null;
        return (
          <PublishingProposal
            key={history.proposal.id}
            history={history}
            canExecute={enabled && canApprove}
            canTrack={canManage && !readOnly}
            canConfirmRevert={
              enabled &&
              !!history.proposal.revertsProposalId &&
              ["in_progress", "implemented"].includes(opportunity.status)
            }
            blockedReason={blockedReason}
          />
        );
      })}
      <details open={!proposals.length} className="rounded-xl border p-4">
        <summary className="cursor-pointer font-medium">
          Prepare another change and publishing tools
        </summary>
        <div className="mt-4 space-y-4">
          <CardShell title="Metadata publishing">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Turn an approved opportunity into a small, reviewable GitHub
                pull request. Relay can replace the title, the description, or
                both, in an existing static Next.js page. In the App Router,
                route groups and metadata helper calls work. In the Pages
                Router, Relay changes the plain title and description in the
                page's own next/head. Dynamic metadata and dynamic routes are
                not supported.
              </p>
              {!configured && (
                <p role="alert" className="rounded-lg border p-3 text-sm">
                  Publishing is not configured. A server administrator must set
                  BETTER_AUTH_SECRET to at least 32 characters.
                </p>
              )}
              {(!canManage || readOnly) && (
                <p className="text-sm text-muted-foreground">
                  Read-only view. You can inspect proposals and execution
                  history, but cannot prepare or approve changes.
                </p>
              )}
              {!activeConnection && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Connect a selected GitHub repository to prepare a verified
                    proposal.
                  </p>
                  <Button
                    variant="outline"
                    nativeButton={false}
                    render={
                      <Link
                        to="/p/$projectId/settings/integrations"
                        params={{ projectId }}
                      />
                    }
                  >
                    Open publishing integration
                  </Button>
                </div>
              )}
              {enabled && opportunity.status === "approved" ? (
                <>
                  <PrepareMetadataForm
                    key={`${id}-${connection.id}`}
                    opportunity={opportunity}
                    rootDirectory={connection.rootDirectory}
                  />
                  <CodeChangeSheets opportunity={opportunity} />
                </>
              ) : (
                opportunity.status !== "approved" && (
                  <p className="text-sm text-muted-foreground">
                    Approve this opportunity in the review section before
                    preparing a new proposal. Existing proposals remain
                    available above.
                  </p>
                )
              )}
            </div>
          </CardShell>
          {enabled && (
            <GithubIssueCard
              projectId={projectId}
              opportunityId={id}
              repository={`${connection.owner}/${connection.repository}`}
            />
          )}
          {canRecover && (
            <PublishingRecovery
              key={`${id}-${opportunity.version}`}
              projectId={projectId}
              opportunityId={id}
              expectedVersion={opportunity.version}
            />
          )}
          {!proposals.length && (
            <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
              No verified proposals yet. Preparing a proposal reads the selected
              file and package.json, but writes nothing to GitHub.{" "}
              <a href="/docs/github-publishing" className="underline">
                Read the guide
              </a>
            </p>
          )}
        </div>
      </details>
    </section>
  );
}
