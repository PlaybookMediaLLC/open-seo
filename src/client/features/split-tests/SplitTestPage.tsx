import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CardShell } from "@/client/components/CardShell";
import { PageHeader } from "@/client/components/PageHeader";
import { QueryError } from "@/client/components/QueryState";
import { Badge } from "@/client/components/ui/badge";
import { getSplitTest } from "@/serverFunctions/splitTests";
import { SplitTestPullCard } from "./SplitTestPullCard";
import { SplitTestResultsCard } from "./SplitTestResultsCard";

// RFC-0011 5.9 step 3: the test, then both groups with their baseline
// totals and the balance result.
export function SplitTestPage(props: { projectId: string; testId: string }) {
  const query = useQuery({
    queryKey: ["split-tests", props.projectId, props.testId],
    queryFn: () => getSplitTest({ data: props }),
  });
  if (query.isPending)
    return <p className="page-pad text-sm text-muted-foreground">Loading…</p>;
  if (query.isError)
    return (
      <div className="page-pad">
        <QueryError
          fallback="Could not load this split test"
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  const { test, pages, variantClicks, controlClicks } = query.data;
  const gap =
    Math.abs(variantClicks - controlClicks) /
    ((variantClicks + controlClicks) / 2 || 1);
  return (
    <div className="overflow-auto page-pad">
      <div className="mx-auto max-w-5xl space-y-5">
        <Link
          className="text-sm text-muted-foreground hover:underline"
          to="/p/$projectId/experiments"
          params={{ projectId: props.projectId }}
        >
          ← Experiments & Results
        </Link>
        <PageHeader title={test.name} description={test.hypothesis} />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Badge variant="outline">{test.status.replaceAll("_", " ")}</Badge>
          <code>{test.pagePattern}</code>
          <span className="text-muted-foreground">
            {test.pairs} pairs · changes the {test.field}
          </span>
        </div>
        {test.mdePct !== null && (
          <p className="text-sm">
            This group can detect a change of {Math.round(test.mdePct)}% or
            more. Smaller effects will show as inconclusive.
          </p>
        )}
        <SplitTestResultsCard data={query.data} />
        <SplitTestPullCard test={test} />
        <CardShell title="Groups">
          <p className="mb-3 text-sm text-muted-foreground">
            Baseline {test.baselineStart} to {test.baselineEnd}: variant{" "}
            {variantClicks.toLocaleString()} clicks, control{" "}
            {controlClicks.toLocaleString()} clicks ({(gap * 100).toFixed(1)}%
            apart). Seed {test.seed}.
          </p>
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            {(["variant", "control"] as const).map((bucket) => (
              <div key={bucket}>
                <p className="mb-1 font-medium capitalize">{bucket}</p>
                <ul className="divide-y">
                  {pages
                    .filter((page) => page.bucket === bucket)
                    .map((page) => (
                      <li
                        key={page.id}
                        className="flex justify-between gap-2 py-1"
                      >
                        <span className="break-all">{page.path}</span>
                        <span className="text-muted-foreground">
                          {page.baselineClicks}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </CardShell>
      </div>
    </div>
  );
}
