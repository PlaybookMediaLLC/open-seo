import { useState } from "react";
import { sortBy } from "remeda";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CardShell } from "@/client/components/CardShell";
import { QueryError } from "@/client/components/QueryState";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { prepareMetadataProposal } from "@/serverFunctions/publishing";
import type { Opportunity } from "@/types/schemas/opportunities";
import { prepareProposalInputSchema } from "@/types/schemas/publishing";
import { publishingOpportunityOptions, useRefreshPublishing } from "./queries";
import { PublishingRecovery } from "./PublishingRecovery";
import { GithubIssueCard } from "./GithubIssueCard";
import { CodeChangeSheets } from "./CopyTextSheet";
import { IndexingFields, type IndexingValues } from "./IndexingFields";
import { PublishingProposal } from "./PublishingProposal";
import { ProposalDrafts, useProposalFilePath } from "./ProposalDrafts";

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
  if (query.isError)
    return (
      <CardShell title="Metadata publishing">
        <QueryError
          fallback="Could not load publishing proposals"
          onRetry={() => void query.refetch()}
        />
      </CardShell>
    );
  const { configured, canManage, connection, proposals } = query.data;
  const activeConnection = connection && !connection.revokedAt;
  const enabled = configured && canManage && !readOnly && !!activeConnection;
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
    <section className="space-y-4" aria-label="Metadata publishing">
      <CardShell title="Metadata publishing">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Turn an approved opportunity into a small, reviewable GitHub pull
            request. Relay can replace the title, the description, or both, in
            an existing static Next.js page. In the App Router, route groups and
            metadata helper calls work. In the Pages Router, Relay changes the
            plain title and description in the page's own next/head. Dynamic
            metadata and dynamic routes are not supported.
          </p>
          {!configured && (
            <p role="alert" className="rounded-lg border p-3 text-sm">
              Publishing is not configured. A server administrator must set
              BETTER_AUTH_SECRET to at least 32 characters.
            </p>
          )}
          {(!canManage || readOnly) && (
            <p className="text-sm text-muted-foreground">
              Read-only view. You can inspect proposals and execution history,
              but cannot prepare or approve changes.
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
              <PrepareForm
                key={`${id}-${connection.id}`}
                opportunity={opportunity}
                rootDirectory={connection.rootDirectory}
              />
              <CodeChangeSheets opportunity={opportunity} />
            </>
          ) : (
            opportunity.status !== "approved" && (
              <p className="text-sm text-muted-foreground">
                Approve this opportunity in the review section before preparing
                a new proposal. Existing proposals remain available below.
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
      {proposals.map((history) => {
        const blockedReason = !enabled
          ? "Execution is unavailable without publishing configuration, management permission, and an active connection."
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
            canExecute={enabled}
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
    </section>
  );
}

function PrepareForm({
  opportunity,
  rootDirectory,
}: {
  opportunity: Pick<
    Opportunity,
    "id" | "projectId" | "url" | "status" | "version" | "type"
  >;
  rootDirectory: string;
}) {
  const [filePath, setTypedPath, locateNote] = useProposalFilePath(
    opportunity,
    rootDirectory,
  );
  const [description, setDescription] = useState("");
  // ponytail: a proposal records one draft; the description's wins.
  const [draftIds, setDraftIds] = useState<{
    description?: string;
    title?: string;
  }>({});
  const [title, setTitle] = useState("");
  const [indexing, setIndexing] = useState<IndexingValues | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const refresh = useRefreshPublishing(opportunity.projectId);
  const mutation = useMutation({
    meta: { errorToast: false },
    mutationFn: async () => {
      const input = prepareProposalInputSchema.safeParse({
        projectId: opportunity.projectId,
        opportunityId: opportunity.id,
        expectedOpportunityVersion: opportunity.version,
        filePath,
        ...(indexing
          ? {
              newCanonical: indexing.canonical.trim() || undefined,
              newRobots: indexing.changeRobots
                ? { index: indexing.index, follow: indexing.follow }
                : undefined,
              confirmPath: indexing.confirmPath,
            }
          : {
              newDescription: description.trim() || undefined,
              newTitle: title.trim() || undefined,
              draftId:
                (description.trim() && draftIds.description) ||
                (title.trim() && draftIds.title) ||
                undefined,
            }),
      });
      if (!input.success)
        throw new Error(
          "Enter an existing page path, and a title or a description without line breaks.",
        );
      return prepareMetadataProposal({ data: input.data });
    },
    onSuccess: (result) => {
      setMessage(result.message);
      if (result.ok) {
        setDescription("");
        setTitle("");
        setDraftIds({});
      }
    },
    onError: () =>
      setMessage(
        "Could not prepare the proposal. Check the existing static page path and description, then try again. Refresh if the opportunity changed.",
      ),
    onSettled: () => {
      void refresh();
    },
  });
  return (
    <form
      className="space-y-4 border-t pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage(null);
        mutation.mutate();
      }}
    >
      <fieldset disabled={mutation.isPending} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="publishing-file-path">
            Existing page file (repository-relative)
          </Label>
          <Input
            id="publishing-file-path"
            value={filePath}
            onChange={(event) => setTypedPath(event.target.value)}
            required
            maxLength={300}
            placeholder={`${rootDirectory ? `${rootDirectory}/` : ""}app/example/page.tsx`}
          />
          <p className="text-xs text-muted-foreground">
            {locateNote === null
              ? "Relay found this file in the repository. You can change it."
              : `${locateNote} The URL-based suggestion is not verified. Confirm the actual file under app/ or src/app/ (page.tsx and similar), or under pages/ or src/pages/ for the Pages Router. Include the configured root directory prefix.`}
          </p>
        </div>
        {opportunity.type === "technical_blocker" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setIndexing(
                indexing
                  ? null
                  : {
                      canonical: "",
                      changeRobots: false,
                      index: true,
                      follow: true,
                      confirmPath: "",
                    },
              )
            }
          >
            {indexing
              ? "Change the title or description instead"
              : "Change the canonical URL or robots instead"}
          </Button>
        )}
        {indexing ? (
          <IndexingFields
            values={indexing}
            onChange={setIndexing}
            pagePath={new URL(opportunity.url).pathname}
          />
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="publishing-title">
                Your replacement title (optional)
              </Label>
              <Input
                id="publishing-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                placeholder="Write the page title without the site name"
              />
              <p className="text-xs text-muted-foreground">
                Relay adds your layout's title template, such as "%s | Site",
                and checks that the final title has 10 to 60 characters.
              </p>
            </div>
            <ProposalDrafts
              opportunity={opportunity}
              filePath={filePath}
              kind="meta_title"
              onUse={(draft) => {
                setTitle(draft.valueAfter);
                setDraftIds((ids) => ({ ...ids, title: draft.id }));
              }}
            />
            <div className="space-y-2">
              <Label htmlFor="publishing-description">
                Your replacement description (optional)
              </Label>
              <Textarea
                id="publishing-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={320}
                rows={3}
                placeholder="Write an accurate description supported by this page's content"
              />
              <p className="text-xs text-muted-foreground">
                {description.length}/320 characters. Write your own factual
                description, or use a checked draft and edit it.
              </p>
            </div>
            <ProposalDrafts
              opportunity={opportunity}
              filePath={filePath}
              kind="meta_description"
              onUse={(draft) => {
                setDescription(draft.valueAfter);
                setDraftIds((ids) => ({ ...ids, description: draft.id }));
              }}
            />
          </>
        )}
        <p className="text-sm text-muted-foreground">
          Preparation reads the selected file and package.json from the
          connected repository and verifies that only the title and description
          literals change. It writes nothing remotely and does not run the
          repository build or CI.
        </p>
        <Button
          type="submit"
          disabled={
            !filePath.trim() ||
            (indexing
              ? (!indexing.canonical.trim() && !indexing.changeRobots) ||
                !indexing.confirmPath
              : !description.trim() && !title.trim())
          }
          pending={mutation.isPending}
        >
          Prepare verified proposal
        </Button>
      </fieldset>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </form>
  );
}
