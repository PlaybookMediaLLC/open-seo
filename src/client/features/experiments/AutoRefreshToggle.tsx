import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/client/components/ui/switch";
import {
  getMeasurementSettings,
  saveMeasurementSettings,
} from "@/serverFunctions/experiments";

/** RFC-0006 5.3: the daily measurement refresh for one experiment. */
export function AutoRefreshToggle({
  projectId,
  experimentId,
}: {
  projectId: string;
  experimentId: string;
}) {
  const client = useQueryClient();
  const queryKey = ["experiments", projectId, "settings", experimentId];
  const settings = useQuery({
    queryKey,
    queryFn: () =>
      getMeasurementSettings({ data: { projectId, experimentId } }),
  });
  const save = useMutation({
    mutationFn: (autoRefresh: boolean) =>
      saveMeasurementSettings({
        data: {
          projectId,
          experimentId,
          autoRefresh,
          keyEvents: settings.data?.keyEvents ?? [],
        },
      }),
    onSettled: () => client.invalidateQueries({ queryKey }),
  });
  if (!settings.data) return null;
  const { autoRefresh, canManage, scheduledJobs } = settings.data;
  return (
    <label className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm">
      <Switch
        checked={autoRefresh && scheduledJobs}
        disabled={!canManage || !scheduledJobs || save.isPending}
        onCheckedChange={(checked) => save.mutate(checked)}
      />
      <span className="space-y-1">
        <span className="block font-medium">
          Refresh measurements automatically
        </span>
        <span className="block text-muted-foreground">
          {scheduledJobs
            ? "Once a day until the final result, within the limit of 5 refreshes a day for the project. Turn off Measurement refresh in Automation to stop it for every experiment."
            : "Scheduled jobs are not available on this installation. Refresh measurements by hand."}
        </span>
      </span>
    </label>
  );
}
