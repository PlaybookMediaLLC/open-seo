import { Link } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/client/components/ui/button";
import { Badge } from "@/client/components/ui/badge";
import { listOpportunities } from "@/serverFunctions/opportunities";
import {
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
