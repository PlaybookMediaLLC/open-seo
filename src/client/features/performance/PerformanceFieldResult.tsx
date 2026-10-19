import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/client/components/ui/button";
import {
  getPerformanceResult,
  refreshPerformanceResult,
} from "@/serverFunctions/performance";
import {
  FIELD_DATA_LIMITS,
  METRIC_NAMES,
  metricValue,
  type PerformanceMetric,
} from "@/shared/performance";

/** RFC-0014 5.6: field data before and after a performance change. */
export function PerformanceFieldResult(props: {
  projectId: string;
  opportunityId: string;
  metric: PerformanceMetric;
}) {
  const scope = {
    projectId: props.projectId,
    opportunityId: props.opportunityId,
  };
  const queryKey = ["performance-result", props.projectId, props.opportunityId];
  const client = useQueryClient();
  const query = useQuery({
    queryKey,
    queryFn: () => getPerformanceResult({ data: scope }),
  });
  const refresh = useMutation({
    meta: { errorToast: false },
    mutationFn: () => refreshPerformanceResult({ data: scope }),
    onSuccess: (data) => client.setQueryData(queryKey, data),
  });
  const result = query.data;
  const value = (number: number) => metricValue(props.metric, number);
  return (
    <section
      className="rounded-xl border bg-card p-5 space-y-3 text-sm"
      aria-label="Field result"
    >
      <h2 className="text-lg font-semibold">Field result</h2>
      {result?.status === "not_implemented" && (
        <p>
          Mark this item implemented when the change is live. Relay measures
          field data from that day.
        </p>
      )}
      {result?.status === "not_configured" && (
        <p>Chrome UX Report access is not configured on this server.</p>
      )}
      {result?.status === "waiting" && (
        <p>
          Field data needs 4 weeks after the change on {result.changedOn}, then
          4 weekly points. Check again on {result.readyOn}.
        </p>
      )}
      {result?.status === "not_enough_data" && (
        <p>
          The Chrome UX Report has fewer than 4 measured weeks before or after
          the change for this page.
        </p>
      )}
      {result?.status === "measured" && (
        <p>
          <span className="font-medium capitalize">{result.label}</span>:{" "}
          {METRIC_NAMES[props.metric]} was {value(result.before)} (
          {result.beforeRating}) and is {value(result.after)} (
          {result.afterRating}). Medians of 4 weekly 28-day points before{" "}
          {result.changedOn}, and of 4 points from 4 weeks after it.
        </p>
      )}
      {refresh.isError && (
        <p role="alert" className="text-destructive">
          {refresh.error.message}
        </p>
      )}
      <p className="text-muted-foreground">{FIELD_DATA_LIMITS}</p>
      {result && result.status !== "not_implemented" && (
        <Button
          size="sm"
          variant="outline"
          pending={refresh.isPending}
          onClick={() => refresh.mutate()}
        >
          Check the field result
        </Button>
      )}
    </section>
  );
}
