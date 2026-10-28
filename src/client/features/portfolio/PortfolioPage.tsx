import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, SectionHeader } from "@/client/components/PageHeader";
import { QueryState } from "@/client/components/QueryState";
import { Badge } from "@/client/components/ui/badge";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { LABEL_TEXT } from "@/client/features/experiments/labels";
import { statusLabels } from "@/client/features/opportunities/shared";
import { getPortfolio } from "@/serverFunctions/portfolio";
import { EXPERIMENT_LABELS } from "@/types/schemas/experiments";
import { OPPORTUNITY_STATUSES } from "@/types/schemas/opportunities";
import type {
  OrganizationSummary,
  PortfolioProject,
} from "@/types/schemas/portfolio";

// RFC-0007 6.1-6.2: every project of the organization side by side, and the
// clients that gave it agency access. Read-only; nothing here spends credits
// or calls Google.
export function PortfolioPage() {
  const query = useQuery({
    queryKey: ["portfolio"],
    queryFn: () => getPortfolio(),
  });
  return (
    <div className="h-full overflow-auto page-pad">
      <div className="mx-auto max-w-7xl space-y-8">
        <PageHeader
          title="Portfolio"
          description="Each project's open work, results, spending and search traffic, side by side."
        />
        <QueryState query={query} errorFallback="Could not load the portfolio">
          {(data) => (
            <>
              <OrganizationTable summary={data} linkProjects />
              {data.clients.map((client) => (
                <section key={client.linkId} className="space-y-3">
                  <SectionHeader
                    title={client.organizationName}
                    hint="Client organization. Read-only; its owner can end this access."
                  />
                  <OrganizationTable summary={client} linkProjects={false} />
                </section>
              ))}
              <p className="text-xs text-muted-foreground">
                Search traffic is each project's last 28 days of Search Console
                queries, as its dashboard last stored them. This page never asks
                Google for new data, and queries Search Console keeps private
                are not counted.
              </p>
            </>
          )}
        </QueryState>
      </div>
    </div>
  );
}

function OrganizationTable({
  summary,
  linkProjects,
}: {
  summary: OrganizationSummary;
  linkProjects: boolean;
}) {
  if (!summary.projects.length)
    return <p className="text-sm text-muted-foreground">No active projects.</p>;
  return (
    <div className="space-y-2">
      <p className="text-sm">
        {summary.committed.toLocaleString()} credits committed in{" "}
        {summary.periodMonth}
        {summary.limit === null
          ? ", no organization limit."
          : ` of a ${summary.limit.toLocaleString()} credit limit.`}{" "}
        {linkProjects ? (
          <Link to="/billing" className="text-primary underline">
            Change limits
          </Link>
        ) : null}
      </p>
      <TableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Open opportunities</TableHead>
              <TableHead>Experiments</TableHead>
              <TableHead className="text-right">Credits this month</TableHead>
              <TableHead className="text-right">Clicks</TableHead>
              <TableHead className="text-right">Impressions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.projects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                linkProjects={linkProjects}
              />
            ))}
          </TableBody>
        </Table>
      </TableCard>
    </div>
  );
}

function ProjectRow({
  project,
  linkProjects,
}: {
  project: PortfolioProject;
  linkProjects: boolean;
}) {
  const statuses = OPPORTUNITY_STATUSES.flatMap((status) => {
    const total = project.opportunitiesByStatus[status];
    return total ? [`${total} ${statusLabels[status].toLowerCase()}`] : [];
  });
  const { search } = project;
  return (
    <TableRow>
      <TableCell className="max-w-[240px]">
        {linkProjects ? (
          <Link
            to="/p/$projectId"
            params={{ projectId: project.id }}
            className="block truncate font-medium hover:underline"
          >
            {project.name}
          </Link>
        ) : (
          <span className="block truncate font-medium">{project.name}</span>
        )}
        <span className="block truncate text-xs text-muted-foreground">
          {project.domain ?? "No domain set"}
        </span>
      </TableCell>
      <TableCell>
        <span className="font-medium">{project.openOpportunities}</span>
        {statuses.length ? (
          <span className="block text-xs text-muted-foreground">
            {statuses.join(", ")}
          </span>
        ) : null}
      </TableCell>
      <TableCell>
        <span className="flex flex-wrap gap-1">
          {EXPERIMENT_LABELS.filter((label) => project.experiments[label]).map(
            (label) => (
              <Badge key={label} variant="outline" size="sm">
                {LABEL_TEXT[label]}: {project.experiments[label]}
              </Badge>
            ),
          )}
          {EXPERIMENT_LABELS.every((label) => !project.experiments[label]) ? (
            <span className="text-xs text-muted-foreground">None</span>
          ) : null}
        </span>
      </TableCell>
      <TableCell className="text-right">
        {project.spend.committed.toLocaleString()}
        {project.spend.limit === null ? null : (
          <span className="block text-xs text-muted-foreground">
            of {project.spend.limit.toLocaleString()}
          </span>
        )}
      </TableCell>
      {search.status === "loaded" ? (
        <>
          <TableCell className="text-right">
            {Math.round(search.clicks).toLocaleString()}
            <span className="block text-xs text-muted-foreground">
              {search.sameDates
                ? `${search.startDate} to ${search.endDate}`
                : `Other dates: ${search.startDate} to ${search.endDate}`}
            </span>
          </TableCell>
          <TableCell className="text-right">
            {Math.round(search.impressions).toLocaleString()}
          </TableCell>
        </>
      ) : (
        <TableCell
          colSpan={2}
          className="text-right text-xs text-muted-foreground"
        >
          {search.status === "not_connected"
            ? "Search Console not connected"
            : "Open the project's dashboard to load its search data"}
        </TableCell>
      )}
    </TableRow>
  );
}
