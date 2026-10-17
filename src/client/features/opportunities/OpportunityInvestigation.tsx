import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CardShell } from "@/client/components/CardShell";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  investigateOpportunity,
  listOpportunityInvestigations,
  summarizeOpportunityInvestigation,
} from "@/serverFunctions/opportunities";
import type { OpportunityInvestigation as Investigation } from "@/types/schemas/investigations";
import { opportunityKeys } from "./shared";

const SEVERITY = {
  high: "destructive",
  medium: "warning",
  low: "outline",
  info: "info",
} as const;

/** RFC-0004 phase 3: why a page declined, from deterministic checks. */
export function OpportunityInvestigation({
  projectId,
  opportunityId,
  canRun,
}: {
  projectId: string;
  opportunityId: string;
  canRun: boolean;
}) {
  const client = useQueryClient();
  const queryKey = [
    ...opportunityKeys.detail(projectId, opportunityId),
    "investigations",
  ];
  const list = useQuery({
    queryKey,
    queryFn: () =>
      listOpportunityInvestigations({ data: { projectId, opportunityId } }),
  });
  const refresh = () => client.invalidateQueries({ queryKey });
  const run = useMutation({
    mutationFn: () =>
      investigateOpportunity({ data: { projectId, opportunityId } }),
    onSettled: refresh,
  });
  const summarize = useMutation({
    mutationFn: (investigationId: string) =>
      summarizeOpportunityInvestigation({
        data: { projectId, investigationId },
      }),
    onSettled: refresh,
  });
  const [latest] = list.data ?? [];
  return (
    <CardShell title="Why did this page decline?">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Relay compares the page's search queries in the two periods, and
          checks URL Inspection, the latest site audit and your tracked
          keywords. This uses no credits.
        </p>
        {canRun && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            pending={run.isPending}
            onClick={() => run.mutate()}
          >
            {latest ? "Investigate again" : "Investigate"}
          </Button>
        )}
        {latest && (
          <Result
            investigation={latest}
            canSummarize={canRun}
            summarizing={summarize.isPending}
            onSummarize={() => summarize.mutate(latest.id)}
          />
        )}
      </div>
    </CardShell>
  );
}

function Result({
  investigation,
  canSummarize,
  summarizing,
  onSummarize,
}: {
  investigation: Investigation;
  canSummarize: boolean;
  summarizing: boolean;
  onSummarize: () => void;
}) {
  return (
    <div className="space-y-3 border-t pt-3 text-sm">
      <p className="text-xs text-muted-foreground">
        Investigated {new Date(investigation.createdAt).toLocaleString()}
      </p>
      {investigation.summary ? (
        <p className="rounded-lg bg-muted p-3">
          {investigation.summary}
          <span className="block pt-1 text-xs text-muted-foreground">
            AI summary of the findings below. Check it against them.
          </span>
        </p>
      ) : (
        canSummarize && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              pending={summarizing}
              onClick={onSummarize}
            >
              Summarize with AI
            </Button>
            <span className="text-xs text-muted-foreground">
              About 1 to 5 credits. It uses only these findings.
            </span>
          </div>
        )
      )}
      <ul className="space-y-2">
        {investigation.findings.map((finding) => (
          <li key={finding.id} className="flex items-start gap-2">
            <Badge variant={SEVERITY[finding.severity]}>
              {finding.severity}
            </Badge>
            <span>{finding.summary}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
