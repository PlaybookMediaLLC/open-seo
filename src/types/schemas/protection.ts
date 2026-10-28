import { z } from "zod";
import {
  MAX_MONITORED_PAGES,
  MONITORED_PAGE_REASONS,
  PROTECTION_STATUSES,
} from "@/shared/protection";
// The shared `{ projectId }` input every project-scoped function takes.
import { publishingProjectInputSchema as projectScope } from "@/types/schemas/publishing";

// RFC-0026 phase A (IRFC-0001): the protected-site record's inputs.
export const protectionProjectInputSchema = projectScope;

export const saveProtectionSettingsInputSchema = projectScope.extend({
  productionOrigin: z.url({ protocol: /^https$/ }).max(300),
  checkHourUtc: z.number().int().min(0).max(23),
  reviewerUserId: z.string().min(1).nullable(),
  notes: z.string().trim().max(1000).nullable(),
  allowRepairProposals: z.boolean(),
  allowPullRequests: z.boolean(),
});

// Each list stays inside D1's 100 bound parameters per statement.
const pageIds = z.array(z.string().min(1)).max(50);
export const saveMonitoredPagesInputSchema = projectScope.extend({
  expectedScopeVersion: z.number().int().positive(),
  add: z
    .array(
      z.object({
        // A path, or a URL on the production origin.
        path: z.string().trim().min(1).max(2000),
        selectionReason: z.enum(MONITORED_PAGE_REASONS),
      }),
    )
    .max(MAX_MONITORED_PAGES)
    .default([]),
  remove: pageIds.default([]),
  exclude: z
    .array(
      z.object({
        pageId: z.string().min(1),
        reason: z.string().trim().min(1).max(300),
      }),
    )
    .max(50)
    .default([]),
  include: pageIds.default([]),
});

export const setProtectionStatusInputSchema = projectScope.extend({
  status: z.enum(PROTECTION_STATUSES),
});
