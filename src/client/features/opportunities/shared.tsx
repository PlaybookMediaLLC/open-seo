import { Link } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/client/components/ui/button";
import { Badge } from "@/client/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/client/components/ui/tooltip";
import { listOpportunities } from "@/serverFunctions/opportunities";
import { getTeam } from "@/serverFunctions/organization";
import {
  OPPORTUNITY_FRESHNESS,
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_TYPES,
  type OpportunityStatus,
  type OpportunityType,
} from "@/types/schemas/opportunities";

export const opportunitySearchSchema = z.object({
  status: z.enum(OPPORTUNITY_STATUSES).optional().catch(undefined),
  type: z.enum(OPPORTUNITY_TYPES).optional().catch(undefined),
  minPriority: z.number().int().min(0).max(100).default(0).catch(0),
  sort: z.enum(["priority", "newest"]).default("priority").catch("priority"),
  includeDeferred: z.boolean().default(false).catch(false),
  offset: z.number().int().min(0).max(10000).default(0).catch(0),
  owner: z.string().trim().min(1).max(64).optional().catch(undefined),
  q: z.string().trim().min(1).max(200).optional().catch(undefined),
  freshness: z.enum(OPPORTUNITY_FRESHNESS).default("all").catch("all"),
});
export type OpportunityFilters = z.infer<typeof opportunitySearchSchema>;
export const PAGE_SIZE = 25;
export const opportunityKeys = {
  all: (projectId: string) => ["opportunities", projectId] as const,
  detail: (projectId: string, id: string) =>
    ["opportunities", projectId, "detail", id] as const,
};
export const opportunityAccessOptions = (projectId: string) =>
  queryOptions({
    queryKey: [...opportunityKeys.all(projectId), "access"],
    queryFn: () => listOpportunities({ data: { projectId, limit: 1 } }),
    staleTime: 0,
  });
export const typeLabels: Record<OpportunityType, string> = {
  striking_distance: "Striking distance",
  declining_page: "Declining page",
  low_ctr: "Low click-through",
  cannibalization: "Competing pages",
  technical_blocker: "Technical blocker",
  internal_link: "Internal link",
  content_gap: "Content gap",
  cro_low_conversion: "Low conversion",
  cro_form_drop_off: "Form drop-off",
  cro_device_gap: "Mobile conversion gap",
  cro_low_engagement: "Low engagement",
};
export const typeHelp: Record<OpportunityType, string> = {
  striking_distance:
    "The best page for a query ranks from position 5 to 20 with 100 or more impressions.",
  declining_page:
    "The page lost 20 or more clicks and 30% or more of its clicks compared with the previous period.",
  low_ctr:
    "The page got 60% or less of the clicks that pages on this site get at the same positions. Brand searches are left out.",
  cannibalization:
    "Two pages each get 25% or more of the impressions for the same searches. Brand searches are left out.",
  technical_blocker:
    "The latest site audit found a problem on a page with search impressions or on a key page.",
  internal_link:
    "A page that ranks for a key page's searches does not link to it yet.",
  content_gap:
    "Competitors rank in the top 10 for these commercial searches, and this site barely appears. Found with paid competitor data.",
  cro_low_conversion:
    "A landing page with 300 or more sessions converts at half or less of the median for pages with the same role, and the gap is 5 or more conversions.",
  cro_form_drop_off:
    "A page with 50 or more form starts gets 30% or fewer form submits.",
  cro_device_gap:
    "A page with 200 or more mobile sessions converts on mobile at half or less of its desktop rate.",
  cro_low_engagement:
    "A page with 300 or more sessions has an engagement rate of 40% or less, while the site median is 55% or more.",
};
export const statusLabels: Record<OpportunityStatus, string> = {
  discovered: "Discovered",
  reviewed: "Reviewed",
  approved: "Approved",
  in_progress: "In progress",
  implemented: "Implemented",
  measuring: "Measuring",
  completed: "Completed",
  rejected: "Rejected",
  failed: "Failed",
  reverted: "Reverted",
};
export function OpportunityStatusBadge({
  status,
}: {
  status: OpportunityStatus;
}) {
  return (
    <Badge
      variant={
        status === "approved" || status === "completed"
          ? "success"
          : status === "failed"
            ? "destructive"
            : "secondary"
      }
    >
      {statusLabels[status]}
    </Badge>
  );
}
export function ConnectSearchConsole({ projectId }: { projectId: string }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center space-y-3">
      <h2 className="font-semibold">Connect Google Search Console</h2>
      <p className="text-sm text-muted-foreground">
        Choose a Search Console property for this project in Integrations to
        discover opportunities from your own search data.
      </p>
      <Button
        nativeButton={false}
        render={
          <Link
            to="/p/$projectId/settings/integrations"
            params={{ projectId }}
          />
        }
      >
        Open integrations
      </Button>
    </div>
  );
}
export function dateLabel(value: string) {
  return new Date(value).toLocaleString();
}

export type OwnerOption = { userId: string; name: string };

/** Organization members who can own an opportunity (RFC-0003 5.1). */
export const ownerOptions = (projectId: string) =>
  queryOptions({
    queryKey: [...opportunityKeys.all(projectId), "owners"],
    queryFn: () => getTeam(),
    select: (team): OwnerOption[] =>
      team.members.map((member) => ({
        userId: member.userId,
        name: member.user.name || member.user.email,
      })),
    staleTime: 60_000,
  });

export function OwnerAvatar({ name }: { name: string | undefined }) {
  const initials = (name ?? "?")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold"
    >
      {initials}
    </span>
  );
}

export function StaleBadge() {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="cursor-help" />}>
        <Badge variant="outline" className="text-muted-foreground">
          Not in latest analysis
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        The latest analysis did not find this opportunity. The issue may be
        fixed, or the data may have changed.
      </TooltipContent>
    </Tooltip>
  );
}
