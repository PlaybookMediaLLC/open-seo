import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/client/components/ui/button";
import { dateLabel } from "@/client/features/opportunities/shared";
import {
  getPerformanceLab,
  runPerformanceLab,
} from "@/serverFunctions/performance";
import { metricValue, type PerformanceMetric } from "@/shared/performance";

// Lighthouse cannot measure INP without a person, so the lab shows Total
// Blocking Time for it.
const LAB_METRIC = {
  lcp: { name: "LCP", key: "lcpMs" },
  cls: { name: "CLS", key: "cls" },
  inp: { name: "Total Blocking Time (the lab stand-in for INP)", key: "tbtMs" },
} as const;

type Check = { lcpMs: number | null; cls: number | null; tbtMs: number | null };

/** RFC-0014 5.6: three Lighthouse runs before and after a change. */
export function PerformanceLabCheck(props: {
  projectId: string;
  opportunityId: string;
  metric: PerformanceMetric;
  canRun: boolean;
}) {
  const scope = {
    projectId: props.projectId,
    opportunityId: props.opportunityId,
  };
  const queryKey = ["performance-lab", props.projectId, props.opportunityId];
  const client = useQueryClient();
  const query = useQuery({
    queryKey,
    queryFn: () => getPerformanceLab({ data: scope }),
  });
  const run = useMutation({
    meta: { errorToast: false },
    mutationFn: () => runPerformanceLab({ data: scope }),
    onSettled: () => client.invalidateQueries({ queryKey }),
  });
  const lab = LAB_METRIC[props.metric];
  const show = (check: Check) => {
    const value = check[lab.key];
    if (value === null) return "no value";
    return props.metric === "inp"
      ? `${Math.round(value)} ms`
      : metricValue(props.metric, value);
  };
  const state = query.data;
  const comparison = state?.comparison;
  const change = comparison
    ? (() => {
        const before = comparison.before[lab.key];
        const after = comparison.after[lab.key];
        return before && after !== null
          ? Math.round((1 - after / before) * 100)
          : null;
      })()
    : null;
  return (
    <section
      className="rounded-xl border bg-card p-5 space-y-3 text-sm"
      aria-label="Lab check"
    >
      <h2 className="text-lg font-semibold">Lab check</h2>
      {comparison && (
        <p>
          <span className="font-medium">{lab.name}</span>:{" "}
          {show(comparison.before)} before the change, {show(comparison.after)}{" "}
          after it
          {change !== null &&
            ` (${change >= 0 ? `${change}% better` : `${-change}% worse`})`}
          . Medians of 3 Lighthouse runs each.
        </p>
      )}
      {state?.checks.length ? (
        <ul className="space-y-1">
          {state.checks.map((check) => (
            <li key={check.id}>
              {dateLabel(check.ranAt)}: {lab.name} {show(check)}
              {check.runs < 3 && ` (${check.runs} of 3 runs)`}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-muted-foreground">
        A lab check runs Lighthouse 3 times on the page from a phone and keeps
        the median. Run one before the change ships and one after it. Lab values
        come from one simulated device, so they can differ from real users.
      </p>
      {run.data && (
        <p role={run.data.ok ? "status" : "alert"}>{run.data.message}</p>
      )}
      {run.isError && (
        <p role="alert" className="text-destructive">
          {run.error.message}
        </p>
      )}
      {props.canRun && state && (
        <Button
          size="sm"
          variant="outline"
          pending={run.isPending}
          onClick={() => run.mutate()}
        >
          Run a lab check (about ${state.estimateUsd.toFixed(2)})
        </Button>
      )}
    </section>
  );
}
