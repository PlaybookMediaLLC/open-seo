import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { Button } from "@/client/components/ui/button";
import { Textarea } from "@/client/components/ui/textarea";
import { reviewOpportunity } from "@/serverFunctions/opportunities";
import type {
  Opportunity,
  OpportunityReviewInput,
} from "@/types/schemas/opportunities";
import { opportunityKeys } from "./shared";

type Decision = OpportunityReviewInput["decision"];
const labels: Record<Decision, string> = {
  reviewed: "Mark reviewed",
  approved: "Approve proposal preparation",
  rejected: "Reject",
  deferred: "Defer 7 days",
};

export function OpportunityReview({
  opportunity,
  canReview,
  currentEvidenceReviewed,
}: {
  opportunity: Opportunity;
  canReview: boolean;
  currentEvidenceReviewed: boolean;
}) {
  const [note, setNote] = useState("");
  const [confirmation, setConfirmation] = useState<{
    decision: Decision;
    version: number;
  } | null>(null);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({
      decision,
      version,
    }: {
      decision: Decision;
      version: number;
    }) =>
      reviewOpportunity({
        data: {
          projectId: opportunity.projectId,
          opportunityId: opportunity.id,
          expectedVersion: version,
          decision,
          note,
        },
      }),
    onSuccess: (detail) => {
      queryClient.setQueryData(
        opportunityKeys.detail(opportunity.projectId, opportunity.id),
        detail,
      );
      void queryClient.invalidateQueries({
        queryKey: opportunityKeys.all(opportunity.projectId),
      });
      setConfirmation(null);
      setNote("");
      toast.success("Review decision saved");
    },
    onError: () => {
      setConfirmation(null);
      void queryClient.invalidateQueries({
        queryKey: opportunityKeys.all(opportunity.projectId),
      });
    },
    meta: { errorToast: false },
  });
  const { status } = opportunity;
  const decisions: Decision[] =
    status === "discovered"
      ? ["reviewed", "rejected", "deferred"]
      : status === "reviewed"
        ? currentEvidenceReviewed
          ? ["approved", "rejected", "deferred"]
          : ["reviewed", "approved", "rejected", "deferred"]
        : status === "approved" || status === "rejected"
          ? ["reviewed"]
          : [];
  return (
    <section
      className="rounded-xl border bg-card p-5 space-y-4"
      aria-labelledby="review-heading"
    >
      <div>
        <h2 id="review-heading" className="text-lg font-semibold">
          Review decision
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Approval only authorizes proposal preparation. Creating a GitHub pull
          request requires a separate approval of the exact verified change in
          the publishing section. Nothing is automatically merged or deployed.
        </p>
      </div>
      {!canReview ? (
        <p className="text-sm text-muted-foreground">
          Only organization owners and admins can record decisions.
        </p>
      ) : decisions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          This lifecycle state is read-only in Growth Operations.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <label htmlFor="review-note" className="text-sm font-medium">
              Review note{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            <Textarea
              id="review-note"
              maxLength={2000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={mutation.isPending}
              placeholder="Record your reasoning or what needs to be checked next."
            />
            <p className="text-xs text-muted-foreground">
              {note.length}/2,000 characters
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {decisions.map((decision) => (
              <Button
                key={decision}
                variant={
                  decision === "approved" || decision === "reviewed"
                    ? "default"
                    : "outline"
                }
                disabled={
                  mutation.isPending ||
                  (decision === "approved" && !currentEvidenceReviewed)
                }
                onClick={() => {
                  mutation.reset();
                  setConfirmation({ decision, version: opportunity.version });
                }}
              >
                {labels[decision]}
              </Button>
            ))}
          </div>
          {status === "discovered" ||
          (status === "reviewed" && !currentEvidenceReviewed) ? (
            <p className="text-xs text-muted-foreground">
              Mark the current evidence reviewed before approving proposal
              preparation. A review of an older evidence run does not apply.
            </p>
          ) : null}
        </>
      )}
      {mutation.isError ? (
        <p role="alert" className="text-sm text-destructive">
          The decision was not saved. This opportunity may have changed or your
          access may have expired. Review the refreshed information before
          trying again.
        </p>
      ) : null}
      {confirmation ? (
        <ConfirmDialog
          title={`${labels[confirmation.decision]}?`}
          confirmLabel={labels[confirmation.decision]}
          pending={mutation.isPending}
          destructive={confirmation.decision === "rejected"}
          onClose={() => setConfirmation(null)}
          onConfirm={() => mutation.mutate(confirmation)}
        >
          {confirmation.decision === "approved"
            ? "Approve preparation of a proposal only. This does not publish or change anything on your site."
            : confirmation.decision === "deferred"
              ? "Hide this opportunity from the default queue for seven days. Its evidence and review history are retained."
              : "This decision will be recorded with your user identity and the current evidence run. No site changes will be made."}
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
