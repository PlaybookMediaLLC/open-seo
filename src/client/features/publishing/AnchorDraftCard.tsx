import { useMutation, useQuery } from "@tanstack/react-query";
import { CardShell } from "@/client/components/CardShell";
import { Button } from "@/client/components/ui/button";
import {
  discardProposalDraft,
  draftOpportunityAnchor,
} from "@/serverFunctions/publishing";
import type { Opportunity } from "@/types/schemas/opportunities";
import { proposalDraftsOptions, useRefreshPublishing } from "./queries";

/** RFC-0004 phase 3: where to add the missing internal link. */
export function AnchorDraftCard({
  opportunity,
  canDraft,
}: {
  opportunity: Pick<Opportunity, "id" | "projectId" | "status" | "version">;
  canDraft: boolean;
}) {
  const { projectId, id } = opportunity;
  const drafts = useQuery({
    ...proposalDraftsOptions(projectId, id),
    select: (rows) => rows.filter((row) => row.kind === "internal_link_anchor"),
  });
  const refresh = useRefreshPublishing(projectId);
  const draft = useMutation({
    mutationFn: () =>
      draftOpportunityAnchor({
        data: {
          projectId,
          opportunityId: id,
          expectedOpportunityVersion: opportunity.version,
        },
      }),
    onSettled: () => void refresh(),
  });
  const discard = useMutation({
    mutationFn: (draftId: string) =>
      discardProposalDraft({ data: { projectId, draftId } }),
    onSettled: () => void refresh(),
  });
  const latest = drafts.data?.find((row) => row.status !== "discarded");
  return (
    <CardShell title="Suggested link">
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Relay reads the page that should link here and picks words that
          already stand in one of its sentences. The ticket shows the
          suggestion. About 1 to 5 credits.
        </p>
        {canDraft && opportunity.status === "approved" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            pending={draft.isPending}
            onClick={() => draft.mutate()}
          >
            Draft an anchor with AI
          </Button>
        )}
        {latest?.status === "rejected_by_validation" && (
          <p className="text-muted-foreground">{latest.rationale}</p>
        )}
        {latest?.status === "generated" && (
          <div className="space-y-2 border-t pt-3">
            <p>
              On <span className="break-all">{latest.targetUrl}</span>, link the
              words <strong>"{latest.valueAfter}"</strong> in this sentence:
            </p>
            <blockquote className="border-l-2 pl-3 text-muted-foreground">
              {latest.valueBefore}
            </blockquote>
            <p className="text-xs text-muted-foreground">{latest.rationale}</p>
            {canDraft && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                pending={discard.isPending}
                onClick={() => discard.mutate(latest.id)}
              >
                Discard
              </Button>
            )}
          </div>
        )}
      </div>
    </CardShell>
  );
}
