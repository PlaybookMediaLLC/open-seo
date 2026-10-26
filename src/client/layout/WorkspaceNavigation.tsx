import { TaskRecipes } from "@/client/features/projects/TaskRecipes";
import { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { IconSearch } from "@tabler/icons-react";
import {
  getProjectNavGroup,
  getProjectNavGroups,
} from "@/client/navigation/items";
import { NavTab, NavTabs } from "@/client/components/NavTabs";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/client/components/ui/dialog";

/** Shared workspace views retain all existing project URLs. */
export function WorkspaceNavigation({ projectId }: { projectId: string }) {
  const groups = getProjectNavGroups(projectId);
  const { pathname } = useLocation();
  const activeGroup = getProjectNavGroup(projectId, pathname);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-2 md:px-6">
      <div className="min-w-0 max-w-full overflow-x-auto">
        {activeGroup && activeGroup.items.length > 1 ? (
          <NavTabs label={`${activeGroup.label} views`}>
            {activeGroup.items
              .filter(
                (item) =>
                  item.to !== "/p/$projectId/ai-visibility/research" &&
                  item.to !== "/p/$projectId/prompt-explorer",
              )
              .map(({ icon: _icon, label, ...item }) => (
                <NavTab
                  key={item.to}
                  {...item}
                  className="shrink-0 whitespace-nowrap"
                >
                  {label}
                </NavTab>
              ))}
          </NavTabs>
        ) : (
          <p className="text-sm font-medium">
            {activeGroup?.label ??
              (pathname.startsWith(`/p/${projectId}/settings`)
                ? "Project settings"
                : null)}
          </p>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="outline" />}>
          <IconSearch /> Search &amp; start a task
        </DialogTrigger>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Find a task or view</DialogTitle>
            <DialogDescription>
              Work in the selected project. Opening a task does not run research
              or spend credits.
            </DialogDescription>
          </DialogHeader>
          {!search.trim() && <TaskRecipes projectId={projectId} />}
          <Input
            aria-label="Search tasks and views"
            placeholder="Try keywords, opportunities, reports…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="max-h-[55dvh] space-y-4 overflow-auto">
            {groups.map((group) => {
              const items = group.items.filter((item) =>
                `${group.label} ${item.label}`
                  .toLowerCase()
                  .includes(search.toLowerCase().trim()),
              );
              if (!items.length) return null;
              return (
                <section key={group.label} aria-label={group.label}>
                  <h3 className="mb-1 text-sm font-semibold text-muted-foreground">
                    {group.label}
                  </h3>
                  {items.map(({ icon: Icon, label, ...item }) => (
                    <Link
                      key={item.to}
                      {...item}
                      onClick={() => setOpen(false)}
                      className="flex min-h-11 items-center gap-3 rounded-lg px-3 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <Icon className="size-4" />
                      {label}
                    </Link>
                  ))}
                </section>
              );
            })}
            {!groups.some((group) =>
              group.items.some((item) =>
                `${group.label} ${item.label}`
                  .toLowerCase()
                  .includes(search.toLowerCase().trim()),
              ),
            ) && (
              <p role="status" className="text-sm">
                No matching tasks. Try a different name.
              </p>
            )}
            <Link
              to="/ai"
              onClick={() => setOpen(false)}
              className="block border-t pt-3 text-sm underline"
            >
              Connect an agent for guided tasks
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
