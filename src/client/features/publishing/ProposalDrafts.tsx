import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  discardProposalDraft,
  draftProposalText,
} from "@/serverFunctions/publishing";
import type { Opportunity } from "@/types/schemas/opportunities";
import type { ProposalDraft } from "@/types/schemas/proposalDrafts";
import {
  proposalDraftsOptions,
  proposalFileOptions,
  useRefreshPublishing,
} from "./queries";

// ponytail: fixed estimate from the default model's price, at most two
// attempts of about 3,000 input and 1,000 output tokens. Set it from the
// recorded draft costs after the first 100 drafts (RFC-0004 section 7).
const COST_ESTIMATE = "About 1 to 5 credits per draft.";
const STATUS: Record<
  ProposalDraft["status"],
  { label: string; variant: "success" | "destructive" | "info" | "outline" }
> = {
  generated: { label: "Checked draft", variant: "success" },
  rejected_by_validation: { label: "Rejected", variant: "destructive" },
  used: { label: "Used in a proposal", variant: "info" },
  discarded: { label: "Discarded", variant: "outline" },
};

function suggestPath(value: string, root: string) {
  try {
    const raw = /^https?:\/\/[^/?#\\\s]+(\/[^?#\\\s]*)?$/.exec(value);
    const url = new URL(value);
    if (
      !raw ||
      url.username ||
      url.password ||
      (raw[1] ?? "/") !== url.pathname ||
      value.includes("//", value.indexOf("://") + 3)
    )
      return "";
    const segments = url.pathname.split("/").filter(Boolean);
    if (
      segments.some((segment) => !/^[A-Za-z0-9-][A-Za-z0-9_-]*$/.test(segment))
    )
      return "";
    return [root, "app", ...segments, "page.tsx"].filter(Boolean).join("/");
  } catch {
    return "";
  }
}

/**
 * The page file path: what the person typed, else the file Relay located
 * (RFC-0004 5.2), else a guess from the URL.
 */
export function useProposalFilePath(
  opportunity: Pick<Opportunity, "id" | "projectId" | "url">,
  rootDirectory: string,
) {
  const [typedPath, setTypedPath] = useState<string | null>(null);
  const located = useQuery(
    proposalFileOptions(opportunity.projectId, opportunity.id),
  );
  const filePath =
    typedPath ??
    (located.data?.status === "found"
      ? located.data.filePath
      : suggestPath(opportunity.url, rootDirectory));
  return [filePath, setTypedPath, located.data] as const;
}

/** RFC-0004 5.5: draft the description with a model, then check it. */
export function ProposalDrafts({
  opportunity,
  filePath,
  onUse,
}: {
  opportunity: Pick<Opportunity, "id" | "projectId" | "version">;
  filePath: string;
  onUse: (draft: ProposalDraft) => void;
}) {
  const { projectId, id } = opportunity;
  const drafts = useQuery(proposalDraftsOptions(projectId, id));
  const refresh = useRefreshPublishing(projectId);
  const draft = useMutation({
    mutationFn: () =>
      draftProposalText({
        data: {
          projectId,
          opportunityId: id,
          expectedOpportunityVersion: opportunity.version,
          filePath: filePath.trim() || undefined,
        },
      }),
    onSettled: () => void refresh(),
  });
  const discard = useMutation({
    mutationFn: (draftId: string) =>
      discardProposalDraft({ data: { projectId, draftId } }),
    onSettled: () => void refresh(),
  });
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-medium">Draft the description with AI</p>
          <p className="text-xs text-muted-foreground">
            {COST_ESTIMATE} Relay checks each draft against the page, your
            project context and your Search Console queries before you see it.
            You can draft 3 times for each opportunity and 30 times for each
            project in 24 hours.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          pending={draft.isPending}
          onClick={() => draft.mutate()}
        >
          Draft with AI
        </Button>
      </div>
      {drafts.data?.map((item) => (
        <DraftItem
          key={item.id}
          draft={item}
          onUse={() => onUse(item)}
          onDiscard={() => discard.mutate(item.id)}
          discarding={discard.isPending && discard.variables === item.id}
        />
      ))}
    </div>
  );
}

function DraftItem({
  draft,
  onUse,
  onDiscard,
  discarding,
}: {
  draft: ProposalDraft;
  onUse: () => void;
  onDiscard: () => void;
  discarding: boolean;
}) {
  const status = STATUS[draft.status];
  const queries = draft.sources.filter((source) => source.kind === "query");
  return (
    <article className="space-y-2 border-t pt-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={status.variant}>{status.label}</Badge>
        <span className="text-xs text-muted-foreground">
          {new Date(draft.createdAt).toLocaleString()}
        </span>
      </div>
      {draft.status === "rejected_by_validation" ? (
        <p className="text-muted-foreground">{draft.rationale}</p>
      ) : (
        <>
          <p>{draft.valueAfter}</p>
          <p className="text-xs text-muted-foreground">
            {draft.valueAfter.length} characters. {draft.rationale}
          </p>
          {queries.length > 0 && (
            <p className="text-xs">
              Used queries: {queries.map((source) => source.excerpt).join(", ")}
            </p>
          )}
          {draft.claims.length > 0 && (
            <ul className="space-y-1 text-xs">
              {draft.claims.map((claim) => {
                const source = draft.sources.find(
                  (item) => item.id === claim.sourceId,
                );
                return (
                  <li key={claim.id}>
                    {claim.verified ? "Checked" : "Not checked"}:{" "}
                    {claim.claimText}
                    {source && (
                      <span className="text-muted-foreground">
                        {" "}
                        (from {source.label}: "{source.excerpt}")
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
      {draft.status === "generated" && (
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={onUse}>
            Use this draft
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            pending={discarding}
            onClick={onDiscard}
          >
            Discard
          </Button>
        </div>
      )}
    </article>
  );
}
