import type { getOpportunity } from "@/serverFunctions/opportunities";
import type { Opportunity } from "@/types/schemas/opportunities";
import { dateLabel, statusLabels } from "./shared";

export function OpportunityReviewEvidence({ item }: { item: Opportunity }) {
  return (
    <aside
      aria-label="Change evidence"
      className="space-y-4 rounded-xl border bg-card p-5 text-sm"
    >
      <h2 className="text-lg font-semibold">Evidence</h2>
      <p>{item.explanation}</p>
      <p className="break-all">
        <span className="font-medium">Page: </span>
        {item.url}
      </p>
      <p>Last detected {dateLabel(item.lastDetectedAt)}.</p>
      <div className="rounded-lg bg-muted p-3">
        <p className="font-medium">Evidence limits</p>
        <p>{item.uncertainty}</p>
        <p className="mt-2">
          The confidence score is a research heuristic, not a probability of
          traffic growth.
        </p>
      </div>
      <a href="#opportunity-evidence" className="underline">
        Inspect sources and review history below
      </a>
    </aside>
  );
}

export function OpportunityReviewHistory({
  decisions,
}: {
  decisions: Awaited<ReturnType<typeof getOpportunity>>["decisions"];
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Review history</h2>
      {decisions.length ? (
        <ol className="divide-y rounded-xl border">
          {decisions.map((decision) => (
            <li key={decision.id} className="space-y-2 p-4 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-medium">
                  {decision.decision === "deferred"
                    ? "Deferred for 7 days"
                    : `${statusLabels[decision.fromStatus]} → ${statusLabels[decision.toStatus]}`}
                </p>
                <time
                  dateTime={decision.createdAt}
                  className="text-muted-foreground"
                >
                  {dateLabel(decision.createdAt)}
                </time>
              </div>
              {decision.note ? (
                <p className="whitespace-pre-wrap break-words">
                  {decision.note}
                </p>
              ) : null}
              <p className="break-all text-xs text-muted-foreground">
                Reviewer: {decision.actorUserId} · Evidence run:{" "}
                {decision.evidenceRunId}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
          No review decisions yet.
        </p>
      )}
    </section>
  );
}
