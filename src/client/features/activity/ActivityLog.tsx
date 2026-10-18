import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CardShell } from "@/client/components/CardShell";
import { QueryError } from "@/client/components/QueryState";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { downloadFile } from "@/client/lib/download";
import { exportActivityCsv, getActivity } from "@/serverFunctions/activity";
import { AUDIT_ACTIONS } from "@/shared/auditActions";
import type { ActivityFilters } from "@/types/schemas/activity";

const select = "h-8 rounded-md border bg-background px-2 text-sm";
const label = (action: string) =>
  action.replace(".", ": ").replaceAll("_", " ");

/** RFC-0009 5.6: who did what, newest first. */
export function ActivityLog() {
  const [filters, setFilters] = useState<ActivityFilters>({});
  const activity = useQuery({
    queryKey: ["activity", filters],
    queryFn: () => getActivity({ data: filters }),
  });
  const download = useMutation({
    mutationFn: () => exportActivityCsv({ data: filters }),
    onSuccess: (csv) =>
      downloadFile(csv, "relay-activity.csv", "text/csv;charset=utf-8"),
  });
  const rows = activity.data ?? [];
  const projects = [
    ...new Map(
      rows.flatMap((row) =>
        row.projectId
          ? [[row.projectId, row.projectName ?? row.projectId]]
          : [],
      ),
    ),
  ];
  const actors = [
    ...new Map(rows.map((row) => [row.actorId, row.actorName ?? row.actorId])),
  ];
  return (
    <CardShell
      title="Activity"
      action={
        <Button
          type="button"
          size="sm"
          variant="outline"
          pending={download.isPending}
          onClick={() => download.mutate()}
        >
          Download CSV
        </Button>
      }
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <select
          className={select}
          aria-label="Filter by project"
          value={filters.projectId ?? ""}
          onChange={(event) =>
            setFilters({
              ...filters,
              projectId: event.target.value || undefined,
            })
          }
        >
          <option value="">All projects</option>
          {projects.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          className={select}
          aria-label="Filter by action"
          value={filters.action ?? ""}
          onChange={(event) =>
            setFilters({
              ...filters,
              action: AUDIT_ACTIONS.find((item) => item === event.target.value),
            })
          }
        >
          <option value="">All actions</option>
          {AUDIT_ACTIONS.map((action) => (
            <option key={action} value={action}>
              {label(action)}
            </option>
          ))}
        </select>
        <select
          className={select}
          aria-label="Filter by person"
          value={filters.actorId ?? ""}
          onChange={(event) =>
            setFilters({ ...filters, actorId: event.target.value || undefined })
          }
        >
          <option value="">Everyone</option>
          {actors.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>
      {activity.isError ? (
        <QueryError
          error={activity.error}
          fallback="We couldn't load the activity."
          onRetry={() => void activity.refetch()}
          isRetrying={activity.isFetching}
        />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {activity.isPending ? "Loading…" : "No activity yet."}
        </p>
      ) : (
        <ul className="divide-y text-sm">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-start gap-3 py-2">
              <time
                dateTime={row.createdAt}
                className="w-36 shrink-0 text-xs text-muted-foreground"
              >
                {new Date(row.createdAt).toLocaleString()}
              </time>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p>{row.summary}</p>
                <p className="text-xs text-muted-foreground">
                  {row.actorName ?? row.actorId} · {label(row.action)}
                  {row.projectName ? ` · ${row.projectName}` : ""}
                </p>
              </div>
              {row.actorType !== "user" && (
                <Badge variant="outline">
                  {row.actorType === "mcp" ? "AI agent" : "Scheduled"}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </CardShell>
  );
}
