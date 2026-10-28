import { z } from "zod";
import { EXPERIMENT_LABELS } from "./experiments";
import { OPPORTUNITY_STATUSES, OPPORTUNITY_TYPES } from "./opportunities";

// RFC-0007 6.1-6.2: one read-only row per active project, built from the
// tables and caches each project already has.
const count = z.number().int().nonnegative();

// Search Console totals come only from the dashboard's stored rows, so a
// project whose dashboard never loaded says so instead of showing zero.
const searchTotalsSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("not_connected") }),
  z.object({ status: z.literal("not_loaded") }),
  z.object({
    status: z.literal("loaded"),
    clicks: z.number().nonnegative(),
    impressions: z.number().nonnegative(),
    startDate: z.string(),
    endDate: z.string(),
    fetchedAt: z.string(),
    // False when this project's stored window is not the newest one shown.
    sameDates: z.boolean(),
  }),
]);

const portfolioProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string().nullable(),
  openOpportunities: count,
  opportunitiesByStatus: z.partialRecord(z.enum(OPPORTUNITY_STATUSES), count),
  opportunitiesByType: z.partialRecord(z.enum(OPPORTUNITY_TYPES), count),
  experiments: z.record(z.enum(EXPERIMENT_LABELS), count),
  spend: z.object({ committed: count, limit: count.nullable() }),
  search: searchTotalsSchema,
});
export type PortfolioProject = z.infer<typeof portfolioProjectSchema>;

const organizationSummarySchema = z.object({
  organizationId: z.string(),
  periodMonth: z.string(),
  committed: count,
  limit: count.nullable(),
  projects: z.array(portfolioProjectSchema),
});
export type OrganizationSummary = z.infer<typeof organizationSummarySchema>;

const portfolioSchema = organizationSummarySchema.extend({
  // RFC-0007 6.6: client organizations whose owner accepted this one as their
  // agency. Read-only, and only what the summary shows.
  clients: z.array(
    organizationSummarySchema.extend({
      linkId: z.string(),
      organizationName: z.string(),
    }),
  ),
});
export type Portfolio = z.infer<typeof portfolioSchema>;

// RFC-0007 6.6: agency links, from either side.
export const requestAgencyLinkInputSchema = z.object({
  clientOrganizationId: z.string().min(1),
});
export const agencyLinkInputSchema = z.object({ linkId: z.string().min(1) });

const agencyLinkSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  organizationName: z.string(),
  status: z.enum(["pending", "active"]),
  requestedAt: z.string(),
  acceptedAt: z.string().nullable(),
});
export type AgencyLink = z.infer<typeof agencyLinkSchema>;
