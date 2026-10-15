import * as React from "react";
import { projectsQueryOptions } from "@/client/features/projects/projectQueries";
import { Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { findLast } from "remeda";
import {
  IconFolderCog as FolderCog,
  IconPlus as Plus,
  IconSettings as Settings,
} from "@tabler/icons-react";
import { setLastProjectId } from "@/client/lib/active-project";
import { CreateProjectModal } from "@/client/features/projects/CreateProjectModal";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/client/components/ui/combobox";
import { Button } from "@/client/components/ui/button";
import { Separator } from "@/client/components/ui/separator";
import { Skeleton } from "@/client/components/ui/skeleton";
import type { ProjectSummary } from "./types";

const SEARCH_THRESHOLD = 8;

function matchesProject(project: ProjectSummary, query: string) {
  const needle = query.trim().toLowerCase();
  return (
    project.name.toLowerCase().includes(needle) ||
    Boolean(project.domain?.toLowerCase().includes(needle))
  );
}

export function ProjectSwitcher({
  activeProjectId,
  ready,
  compact = false,
  onCloseDrawer,
}: {
  activeProjectId: string | null;
  /** The session is confirmed, so the projects list can load. */
  ready: boolean;
  /** The collapsed sidebar rail: just the project's initial, the list opens
   *  to the side. */
  compact?: boolean;
  onCloseDrawer?: () => void;
}) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const projectsQuery = useQuery({ ...projectsQueryOptions(), enabled: ready });
  const projects = projectsQuery.data ?? [];
  const activeProject =
    projects.find((project) => project.id === activeProjectId) ?? null;

  if (projectsQuery.isPending && compact) {
    return <Skeleton className="size-8 rounded-lg" aria-busy />;
  }
  if (projectsQuery.isPending) {
    // The loaded switcher's box: a name line, a domain line and the settings
    // button's slot, so nothing moves when the projects arrive.
    return (
      <div
        className="flex h-12 items-center gap-2.5 rounded-xl border border-sidebar-border bg-sidebar-active px-2 shadow-[0_1px_2px_rgb(0_0_0/0.04)]"
        aria-busy
      >
        <Skeleton className="size-7 rounded-lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    );
  }

  const handleSelect = (project: ProjectSummary) => {
    setOpen(false);
    onCloseDrawer?.();
    if (project.id === activeProjectId) return;
    setLastProjectId(project.id);
    // Keep the current section when it exists in the new project. Detail
    // routes refer to entities in the old project and fall back to the section.
    const stayable = findLast(
      router.state.matches,
      (match) =>
        match.fullPath.includes("$projectId") &&
        match.fullPath
          .split("/")
          .every(
            (segment) => !segment.startsWith("$") || segment === "$projectId",
          ),
    );
    const template = stayable?.fullPath ?? "/p/$projectId";
    void router.navigate({
      href: template.split("$projectId").join(project.id).replace(/\/$/, ""),
    });
  };

  return (
    <>
      <Combobox
        items={projects}
        value={activeProject}
        itemToStringLabel={(project) => project.name}
        isItemEqualToValue={(project, value) => project.id === value.id}
        filter={projects.length >= SEARCH_THRESHOLD ? matchesProject : null}
        autoHighlight
        open={open}
        onOpenChange={setOpen}
        onValueChange={(project) => {
          if (project) handleSelect(project);
        }}
      >
        {compact ? (
          <ComboboxTrigger
            aria-label={`Switch project${activeProject ? ` (${activeProject.name})` : ""}`}
            title={activeProject?.name}
            className="grid size-8 place-items-center rounded-lg bg-foreground text-[12px] font-semibold text-background outline-none ring-offset-2 ring-offset-sidebar transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-sidebar-ring [&>svg]:hidden"
          >
            {(activeProject?.name ?? "?").trim().charAt(0).toUpperCase()}
          </ComboboxTrigger>
        ) : (
          <div className="group/switcher flex h-12 items-center rounded-xl border border-sidebar-border bg-sidebar-active shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
            <ComboboxTrigger
              aria-label="Switch project"
              className="flex h-full min-w-0 flex-1 items-center gap-2.5 rounded-l-xl pl-[9px] pr-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <span
                aria-hidden
                className="grid size-7 shrink-0 place-items-center rounded-lg bg-foreground text-[12px] font-semibold text-background"
              >
                {(activeProject?.name ?? "?").trim().charAt(0).toUpperCase()}
              </span>
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-[13px] font-medium">
                  {activeProject?.name ?? "Select project"}
                </span>
                {activeProject?.domain ? (
                  <span className="truncate text-[11px] text-muted-foreground">
                    {activeProject.domain}
                  </span>
                ) : null}
              </span>
            </ComboboxTrigger>
            {activeProject ? (
              <Button
                nativeButton={false}
                render={
                  <Link
                    to="/p/$projectId/settings"
                    params={{ projectId: activeProject.id }}
                    aria-label="Project settings"
                    title="Project settings"
                    onClick={() => {
                      setOpen(false);
                      onCloseDrawer?.();
                    }}
                  />
                }
                variant="ghost"
                size="icon-sm"
                className="mr-1.5 text-muted-foreground hover:text-foreground"
              >
                <Settings className="size-4" />
              </Button>
            ) : null}
          </div>
        )}
        <ComboboxContent
          side={compact ? "right" : "bottom"}
          className={compact ? "w-64" : "w-(--anchor-width)"}
        >
          {projects.length >= SEARCH_THRESHOLD ? (
            <ComboboxInput
              className="w-auto"
              placeholder="Find project…"
              aria-label="Filter projects"
              showTrigger={false}
            />
          ) : null}
          {projects.length > 0 ? (
            <ComboboxEmpty>No projects match.</ComboboxEmpty>
          ) : null}
          <ComboboxList className="max-h-[min(60vh,21rem)]">
            {(project: ProjectSummary) => (
              <ComboboxItem key={project.id} value={project}>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{project.name}</span>
                  {project.domain ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {project.domain}
                    </span>
                  ) : null}
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
          <Separator />
          <div className="grid gap-0.5 p-1">
            <Button
              variant="ghost"
              className="justify-start"
              onClick={() => {
                setOpen(false);
                setCreating(true);
              }}
            >
              <Plus className="size-4" />
              New project
            </Button>
            <Button
              nativeButton={false}
              render={
                <Link
                  to="/projects"
                  onClick={() => {
                    setOpen(false);
                    onCloseDrawer?.();
                  }}
                />
              }
              variant="ghost"
              className="justify-start"
            >
              <FolderCog className="size-4" />
              Manage projects
            </Button>
          </div>
        </ComboboxContent>
      </Combobox>
      {creating ? (
        <CreateProjectModal
          onClose={() => {
            setCreating(false);
            onCloseDrawer?.();
          }}
        />
      ) : null}
    </>
  );
}
