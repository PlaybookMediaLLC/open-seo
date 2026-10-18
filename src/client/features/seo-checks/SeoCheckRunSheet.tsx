import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/client/components/ui/sheet";
import { getSeoCheckRun } from "@/serverFunctions/seoChecks";

type Run = {
  id: string;
  repository: string;
  pullRequest: number | null;
  headSha: string;
};

/** RFC-0010 5.11: one run's findings with their page traffic. */
export function SeoCheckRunSheet({
  projectId,
  run,
  onClose,
}: {
  projectId: string;
  run: Run;
  onClose: () => void;
}) {
  const detail = useQuery({
    queryKey: ["seo-checks", projectId, "run", run.id],
    queryFn: () => getSeoCheckRun({ data: { projectId, runId: run.id } }),
  });
  const traffic = (path: string) =>
    detail.data?.urls.find((url) => url.path === path);
  const pullRequest = `${run.repository}#${run.pullRequest ?? "?"}`;
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{pullRequest}</SheetTitle>
          <SheetDescription>
            Commit {run.headSha.slice(0, 7)}. Findings are sorted by page.
          </SheetDescription>
        </SheetHeader>
        <ul className="space-y-3 overflow-y-auto px-4 pb-4 text-sm">
          {detail.data?.findings.length === 0 && (
            <li className="text-muted-foreground">No findings.</li>
          )}
          {detail.data?.findings.map((finding) => {
            const page = traffic(finding.path);
            const ticket = [
              `SEO check: ${finding.rule} on ${finding.path}`,
              finding.message,
              finding.beforeValue ? `Before: ${finding.beforeValue}` : null,
              finding.afterValue ? `After: ${finding.afterValue}` : null,
              page?.impressions28d != null
                ? `Traffic (28 days): ${page.clicks28d ?? 0} clicks, ${page.impressions28d} impressions`
                : null,
              `Pull request: ${pullRequest}`,
            ]
              .filter(Boolean)
              .join("\n");
            return (
              <li key={finding.id} className="space-y-1 rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      finding.severity === "blocking"
                        ? "destructive"
                        : "outline"
                    }
                  >
                    {finding.severity}
                  </Badge>
                  <span className="font-medium">{finding.rule}</span>
                  <span className="text-muted-foreground">{finding.path}</span>
                </div>
                <p>{finding.message}</p>
                {(finding.beforeValue || finding.afterValue) && (
                  <p className="text-xs text-muted-foreground">
                    {finding.beforeValue ?? "—"} → {finding.afterValue ?? "—"}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {page?.impressions28d != null
                    ? `${page.clicks28d ?? 0} clicks · ${page.impressions28d} impressions in 28 days`
                    : "No Search Console data for this page."}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void navigator.clipboard.writeText(ticket)}
                >
                  Copy ticket
                </Button>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
