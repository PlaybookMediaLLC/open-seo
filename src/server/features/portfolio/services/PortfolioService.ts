import type { EnsuredUserContext } from "@/middleware/ensure-user/types";
import { organizationSpend } from "@/server/billing/spendQueries";
import { DashboardSiteService } from "@/server/features/dashboard/services/DashboardSiteService";
import { ExperimentRepository } from "@/server/features/experiments/repositories/ExperimentRepository";
import { listProjects } from "@/server/features/projects/services/projects";
import type {
  OrganizationSummary,
  Portfolio,
  PortfolioProject,
} from "@/types/schemas/portfolio";
import { PortfolioRepository } from "../repositories/PortfolioRepository";

type PortfolioContext = Pick<EnsuredUserContext, "organizationId">;

const NO_EXPERIMENTS = {
  encouraging: 0,
  inconclusive: 0,
  negative: 0,
  measuring: 0,
};

// RFC-0007 6.2: Search Console totals from the dashboard's stored 28-day
// queries only. A project whose dashboard has not loaded them shows that, and
// the page never calls Google.
async function searchTotals(
  projectId: string,
  organizationId: string,
): Promise<PortfolioProject["search"]> {
  const { connected, cached } = await DashboardSiteService.getCachedKeywords(
    projectId,
    organizationId,
  );
  if (!connected) return { status: "not_connected" };
  if (!cached?.value.connected) return { status: "not_loaded" };
  const { rows, startDate, endDate } = cached.value;
  return {
    status: "loaded",
    clicks: rows.reduce((sum, row) => sum + row.clicks, 0),
    impressions: rows.reduce((sum, row) => sum + row.impressions, 0),
    startDate,
    endDate,
    fetchedAt: cached.fetchedAt,
    sameDates: true,
  };
}

/** RFC-0007 6.1: one row per active project, from what each project has. */
async function organizationSummary(
  organizationId: string,
): Promise<OrganizationSummary> {
  const [projects, opportunityRows, experiments, spend] = await Promise.all([
    listProjects(organizationId),
    PortfolioRepository.openOpportunityCounts(organizationId),
    ExperimentRepository.labelCountsForOrganization(organizationId),
    organizationSpend(organizationId),
  ]);
  const searches = await Promise.all(
    projects.map((project) => searchTotals(project.id, organizationId)),
  );
  // Compare like with like: the newest stored window is the reference.
  const newest = searches.reduce(
    (latest, search) =>
      search.status === "loaded" && search.endDate > latest
        ? search.endDate
        : latest,
    "",
  );
  return {
    organizationId,
    periodMonth: spend.periodMonth,
    committed: spend.committed,
    limit: spend.limit,
    projects: projects.map((project, index) => {
      const rows = opportunityRows.filter(
        (row) => row.projectId === project.id,
      );
      const byStatus: PortfolioProject["opportunitiesByStatus"] = {};
      const byType: PortfolioProject["opportunitiesByType"] = {};
      for (const row of rows) {
        byStatus[row.status] = (byStatus[row.status] ?? 0) + row.total;
        byType[row.type] = (byType[row.type] ?? 0) + row.total;
      }
      const spent = spend.projects.find((row) => row.id === project.id);
      const search = searches[index] ?? { status: "not_loaded" };
      return {
        id: project.id,
        name: project.name,
        domain: project.domain,
        openOpportunities: rows.reduce((sum, row) => sum + row.total, 0),
        opportunitiesByStatus: byStatus,
        opportunitiesByType: byType,
        experiments: experiments.get(project.id) ?? NO_EXPERIMENTS,
        spend: {
          committed: spent?.committed ?? 0,
          limit: spent?.limit ?? null,
        },
        search:
          search.status === "loaded"
            ? { ...search, sameDates: search.endDate === newest }
            : search,
      };
    }),
  };
}

/**
 * The caller's organization, and each client organization whose owner
 * accepted it as their agency (RFC-0007 6.6). Read-only for every member.
 */
async function summary(context: PortfolioContext): Promise<Portfolio> {
  const [own, clients] = await Promise.all([
    organizationSummary(context.organizationId),
    PortfolioRepository.activeClients(context.organizationId),
  ]);
  return {
    ...own,
    clients: await Promise.all(
      clients.map(async (client) => ({
        ...(await organizationSummary(client.organizationId)),
        linkId: client.linkId,
        organizationName: client.organizationName,
      })),
    ),
  };
}

export const PortfolioService = { summary };
