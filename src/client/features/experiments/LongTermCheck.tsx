import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { refreshExperimentMeasurements } from "@/serverFunctions/experiments";
import type { ExperimentDetail } from "@/types/schemas/experiments";
import { useRefreshExperiments } from "./queries";

/** RFC-0006 5.4: a second look at days 63 to 90, beside the first result. */
export function LongTermCheck({
  detail,
  canManage,
}: {
  detail: ExperimentDetail;
  canManage: boolean;
}) {
  const { experiment, latestRun, longTermRun, longTermDays } = detail;
  const refresh = useRefreshExperiments(experiment.projectId);
  const [message, setMessage] = useState<string | null>(null);
  const check = useMutation({
    meta: { errorToast: false },
    mutationFn: () =>
      refreshExperimentMeasurements({
        data: {
          projectId: experiment.projectId,
          experimentId: experiment.id,
          window: "long_term",
        },
      }),
    onSuccess: async (result) => {
      setMessage(result.message);
      await refresh();
    },
    onError: () =>
      setMessage("Could not run the long-term check. Retry later."),
  });
  if (!latestRun?.windowComplete) return null;
  return (
    <section
      className="space-y-3 rounded-xl border bg-card p-5"
      aria-label="Long-term check"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Long-term check</h2>
        {longTermRun && (
          <Badge
            variant={
              longTermRun.outcome === "negative" ? "warning" : "secondary"
            }
          >
            long-term: {longTermRun.outcome}
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Compares days 63 to 90 after deployment with the same baseline and the
        same rules. It never replaces the first result.
      </p>
      {longTermRun && (
        <p className="text-sm">
          {longTermRun.explanation} ({longTermDays.length}/28 days reported)
        </p>
      )}
      {canManage && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          pending={check.isPending}
          onClick={() => {
            setMessage(null);
            check.mutate();
          }}
        >
          Check again at 90 days
        </Button>
      )}
      {message && (
        <p role="status" className="text-xs">
          {message}
        </p>
      )}
    </section>
  );
}
