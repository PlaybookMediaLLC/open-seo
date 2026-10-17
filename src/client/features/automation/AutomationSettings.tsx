import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CardShell } from "@/client/components/CardShell";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/client/components/ui/sheet";
import { Switch } from "@/client/components/ui/switch";
import {
  getAutomation,
  getGrowthRunLogs,
  saveGrowthSchedule,
} from "@/serverFunctions/automation";

const JOBS = {
  opportunity_refresh: {
    label: "Opportunity refresh",
    text: "Runs the Search Console analysis and tells you about new high-priority items. Weekly on the free plan; daily needs a paid plan.",
  },
  measurement_refresh: {
    label: "Measurement refresh",
    text: "Refreshes each tracked change once a day until its result is final.",
  },
  deployment_check: {
    label: "Deployment check",
    text: "Looks for production deployment signals on merged changes. You still confirm the deployment.",
  },
  traffic_watch: {
    label: "Traffic watch",
    text: "Compares the last 7 days of search clicks with the 4 weeks before them. Paid plans.",
  },
  recommendation_recheck: {
    label: "Recommendation re-check",
    text: "Counts open items that the latest analysis no longer found. It changes no status.",
  },
} as const;
type Kind = keyof typeof JOBS;
type Schedule = {
  kind: Kind;
  enabled: boolean;
  interval: "daily" | "weekly";
  hourUtc: number;
  nextRunAt: string | null;
  ownedByViewer: boolean;
};
const hour = (value: number) => `${String(value).padStart(2, "0")}:00 UTC`;

/** RFC-0008 5.10: scheduled jobs, their owner and their run history. */
export function AutomationSettings({ projectId }: { projectId: string }) {
  const client = useQueryClient();
  const queryKey = ["automation", projectId];
  const automation = useQuery({
    queryKey,
    queryFn: () => getAutomation({ data: { projectId } }),
  });
  const save = useMutation({
    mutationFn: (schedule: Schedule) =>
      saveGrowthSchedule({ data: { projectId, ...schedule } }),
    onSettled: () => client.invalidateQueries({ queryKey }),
  });
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [logsFor, setLogsFor] = useState<string | null>(null);
  if (!automation.data) return null;
  const { available, canManage, schedules, runs } = automation.data;
  return (
    <div className="space-y-6">
      {!available && (
        <p role="status" className="rounded-lg border p-3 text-sm">
          Scheduled jobs are not available on this installation.
        </p>
      )}
      <CardShell title="Scheduled jobs">
        <p className="mb-3 text-sm text-muted-foreground">
          Jobs run with the permissions of the member who last changed them.
          They use no credits and never change your site.
        </p>
        <ul className="divide-y">
          {schedules.map((schedule) => (
            <li
              key={schedule.kind}
              className="flex flex-wrap items-start gap-3 py-3 text-sm"
            >
              <Switch
                checked={schedule.enabled}
                disabled={!canManage || save.isPending}
                aria-label={`Turn ${JOBS[schedule.kind].label} on or off`}
                onCheckedChange={(enabled) =>
                  save.mutate({ ...schedule, enabled })
                }
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-medium">{JOBS[schedule.kind].label}</p>
                <p className="text-muted-foreground">
                  {JOBS[schedule.kind].text}
                </p>
                <p className="text-xs text-muted-foreground">
                  {schedule.interval === "daily" ? "Daily" : "Weekly"} at{" "}
                  {hour(schedule.hourUtc)}
                  {schedule.nextRunAt &&
                    ` · next run ${new Date(schedule.nextRunAt).toLocaleString()}`}
                  {schedule.enabled &&
                    ` · runs as ${schedule.ownedByViewer ? "you" : "another member"}`}
                </p>
              </div>
              {canManage && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(schedule)}
                >
                  Edit
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardShell>
      <CardShell title="Run history">
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No runs yet.</p>
        ) : (
          <ul className="divide-y text-sm">
            {runs.map((run) => (
              <li
                key={run.id}
                className="flex flex-wrap items-start gap-3 py-2"
              >
                <Badge
                  variant={
                    run.status === "failed"
                      ? "destructive"
                      : run.status === "succeeded"
                        ? "success"
                        : "outline"
                  }
                >
                  {run.status}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p>
                    {run.kind === "audit_followup"
                      ? "Audit follow-up"
                      : JOBS[run.kind].label}{" "}
                    · {run.windowKey}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {run.summary ?? run.skipReason ?? run.error ?? ""}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setLogsFor(run.id)}
                >
                  Logs
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardShell>
      {editing && (
        <EditSchedule
          schedule={editing}
          onClose={() => setEditing(null)}
          onSave={(schedule) => {
            save.mutate(schedule);
            setEditing(null);
          }}
        />
      )}
      {logsFor && (
        <RunLogs
          projectId={projectId}
          runId={logsFor}
          onClose={() => setLogsFor(null)}
        />
      )}
    </div>
  );
}

function EditSchedule({
  schedule,
  onClose,
  onSave,
}: {
  schedule: Schedule;
  onClose: () => void;
  onSave: (schedule: Schedule) => void;
}) {
  const [draft, setDraft] = useState(schedule);
  const select = "h-9 w-full rounded-md border bg-background px-2 text-sm";
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{JOBS[schedule.kind].label}</SheetTitle>
          <SheetDescription>
            Saving makes you the member whose permissions this job uses.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4">
          <label className="block space-y-1 text-sm">
            <span>How often</span>
            <select
              className={select}
              value={draft.interval}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  interval:
                    event.target.value === "weekly" ? "weekly" : "daily",
                })
              }
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span>Time (UTC)</span>
            <select
              className={select}
              value={draft.hourUtc}
              onChange={(event) =>
                setDraft({ ...draft, hourUtc: Number(event.target.value) })
              }
            >
              {Array.from({ length: 24 }, (_, value) => (
                <option key={value} value={value}>
                  {hour(value)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <SheetFooter>
          <Button type="button" onClick={() => onSave(draft)}>
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function RunLogs({
  projectId,
  runId,
  onClose,
}: {
  projectId: string;
  runId: string;
  onClose: () => void;
}) {
  const logs = useQuery({
    queryKey: ["automation", projectId, "logs", runId],
    queryFn: () => getGrowthRunLogs({ data: { projectId, runId } }),
  });
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Run logs</SheetTitle>
          <SheetDescription>At most 50 lines per run.</SheetDescription>
        </SheetHeader>
        <ul className="space-y-1 overflow-y-auto px-4 pb-4 text-xs">
          {logs.data?.length === 0 && (
            <li className="text-muted-foreground">No log lines.</li>
          )}
          {logs.data?.map((line, index) => (
            <li key={`${line.at}-${index}`}>
              <span className="text-muted-foreground">
                {new Date(line.at).toLocaleTimeString()} {line.level}
              </span>{" "}
              {line.message}
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
