import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { IconSearch as Search } from "@tabler/icons-react";
import { PageHeader } from "@/client/components/PageHeader";
import { QueryState } from "@/client/components/QueryState";
import { Button } from "@/client/components/ui/button";
import { OpportunityFilterBar } from "@/client/features/opportunities/OpportunityFilterBar";
import { OpportunityRunLog } from "@/client/features/opportunities/OpportunityRunLog";
import { OpportunitiesList } from "@/client/features/opportunities/OpportunitiesList";
import { ContentGapSheet } from "@/client/features/opportunities/PaidChecks";
import { ConversionRunButton } from "@/client/features/conversion/ConversionRunButton";
import { DocsRunButton } from "@/client/features/docs/DocsRunButton";
import { AccessibilityTrend } from "@/client/features/accessibility/AccessibilityTrend";
import { WebVitalsCard } from "@/client/features/performance/WebVitalsCard";
import {
  ConnectSearchConsole,
  dateLabel,
  opportunityKeys,
  opportunitySearchSchema,
  ownerOptions,
  PAGE_SIZE,
  type OpportunityFilters,
} from "@/client/features/opportunities/shared";
import {
  detectProjectOpportunities,
  listOpportunities,
} from "@/serverFunctions/opportunities";

export const Route = createFileRoute("/_app/p/$projectId/opportunities/")({
  validateSearch: opportunitySearchSchema,
  component: OpportunitiesPage,
});

function OpportunitiesPage() {
  const { projectId } = Route.useParams();
  // Remount mutation feedback when the project changes so one project's result
  // is never presented as the outcome for another project.
  return <ProjectOpportunities key={projectId} projectId={projectId} />;
}

function ProjectOpportunities({ projectId }: { projectId: string }) {
  const filters = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: [...opportunityKeys.all(projectId), "list", filters],
    queryFn: () =>
      listOpportunities({ data: { projectId, ...filters, limit: PAGE_SIZE } }),
    staleTime: 0,
    // Keep the filter bar mounted while a new filter loads, so keyboard
    // and screen-reader focus stays in the control the person is using.
    placeholderData: keepPreviousData,
    refetchInterval: (state) => {
      const run = state.state.data?.latestRun;
      return run?.status === "running" &&
        Date.now() - new Date(run.startedAt).getTime() < 180_000
        ? 5000
        : false;
    },
  });
  const detection = useMutation({
    mutationFn: () => detectProjectOpportunities({ data: { projectId } }),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: opportunityKeys.all(projectId),
      }),
    meta: { errorToast: false },
  });
  const update = (patch: Partial<OpportunityFilters>) => {
    void navigate({
      search: (previous) => ({ ...previous, offset: 0, ...patch }),
      replace: true,
    });
  };
  const owners = useQuery(ownerOptions(projectId));
  const filtered = Boolean(
    filters.status ||
    filters.type ||
    filters.minPriority ||
    filters.offset ||
    filters.owner ||
    filters.q ||
    filters.freshness !== "all",
  );
  return (
    <div className="overflow-auto page-pad">
      <div className="mx-auto max-w-7xl space-y-5">
        <PageHeader
          title="Opportunities"
          description="Growth Operations · Evidence-led improvements for your current project."
          actions={
            <details className="rounded-lg border bg-card p-3">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <Search className="size-4" />
                Find opportunities
              </summary>
              <div className="mt-3 flex max-w-lg flex-wrap gap-2">
                <Button
                  onClick={() => detection.mutate()}
                  pending={detection.isPending}
                  disabled={!query.data?.connected}
                >
                  Analyze connected search data
                </Button>
                {query.data?.connected ? (
                  <>
                    <ConversionRunButton projectId={projectId} />
                    <DocsRunButton projectId={projectId} />
                    <ContentGapSheet projectId={projectId} />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Connect Search Console to analyze this project.
                  </p>
                )}
              </div>
            </details>
          }
        />
        <div className="rounded-xl border bg-card p-4 text-sm space-y-1">
          <p className="font-medium">
            Uses connected data. Does not publish or change your site.
          </p>
          <details>
            <summary className="cursor-pointer text-muted-foreground">
              Sources and usage details
            </summary>
            <p className="text-muted-foreground">
              Detection makes at most 5 free Search Console requests, 1 GA4
              request and 10 URL inspections. Results are cached for 24 hours.
              It makes no paid calls. Content gaps and live results checks use
              paid data and show the cost first. Nothing is published or changed
              on your site.
            </p>
          </details>
        </div>
        {detection.isError ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive"
          >
            Detection could not finish. Check your Search Console connection and
            try again. No site changes were made.
          </p>
        ) : null}
        {detection.data ? (
          <p role="status" className="rounded-lg border p-3 text-sm">
            {detection.data.message}
          </p>
        ) : null}
        <QueryState query={query} errorFallback="Could not load opportunities">
          {(data) => (
            <>
              {!data.connected ? (
                <ConnectSearchConsole projectId={projectId} />
              ) : null}
              {!data.canReview ? (
                <p className="text-sm text-muted-foreground">
                  Only organization owners and admins can record review
                  decisions. Project members can run bounded, read-only
                  detection.
                </p>
              ) : null}
              {data.latestRun ? (
                <div
                  className="text-sm text-muted-foreground space-y-1"
                  aria-live="polite"
                >
                  <p>
                    Latest detection:{" "}
                    <span className="font-medium text-foreground">
                      {data.latestRun.status}
                    </span>{" "}
                    · {dateLabel(data.latestRun.startedAt)} ·{" "}
                    {data.latestRun.opportunityCount} opportunities
                  </p>
                  {data.latestRun.status === "running" &&
                  Date.now() - new Date(data.latestRun.startedAt).getTime() >=
                    180_000 ? (
                    <p>
                      This run may have been interrupted. Run detection again to
                      retry after the expired three-minute lease.
                    </p>
                  ) : null}
                  {data.latestRun.status === "failed" ? (
                    <p className="text-destructive">
                      Detection failed. Check the integration and retry.
                      Existing opportunities remain available.
                    </p>
                  ) : null}
                  {data.latestRun.truncated ? (
                    <p>
                      The source reached its row limit. These opportunities do
                      not cover all search data.
                    </p>
                  ) : null}
                </div>
              ) : null}
              <OpportunityRunLog runs={data.runs} />
              {data.connected || data.rows.length > 0 || filtered ? (
                <>
                  <OpportunityFilterBar
                    filters={filters}
                    onChange={update}
                    statusCounts={data.statusCounts}
                    owners={owners.data ?? []}
                  />
                  {filters.type === "accessibility_issue" ? (
                    <AccessibilityTrend projectId={projectId} />
                  ) : null}
                  {filters.type === "performance_issue" ? (
                    <WebVitalsCard projectId={projectId} />
                  ) : null}
                  <OpportunitiesList
                    rows={data.rows}
                    projectId={projectId}
                    filtered={filtered}
                    owners={owners.data ?? []}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <p className="text-muted-foreground">
                      {!data.rows.length
                        ? `0 opportunities on this page (${data.total} total)`
                        : `${filters.offset + 1}–${filters.offset + data.rows.length} of ${data.total} opportunities`}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        disabled={filters.offset === 0 || query.isFetching}
                        onClick={() =>
                          update({
                            offset: Math.max(0, filters.offset - PAGE_SIZE),
                          })
                        }
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        disabled={
                          filters.offset + PAGE_SIZE >= data.total ||
                          filters.offset + PAGE_SIZE > 10000 ||
                          query.isFetching
                        }
                        onClick={() =>
                          update({ offset: filters.offset + PAGE_SIZE })
                        }
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </>
          )}
        </QueryState>
      </div>
    </div>
  );
}
