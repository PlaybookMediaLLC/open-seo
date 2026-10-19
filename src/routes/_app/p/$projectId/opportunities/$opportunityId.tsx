import { PublishingOpportunityPanel } from "@/client/features/publishing/PublishingOpportunityPanel";
import { PerformanceFieldResult } from "@/client/features/performance/PerformanceFieldResult";
import { AnchorDraftCard } from "@/client/features/publishing/AnchorDraftCard";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { QueryError } from "@/client/components/QueryState";
import { SkeletonPage } from "@/client/components/SkeletonPresets";
import { Badge } from "@/client/components/ui/badge";
import { getErrorCode } from "@/client/lib/error-messages";
import { OpportunityEvidenceHistory } from "@/client/features/opportunities/OpportunityEvidenceHistory";
import { OpportunityReview } from "@/client/features/opportunities/OpportunityReview";
import { OpportunityInvestigation } from "@/client/features/opportunities/OpportunityInvestigation";
import { ContentBriefCard } from "@/client/features/opportunities/ContentBriefCard";
import { BRIEF_OPPORTUNITY_TYPES } from "@/types/schemas/contentBriefs";
import {
  OwnerSelect,
  TicketSheet,
} from "@/client/features/opportunities/OpportunityOwnerAndTicket";
import {
  AuditAndLinkEvidence,
  CompetingPages,
  diagnosisLabels,
  Ga4Evidence,
  PaidEvidence,
} from "@/client/features/opportunities/OpportunitySignals";
import {
  ConnectSearchConsole,
  dateLabel,
  opportunityAccessOptions,
  opportunityKeys,
  OpportunityStatusBadge,
  StaleBadge,
  statusLabels,
  typeHelp,
  typeLabels,
} from "@/client/features/opportunities/shared";
import { getOpportunity } from "@/serverFunctions/opportunities";

export const Route = createFileRoute(
  "/_app/p/$projectId/opportunities/$opportunityId",
)({ component: OpportunityDetailPage });

function OpportunityDetailPage() {
  const { projectId, opportunityId } = Route.useParams();
  const access = useQuery(opportunityAccessOptions(projectId));
  const query = useQuery({
    queryKey: opportunityKeys.detail(projectId, opportunityId),
    queryFn: () => getOpportunity({ data: { projectId, opportunityId } }),
    staleTime: 0,
    retry: false,
  });
  const backLink = (
    <BackLink to="/p/$projectId/opportunities" params={{ projectId }}>
      Opportunities
    </BackLink>
  );
  if (query.isPending) return <SkeletonPage />;
  const notFound = query.isError && getErrorCode(query.error) === "NOT_FOUND";
  if (!query.data || notFound)
    return (
      <div className="mx-auto max-w-7xl space-y-4 p-6">
        {backLink}
        <QueryError
          error={notFound ? undefined : query.error}
          title={
            notFound ? "Opportunity not found" : "Could not load opportunity"
          }
          fallback={
            notFound
              ? "This opportunity does not exist or you do not have access to it."
              : "Could not load opportunity"
          }
          onRetry={notFound ? undefined : () => void query.refetch()}
        />
      </div>
    );
  const {
    opportunity: item,
    evidence,
    urls,
    ga4Evidence,
    decisions,
  } = query.data;
  const performance = query.data.performanceEvidence.find(
    (row) => row.runId === item.evidenceRunId,
  );
  const factors = [
    ["Commercial value", item.commercialScore],
    ["Search demand", item.demandScore],
    ["Visibility", item.visibilityScore],
    ["Difficulty", item.difficultyScore],
    ["Effort", item.effortScore],
  ] as const;
  return (
    <div className="overflow-auto page-pad">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title={item.title}
          backLink={backLink}
          description="Growth Operations · Opportunity review"
        />
        {query.isError ? (
          <QueryError
            error={query.error}
            fallback="Could not refresh this opportunity"
            onRetry={() => void query.refetch()}
          />
        ) : null}
        {access.isError ? (
          <QueryError
            error={access.error}
            fallback="Could not verify review permissions"
            onRetry={() => void access.refetch()}
          />
        ) : null}
        {access.data?.connected === false ? (
          <ConnectSearchConsole projectId={projectId} />
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <OpportunityStatusBadge status={item.status} />
          <Badge variant="outline">{typeLabels[item.type]}</Badge>
          <span className="text-sm text-muted-foreground">
            First detected {dateLabel(item.firstDetectedAt)}
          </span>
          {item.stale ? <StaleBadge /> : null}
          {item.deferredUntil &&
          new Date(item.deferredUntil).getTime() > Date.now() ? (
            <Badge variant="warning">
              Deferred until {dateLabel(item.deferredUntil)}
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">{typeHelp[item.type]}</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <OwnerSelect
            opportunity={item}
            canAssign={
              access.isSuccess && access.data.canReview && !query.isError
            }
          />
          <TicketSheet key={`ticket-${item.id}`} opportunity={item} />
        </div>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section className="rounded-xl border bg-card p-5 space-y-4">
            <h2 className="text-lg font-semibold">Why this matters</h2>
            <p className="text-sm leading-relaxed">{item.explanation}</p>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">
                  Search Console property
                </dt>
                <dd className="break-all">{item.siteUrl}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Page</dt>
                <dd className="break-all">{item.url}</dd>
              </div>
              {item.query ? (
                <div>
                  <dt className="text-muted-foreground">Search query</dt>
                  <dd>{item.query}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-foreground">Search intent</dt>
                <dd>{item.searchIntent}</dd>
              </div>
              {item.diagnosis ? (
                <div>
                  <dt className="text-muted-foreground">Diagnosis</dt>
                  <dd>{diagnosisLabels[item.diagnosis]}</dd>
                </div>
              ) : null}
            </dl>
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold">Recommended next step</h3>
              <p className="mt-1 text-sm leading-relaxed">
                {item.recommendedAction}
              </p>
            </div>
          </section>
          <section className="rounded-xl border bg-card p-5 space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Priority</p>
              <p className="text-3xl font-semibold tabular-nums">
                {item.priority}
                <span className="text-base font-normal text-muted-foreground">
                  {" "}
                  / 100
                </span>
              </p>
            </div>
            <dl className="space-y-2 text-sm">
              {factors.map(([label, score]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="tabular-nums">{score.toFixed(2)} / 1</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Estimated effort</dt>
                <dd>~{item.effortHours} hours</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Heuristic confidence</dt>
                <dd>{item.confidence.toFixed(2)} / 1</dd>
              </div>
            </dl>
            <p className="border-t pt-3 text-sm leading-relaxed">
              {item.scoreExplanation}
            </p>
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium">Uncertainty</p>
              <p className="mt-1 text-muted-foreground">
                {item.uncertainty} Confidence is a research heuristic, not the
                probability of a traffic gain.
              </p>
            </div>
          </section>
        </div>
        <CompetingPages urls={urls} />
        <AuditAndLinkEvidence
          detail={query.data}
          latestRunId={item.evidenceRunId}
        />
        <OpportunityEvidenceHistory
          evidence={evidence}
          latestRunId={item.evidenceRunId}
          query={item.query}
        />
        <Ga4Evidence rows={ga4Evidence} latestRunId={item.evidenceRunId} />
        <PaidEvidence detail={query.data} projectId={projectId} />
        {(BRIEF_OPPORTUNITY_TYPES as readonly string[]).includes(item.type) && (
          <ContentBriefCard
            opportunity={item}
            canRun={access.isSuccess && access.data.canReview && !query.isError}
          />
        )}
        {item.type === "internal_link" && (
          <AnchorDraftCard
            opportunity={item}
            canDraft={
              access.isSuccess && access.data.canReview && !query.isError
            }
          />
        )}
        {performance && (
          <PerformanceFieldResult
            projectId={projectId}
            opportunityId={item.id}
            metric={performance.metric}
          />
        )}
        {item.type === "declining_page" && (
          <OpportunityInvestigation
            projectId={projectId}
            opportunityId={item.id}
            canRun={access.isSuccess && access.data.canReview && !query.isError}
          />
        )}
        {/* Sibling keys must differ, or React keeps stale copies of a panel. */}
        <OpportunityReview
          key={`review-${item.id}`}
          opportunity={item}
          currentEvidenceReviewed={decisions.some(
            (decision) =>
              decision.decision === "reviewed" &&
              decision.evidenceRunId === item.evidenceRunId,
          )}
          canReview={
            access.isSuccess && access.data.canReview && !query.isError
          }
        />
        <PublishingOpportunityPanel
          key={`publishing-${item.id}`}
          opportunity={{
            ...item,
            accessibilityRule: query.data.accessibilityEvidence.find(
              (row) => row.runId === item.evidenceRunId,
            )?.ruleId,
          }}
          readOnly={query.isError}
        />
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Review history</h2>
          {decisions.length ? (
            <ol className="divide-y rounded-xl border">
              {decisions.map((decision) => (
                <li key={decision.id} className="space-y-2 p-4 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="font-medium">
                      {decision.decision === "deferred"
                        ? "Deferred for 7 days"
                        : `${statusLabels[decision.fromStatus]} → ${statusLabels[decision.toStatus]}`}
                    </p>
                    <time
                      dateTime={decision.createdAt}
                      className="text-muted-foreground"
                    >
                      {dateLabel(decision.createdAt)}
                    </time>
                  </div>
                  {decision.note ? (
                    <p className="whitespace-pre-wrap break-words">
                      {decision.note}
                    </p>
                  ) : null}
                  <p className="break-all text-xs text-muted-foreground">
                    Reviewer: {decision.actorUserId} · Evidence run:{" "}
                    {decision.evidenceRunId}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
              No review decisions yet.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
