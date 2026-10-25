import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CopyButton } from "@/client/components/CopyButton";
import { projectsQueryOptions } from "./projectQueries";

const recipes = [
  {
    title: "Prioritize the next week",
    sources: "existing opportunities, reviews and measurements",
    output:
      "A short weekly plan with source links, blockers and the next decision for each item.",
  },
  {
    title: "Explain a traffic change",
    sources: "connected Search Console observations and existing page evidence",
    output:
      "A report separating measured changes from possible causes, with date ranges and evidence limits.",
  },
  {
    title: "Prepare a competitor brief",
    sources: "saved competitors, project context and existing research",
    output:
      "A comparison brief that links every claim to its source and identifies missing evidence.",
  },
];

/** Explicit handoffs use existing connected agents and the project's report library. */
export function TaskRecipes({ projectId }: { projectId: string }) {
  const projects = useQuery(projectsQueryOptions());
  const project = projects.data?.find((item) => item.id === projectId);
  if (!project) return null;
  return (
    <section
      aria-label="Guided tasks"
      className="space-y-3 rounded-xl border p-4"
    >
      <h3 className="font-semibold">Guided tasks for {project.name}</h3>
      <p className="text-sm text-muted-foreground">
        Copy a brief into your connected agent. Copying uses no credits. The
        agent must check available sources and present an estimate before paid
        research.
      </p>
      {recipes.map((recipe) => (
        <details key={recipe.title} className="border-t pt-2">
          <summary className="cursor-pointer text-sm font-medium">
            {recipe.title}
          </summary>
          <p className="mt-2 text-sm">Sources needed: {recipe.sources}.</p>
          <p className="my-2 text-sm">Output: {recipe.output}</p>
          <CopyButton
            size="default"
            label="Copy project brief"
            successMessage="Project brief copied"
            value={[
              `Task: ${recipe.title}`,
              `Project: ${project.name} (id: ${projectId}, website: ${project.domain ?? "not configured"}). Use this project id for every tool call.`,
              `Inspect ${recipe.sources}. Identify missing connections before running work. Reuse saved results where possible.`,
              "Present the action estimate and check the organization balance and project spending limit before any paid research. Request approval for paid work. Do not publish, merge or deploy changes.",
              recipe.output,
              `Save the report in project ${projectId} using the connected report tools, including sources, dates, work completed and remaining steps. Return the saved report link so this task can be resumed from the project Reports view.`,
            ].join("\n\n")}
          />
        </details>
      ))}
      <div className="flex flex-wrap gap-4 text-sm">
        <Link to="/ai" className="underline">
          Connect an agent
        </Link>
        <Link
          to="/p/$projectId/reports"
          params={{ projectId }}
          className="underline"
        >
          Open saved reports
        </Link>
      </div>
    </section>
  );
}
