import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CardShell } from "@/client/components/CardShell";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  refreshSplitTestFn,
  type getSplitTest,
} from "@/serverFunctions/splitTests";

// RFC-0011 5.5, 5.6 and 5.9: live verification, the current estimate with
// its interval, and the limits. Results never claim more than an estimate.
type Data = Awaited<ReturnType<typeof getSplitTest>>;
const LABELS = {
  positive: "Positive",
  negative: "Negative",
  inconclusive: "Inconclusive",
} as const;
const pct = (value: number | null) =>
  value === null ? "?" : `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;

export function SplitTestResultsCard({ data }: { data: Data }) {
  const { test, analysis, verification } = data;
  const client = useQueryClient();
  const refresh = useMutation({
    mutationFn: () =>
      refreshSplitTestFn({
        data: { projectId: test.projectId, testId: test.id },
      }),
    onSettled: () =>
      client.invalidateQueries({ queryKey: ["split-tests", test.projectId] }),
  });
  const notes = analysis?.notes?.split(", ") ?? [];
  const live = test.status === "verifying" || test.status === "running";
  if (!live && !analysis && !verification) return null;
  return (
    <CardShell
      title="Results"
      action={
        data.canManage && live ? (
          <Button
            size="sm"
            variant="outline"
            pending={refresh.isPending}
            onClick={() => refresh.mutate()}
          >
            {test.status === "verifying" ? "Verify now" : "Refresh now"}
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-3 text-sm">
        {refresh.data && <p role="status">{refresh.data.message}</p>}
        {refresh.isError && (
          <p role="alert" className="text-destructive">
            {refresh.error.message}
          </p>
        )}
        {verification && (
          <div>
            <p>
              Live check {new Date(verification.checkedAt).toLocaleDateString()}
              : {verification.passed} of{" "}
              {verification.passed + verification.failing.length} pages show the
              expected {test.field}.
            </p>
            {verification.failing.length > 0 && (
              <p className="text-muted-foreground">
                Failing: {verification.failing.slice(0, 10).join(", ")}
              </p>
            )}
          </div>
        )}
        {test.contaminated && (
          <p className="text-warning">
            Contaminated: more than 5% of pages drifted from their group after
            the start. Treat the estimate with caution.
          </p>
        )}
        {analysis ? (
          <div className="space-y-1">
            <p className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  analysis.label === "negative" ? "warning" : "secondary"
                }
              >
                {LABELS[analysis.label]}
              </Badge>
              {notes.includes("interim") && (
                <Badge variant="outline">Interim</Badge>
              )}
              <span>
                Estimated effect {pct(analysis.estimatePct)} on clicks, 90%
                interval {pct(analysis.ciLowPct)} to {pct(analysis.ciHighPct)},
                p = {analysis.pValue?.toFixed(3)}, after{" "}
                {analysis.observationDays} of 28 days.
              </span>
            </p>
            {notes.includes("imbalanced") && (
              <p className="text-muted-foreground">
                Imbalanced: the groups moved differently before the test
                (pre-period p = {analysis.prePeriodPValue?.toFixed(2)}), so this
                result gets no positive or negative label.
              </p>
            )}
            {notes.includes("interim") && (
              <p className="text-muted-foreground">
                A positive label is given only when the window ends.
              </p>
            )}
          </div>
        ) : (
          live && (
            <p className="text-muted-foreground">
              No estimate yet. The observation window starts{" "}
              {test.observationStart ?? "after the deployment is confirmed"}.
            </p>
          )
        )}
        <p className="text-xs text-muted-foreground">
          Limits: Search Console data only. Internal links and cannibalization
          between the groups, and any other change to only one group, can bias
          the estimate. Effects smaller than{" "}
          {test.mdePct === null ? "the MDE" : `${Math.round(test.mdePct)}%`}{" "}
          show as inconclusive.
        </p>
      </div>
    </CardShell>
  );
}
