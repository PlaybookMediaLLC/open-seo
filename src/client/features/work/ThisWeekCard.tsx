import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button } from "@/client/components/ui/button";
import { getThisWeek } from "@/serverFunctions/work";
import { thisWeekKey } from "./ThisWeekPage";

/** RFC-0018 5.9: the section counts and the top Next item, on the home. */
export function ThisWeekCard({ projectId }: { projectId: string }) {
  const query = useQuery({
    queryKey: thisWeekKey(projectId),
    queryFn: () => getThisWeek({ data: { projectId } }),
  });
  const week = query.data;
  if (!week) return null;
  const count = (section: string) =>
    week.entries.filter((entry) => entry.section === section).length;
  const top = week.entries.find((entry) => entry.section === "next");
  return (
    <section
      aria-label="This week"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 text-sm"
    >
      <div className="space-y-1">
        <h2 className="font-semibold">This week</h2>
        <p className="text-muted-foreground">
          {count("completed")} completed, {count("measuring")} measuring,{" "}
          {count("next")} next
          {count("waiting") ? `, ${count("waiting")} waiting on you` : ""}.
        </p>
        <p>
          {top ? `Next: ${top.title}` : "Nothing worth changing this week."}
        </p>
      </div>
      <Button
        variant="outline"
        nativeButton={false}
        render={<Link to="/p/$projectId/work" params={{ projectId }} />}
      >
        Open this week
      </Button>
    </section>
  );
}
