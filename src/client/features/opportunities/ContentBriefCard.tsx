import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CardShell } from "@/client/components/CardShell";
import { Button } from "@/client/components/ui/button";
import { downloadFile } from "@/client/lib/download";
import {
  createContentBrief,
  listContentBriefs,
} from "@/serverFunctions/opportunities";
import type { Opportunity } from "@/types/schemas/opportunities";
import { opportunityKeys } from "./shared";

const BRIEF_STATUSES = ["approved", "in_progress", "implemented", "failed"];

/** RFC-0004 phase 3: a writer's brief, exported as Markdown. */
export function ContentBriefCard({
  opportunity,
  canRun,
}: {
  opportunity: Pick<Opportunity, "id" | "projectId" | "status" | "version">;
  canRun: boolean;
}) {
  const { projectId, id: opportunityId } = opportunity;
  const client = useQueryClient();
  const queryKey = [
    ...opportunityKeys.detail(projectId, opportunityId),
    "briefs",
  ];
  const list = useQuery({
    queryKey,
    queryFn: () => listContentBriefs({ data: { projectId, opportunityId } }),
  });
  const create = useMutation({
    mutationFn: () =>
      createContentBrief({
        data: {
          projectId,
          opportunityId,
          expectedOpportunityVersion: opportunity.version,
        },
      }),
    onSettled: () => client.invalidateQueries({ queryKey }),
  });
  const [latest] = list.data ?? [];
  const approved = BRIEF_STATUSES.includes(opportunity.status);
  return (
    <CardShell title="Content brief">
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Relay writes an outline for a writer from the keyword data and your
          project context. It lists the facts the writer must supply and never
          invents them. About 3 to 12 credits. Relay never publishes a brief.
        </p>
        {canRun && approved && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            pending={create.isPending}
            onClick={() => create.mutate()}
          >
            {latest ? "Write a new brief" : "Write a brief"}
          </Button>
        )}
        {canRun && !approved && (
          <p className="text-muted-foreground">
            Approve the opportunity to write a brief.
          </p>
        )}
        {latest?.status === "rejected_by_validation" && (
          <p className="text-muted-foreground">{latest.searchIntent}</p>
        )}
        {latest?.status === "generated" && (
          <div className="space-y-2 border-t pt-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  downloadFile(
                    latest.outlineMarkdown,
                    `brief-${latest.createdAt.slice(0, 10)}.md`,
                    "text/markdown",
                  )
                }
              >
                Download Markdown
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  void navigator.clipboard.writeText(latest.outlineMarkdown)
                }
              >
                Copy
              </Button>
            </div>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">
              {latest.outlineMarkdown}
            </pre>
          </div>
        )}
      </div>
    </CardShell>
  );
}
