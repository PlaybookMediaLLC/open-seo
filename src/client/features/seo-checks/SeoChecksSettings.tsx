import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CardShell } from "@/client/components/CardShell";
import { Badge } from "@/client/components/ui/badge";
import { getSeoChecks } from "@/serverFunctions/seoChecks";
import { SeoCheckRunSheet } from "./SeoCheckRunSheet";
import { SeoCheckSetup } from "./SeoCheckSetup";

const seoChecksQuery = (projectId: string) => ({
  queryKey: ["seo-checks", projectId],
  queryFn: () => getSeoChecks({ data: { projectId } }),
});

/** RFC-0010 5.11: recent checks first, then the setup. */
export function SeoChecksSettings({ projectId }: { projectId: string }) {
  const checks = useQuery(seoChecksQuery(projectId));
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  if (!checks.data) return null;
  const { runs } = checks.data;
  const openRun = runs.find((run) => run.id === openRunId);
  return (
    <div className="space-y-6">
      <CardShell title="Recent checks">
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No checks yet. Add the GitHub Action below to check each pull
            request before merge.
          </p>
        ) : (
          <ul className="divide-y text-sm">
            {runs.map((run) => (
              <li key={run.id}>
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center gap-3 py-2 text-left hover:bg-muted/50"
                  onClick={() => setOpenRunId(run.id)}
                >
                  <Badge
                    variant={
                      run.status === "failed"
                        ? "destructive"
                        : run.blockingCount > 0 && !run.overrideUsed
                          ? "destructive"
                          : run.status === "succeeded"
                            ? "success"
                            : "outline"
                    }
                  >
                    {run.status === "succeeded"
                      ? run.blockingCount > 0
                        ? run.overrideUsed
                          ? "overridden"
                          : "blocked"
                        : "passed"
                      : run.status}
                  </Badge>
                  <span className="font-medium">
                    {run.repository}#{run.pullRequest ?? "?"}
                  </span>
                  <span className="text-muted-foreground">
                    {run.blockingCount} blocking · {run.warningCount} warnings ·{" "}
                    {run.urlCount} pages
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(run.createdAt).toLocaleString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardShell>
      <SeoCheckSetup projectId={projectId} data={checks.data} />
      {openRun && (
        <SeoCheckRunSheet
          projectId={projectId}
          run={openRun}
          onClose={() => setOpenRunId(null)}
        />
      )}
    </div>
  );
}
