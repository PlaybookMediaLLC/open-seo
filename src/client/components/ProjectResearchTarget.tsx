import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button } from "@/client/components/ui/button";
import { projectsQueryOptions } from "@/client/features/projects/projectQueries";

/** Selects a draft target only. The caller's Run action starts research. */
export function ProjectResearchTarget({
  projectId,
  onSelect,
}: {
  projectId: string;
  onSelect: (domain: string) => void;
}) {
  const projects = useQuery(projectsQueryOptions());
  const project = projects.data?.find((item) => item.id === projectId);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Button
        type="button"
        variant="outline"
        disabled={!project?.domain}
        onClick={() => project?.domain && onSelect(project.domain)}
      >
        Your site{project?.domain ? ` · ${project.domain}` : ""}
      </Button>
      <Button type="button" variant="ghost" onClick={() => onSelect("")}>
        Another site
      </Button>
      {project && !project.domain && (
        <Link
          to="/p/$projectId/settings"
          params={{ projectId }}
          className="underline"
        >
          Set your project website
        </Link>
      )}
      <p className="w-full text-muted-foreground">
        Choose a site to fill the form. Research starts only when you submit it.
      </p>
    </div>
  );
}
