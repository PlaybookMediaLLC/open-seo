import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/client/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/client/components/ui/sheet";
import { getWorkHistory } from "@/serverFunctions/work";

const LABELS = {
  completed: "Completed",
  measuring: "Measuring",
  next: "Next",
  waiting: "Waiting on you",
} as const;

/** RFC-0018 5.9: earlier weeks, as their weekly snapshots. */
export function WorkHistorySheet({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["work-history", projectId],
    queryFn: () => getWorkHistory({ data: { projectId } }),
    enabled: open,
  });
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        History
      </Button>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Earlier weeks</SheetTitle>
          <SheetDescription>
            Each week as Relay wrote it. Completed is recomputed when the week
            closes.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 text-sm">
          {query.isPending && <p role="status">Loading the history…</p>}
          {query.data?.length === 0 && <p>No weekly cycle has run yet.</p>}
          {query.data?.map((cycle) => (
            <section
              key={cycle.id}
              aria-label={`Week of ${cycle.weekStart}`}
              className="space-y-1"
            >
              <h3 className="font-medium">
                Week of{" "}
                {new Date(cycle.weekStart).toLocaleDateString(undefined, {
                  timeZone: "UTC",
                })}
                {cycle.status === "open" ? " (current)" : ""}
              </h3>
              <p className="text-muted-foreground">
                {cycle.completedCount} completed, {cycle.measuringCount}{" "}
                measuring, {cycle.nextCount} next, {cycle.waitingCount} waiting.
              </p>
              {cycle.emptyReasons && <p>{cycle.emptyReasons}</p>}
              <ul className="list-disc pl-5">
                {cycle.entries.map((entry) => (
                  <li key={entry.id}>
                    {LABELS[entry.section]}: {entry.title}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
