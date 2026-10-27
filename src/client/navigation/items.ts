import { sortBy } from "remeda";
import {
  IconBookmark as Bookmark,
  IconRobot as Bot,
  IconBrain as Brain,
  IconChartLine as ChartLine,
  IconClipboardCheck as ClipboardCheck,
  IconFileText as FileText,
  IconFlask as FlaskConical,
  IconWorld as Globe,
  IconLayoutDashboard as LayoutDashboard,
  IconListCheck as ListCheck, // playbook-seam
  IconLink as Link2,
  IconMessage as MessageSquare,
  IconSearch as Search,
  IconTrendingUp as TrendingUp,
  IconTarget as Target,
} from "@tabler/icons-react";
import { linkOptions } from "@tanstack/react-router";
import { GoogleGlyphMuted } from "@/client/features/gsc/GoogleGlyph";

const projectNavItems = [
  { to: "/p/$projectId/work" as const, label: "This week", icon: ListCheck }, // playbook-seam
  {
    to: "/p/$projectId" as const,
    label: "Home",
    icon: LayoutDashboard,
    // Without exact matching, the index path is a prefix of every project
    // route and the Dashboard item would render active everywhere.
    activeOptions: { exact: true, includeSearch: false },
  },
  {
    to: "/p/$projectId/opportunities" as const,
    label: "Opportunities",
    icon: Target,
  },
  {
    to: "/p/$projectId/experiments" as const,
    label: "Experiments & Results",
    icon: FlaskConical,
  },
  {
    to: "/p/$projectId/keywords" as const,
    label: "Keyword Research",
    icon: Search,
  },
  {
    to: "/p/$projectId/saved" as const,
    label: "Saved Keywords",
    icon: Bookmark,
  },
  {
    to: "/p/$projectId/rank-tracking" as const,
    label: "Rank Tracking",
    icon: TrendingUp,
  },
  {
    to: "/p/$projectId/search-performance" as const,
    label: "Search Performance",
    icon: GoogleGlyphMuted,
  },
  {
    to: "/p/$projectId/domain" as const,
    label: "Domain Overview",
    icon: Globe,
  },
  {
    to: "/p/$projectId/backlinks" as const,
    label: "Backlinks",
    icon: Link2,
  },
  {
    to: "/p/$projectId/audit" as const,
    label: "Site Audit",
    icon: ClipboardCheck,
  },
  {
    to: "/p/$projectId/ai-visibility" as const,
    label: "AI visibility",
    icon: ChartLine,
    activeOptions: { exact: true, includeSearch: false },
  },
  {
    to: "/p/$projectId/ai-visibility/research" as const,
    label: "Prompt Research",
    icon: Search,
  },
  {
    to: "/p/$projectId/prompt-explorer" as const,
    label: "Prompt Explorer",
    icon: MessageSquare,
  },
  {
    to: "/p/$projectId/reports" as const,
    label: "Reports",
    icon: FileText,
  },
  {
    to: "/p/$projectId/context" as const,
    label: "Business context",
    icon: Brain,
  },
] as const;

// Agent connections are a workspace utility, independent of the project.
const aiNavItem = linkOptions({
  to: "/ai" as const,
  label: "Agents",
  icon: Bot,
});

// Also used by the shell utility links.
export const connectNavGroup = {
  label: "Connections",
  items: [aiNavItem],
};

function getProjectNavItems(projectId: string) {
  return linkOptions(
    projectNavItems.map((item) => ({
      ...item,
      params: { projectId },
      search: {},
    })),
  );
}

// Keep existing URLs; each workspace exposes its related views in the shell.
export function getProjectNavGroups(projectId: string) {
  const all = getProjectNavItems(projectId);
  const byPath = (path: (typeof projectNavItems)[number]["to"]) =>
    // oxlint-disable-next-line typescript/no-non-null-assertion -- `path` is typed to projectNavItems' routes and `all` maps every one of them, so find always matches.
    all.find((i) => i.to === path)!;

  return [
    { label: "Home", items: [byPath("/p/$projectId")] },
    {
      label: "Work",
      items: [
        byPath("/p/$projectId/work"), // playbook-seam
        byPath("/p/$projectId/opportunities"),
        byPath("/p/$projectId/experiments"),
      ],
    },
    {
      label: "Research",
      items: [
        byPath("/p/$projectId/keywords"),
        byPath("/p/$projectId/domain"),
        byPath("/p/$projectId/backlinks"),
      ],
    },
    {
      label: "Monitor",
      items: [
        byPath("/p/$projectId/search-performance"),
        byPath("/p/$projectId/ai-visibility"),
        byPath("/p/$projectId/ai-visibility/research"),
        byPath("/p/$projectId/prompt-explorer"),
        byPath("/p/$projectId/audit"),
        byPath("/p/$projectId/rank-tracking"),
      ],
    },
    {
      label: "Library",
      items: [
        byPath("/p/$projectId/reports"),
        byPath("/p/$projectId/saved"),
        byPath("/p/$projectId/context"),
      ],
    },
  ];
}

/** The deepest route wins, including nested prompt history and opportunity pages. */
export function getProjectNavGroup(projectId: string, pathname: string) {
  pathname = pathname.replace(/\/+$/, "") || "/";
  const matches = getProjectNavGroups(projectId)
    .flatMap((group) =>
      group.items.map((item) => ({
        group,
        path: item.to.replace("$projectId", projectId),
      })),
    )
    .filter(
      ({ path }) =>
        pathname === path ||
        (path !== `/p/${projectId}` && pathname.startsWith(`${path}/`)),
    );
  return sortBy(matches, [(item) => item.path.length, "desc"])[0]?.group;
}

export const dataforseoHelpLinkOptions = linkOptions({
  to: "/help/dataforseo-api-key",
});

/** Provider setup belongs to the research views that require it. */
export function isPaidResearchPath(pathname: string) {
  return /^\/p\/[^/]+\/(?:keywords|domain|backlinks|rank-tracking|ai-visibility|prompt-explorer)(?:\/|$)/.test(
    pathname,
  );
}
