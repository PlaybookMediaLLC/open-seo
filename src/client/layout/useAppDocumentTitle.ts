import { useMatchRoute, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { projectsQueryOptions } from "@/client/features/projects/projectQueries";
import {
  connectNavGroup,
  getProjectNavGroups,
} from "@/client/navigation/items";
import { BILLING_ROUTE } from "@/shared/billing";

/* Playbook fork: every app page was titled "Relay", so tabs and history all
   looked alike. Name each page after its sidebar item and project, such as
   "Opportunities · eigenn.io · Relay". Mounted in AppShell at a
   `// playbook-seam` line. */

/** Pages outside a project, by path prefix. */
const ACCOUNT_PAGES: [string, string][] = [
  ["/ai", "Agents"],
  ["/settings", "Settings"],
  [BILLING_ROUTE, "Billing"],
  ["/projects", "Projects"],
  ["/support", "Help & Community"],
];

export function useAppDocumentTitle(projectId: string | null, ready: boolean) {
  const matchRoute = useMatchRoute();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const projectsQuery = useQuery({ ...projectsQueryOptions(), enabled: ready });
  const project = projectsQuery.data?.find((item) => item.id === projectId);

  useEffect(() => {
    const account = ACCOUNT_PAGES.find(
      ([path]) => pathname === path || pathname.startsWith(`${path}/`),
    );
    let label = account?.[1];
    if (!label) {
      // The deepest matching sidebar item names the page: under
      // /ai-visibility/research it is Prompt Research, not Prompt Tracking.
      const items = projectId
        ? getProjectNavGroups(projectId).flatMap((group) => group.items)
        : connectNavGroup.items;
      let depth = -1;
      for (const item of items) {
        const exact = "activeOptions" in item && item.activeOptions?.exact;
        const params = "params" in item ? item.params : undefined;
        if (!matchRoute({ to: item.to, params, fuzzy: !exact })) continue;
        if (item.to.length > depth) {
          depth = item.to.length;
          label = item.label;
        }
      }
    }
    // Project settings has no sidebar item; the project switcher links to it.
    if (!label && /^\/p\/[^/]+\/settings(\/|$)/.test(pathname)) {
      label = "Project settings";
    }
    const scope = account ? undefined : project?.name;
    document.title = [label, scope, "Relay"].filter(Boolean).join(" · ");
  }, [matchRoute, pathname, project?.name, projectId]);
}
