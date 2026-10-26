import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/client/components/PageHeader";
import { QueryError } from "@/client/components/QueryState";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { dateLabel } from "@/client/features/opportunities/shared";
import { captureClientEvent } from "@/client/lib/posthog";
import { getThisWeek, saveWorkSettings } from "@/serverFunctions/work";
import { CycleSettingsSheet } from "./CycleSettingsSheet";
import { WorkHistorySheet } from "./WorkHistorySheet";
import { WorkReportSheet } from "./WorkReportSheet";

type Week = Awaited<ReturnType<typeof getThisWeek>>;
type Entry = Week["entries"][number];

const SECTIONS = [
  ["waiting", "Waiting on you", "Nothing is waiting on you."],
  ["next", "Next", "No new work is ready."],
  ["measuring", "Measuring", "No change is measuring now."],
  [
    "completed",
    "Completed",
    "No change was merged and deployed this week yet.",
  ],
] as const;
const APPROVALS = {
  none: null,
  review: "Review needed",
  approve_change: "Approve the change",
  merge: "Merge in GitHub",
} as const;

export const thisWeekKey = (projectId: string) => ["this-week", projectId];

function EntryCard({
  projectId,
  entry,
  section,
}: {
  projectId: string;
  entry: Entry;
  section: string;
}) {
  const approval = APPROVALS[entry.approvalNeeded];
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0 space-y-1">
        <p className="font-medium">{entry.title}</p>
        <p className="text-sm text-muted-foreground">{entry.reason}</p>
        <div className="flex flex-wrap gap-2 text-xs">
          {approval && <Badge variant="outline">{approval}</Badge>}
          {entry.effortHours !== null && (
            <span className="text-muted-foreground">
              About {entry.effortHours} hours (Relay&apos;s estimate)
            </span>
          )}
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        nativeButton={false}
        onClick={() => captureClientEvent("work_item:opened", { section })}
        render={
          entry.target.kind === "opportunity" ? (
            <Link
              to="/p/$projectId/opportunities/$opportunityId"
              params={{ projectId, opportunityId: entry.target.id }}
            />
          ) : entry.target.kind === "experiment" ? (
            <Link
              to="/p/$projectId/experiments/$experimentId"
              params={{ projectId, experimentId: entry.target.id }}
            />
          ) : (
            <Link to="/p/$projectId/experiments" params={{ projectId }} />
          )
        }
      >
        Open
      </Button>
    </li>
  );
}

/** RFC-0018 5.3 and 5.9: what Relay completed, measures and does next. */
export function ThisWeekPage({ projectId }: { projectId: string }) {
  const query = useQuery({
    queryKey: thisWeekKey(projectId),
    queryFn: () => getThisWeek({ data: { projectId } }),
  });
  const week = query.data;
  const client = useQueryClient();
  const toggleSchedule = useMutation({
    mutationFn: () => {
      if (!week)
        throw new Error("Load weekly settings before changing the schedule.");
      return saveWorkSettings({
        data: { ...week.settings, projectId, enabled: !week.scheduled },
      });
    },
    onSuccess: () =>
      client.invalidateQueries({ queryKey: thisWeekKey(projectId) }),
  });
  return (
    <div className="overflow-auto page-pad">
      <div className="mx-auto max-w-5xl space-y-5">
        <PageHeader
          title="Work"
          description={
            week
              ? `Week of ${new Date(week.weekStart).toLocaleDateString(undefined, { timeZone: "UTC" })}. ${week.snapshotAt ? `Weekly snapshot written ${dateLabel(week.snapshotAt)}; the lists below are live.` : "The lists below are live; no weekly snapshot yet."}`
              : "Completed, measuring and next, from real records."
          }
          actions={
            week && (
              <div className="flex flex-wrap gap-2">
                <WorkHistorySheet projectId={projectId} />
                <WorkReportSheet projectId={projectId} />
                {week.canManage && (
                  <CycleSettingsSheet
                    projectId={projectId}
                    settings={week.settings}
                  />
                )}
              </div>
            )
          }
        />
        {query.isError && (
          <QueryError
            error={query.error}
            fallback="Could not load this week. Try again."
          />
        )}
        {query.isPending && <p role="status">Loading this week…</p>}
        {week && (
          <section
            aria-label="Weekly review schedule"
            className="space-y-3 rounded-lg bg-muted p-4 text-sm"
          >
            <p className="font-medium">
              Weekly review is {week.scheduled ? "on" : "off"}.
            </p>
            <p>
              {week.scheduled ? "Next review" : "First review if enabled"}:{" "}
              {new Date(week.nextRunAt).toLocaleString(undefined, {
                timeZone: week.settings.timeZone,
              })}{" "}
              ({week.settings.timeZone}).
            </p>
            <p>
              The review refreshes older Search Console detections and saves a
              weekly snapshot of work. It does not run paid research, create
              pull requests, or deploy changes.
            </p>
            {week.canManage ? (
              <Button
                variant="outline"
                pending={toggleSchedule.isPending}
                onClick={() => toggleSchedule.mutate()}
              >
                {week.scheduled
                  ? "Pause weekly review"
                  : "Enable weekly review"}
              </Button>
            ) : (
              <p>Ask an owner to change the schedule.</p>
            )}
            {toggleSchedule.isError && (
              <QueryError
                error={toggleSchedule.error}
                fallback="Could not update the weekly review schedule"
              />
            )}
          </section>
        )}
        {week &&
          SECTIONS.map(([section, label, empty]) => {
            const entries = week.entries.filter(
              (entry) => entry.section === section,
            );
            if (section === "waiting" && !entries.length) return null;
            return (
              <section key={section} aria-label={label} className="space-y-2">
                <h2 className="text-lg font-semibold">
                  {label}{" "}
                  <span className="text-muted-foreground">
                    ({entries.length})
                  </span>
                </h2>
                {entries.length ? (
                  <ul className="space-y-2">
                    {entries.map((entry) => (
                      <EntryCard
                        key={`${entry.rank}-${entry.target.id}`}
                        projectId={projectId}
                        entry={entry}
                        section={section}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">{empty}</p>
                )}
                {section === "next" && week.emptyReasons && (
                  <p className="text-sm">{week.emptyReasons}</p>
                )}
              </section>
            );
          })}
      </div>
    </div>
  );
}
