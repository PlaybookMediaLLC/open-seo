import { createServerFn } from "@tanstack/react-start";
import { AccessibilityCheckService } from "@/server/features/accessibility/AccessibilityCheckService";
import { AccessibilityFixService } from "@/server/features/accessibility/AccessibilityFixService";
import { AltTextDraftService } from "@/server/features/accessibility/AltTextDraftService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  accessibilityFixInputSchema,
  accessibilityTrendInputSchema,
} from "@/types/schemas/accessibility";
import { experimentInputSchema } from "@/types/schemas/experiments";
import {
  draftAnchorInputSchema,
  opportunityDraftInputSchema,
} from "@/types/schemas/proposalDrafts";

// RFC-0013 5.4: prepare an alt text or page language fix for review.
export const prepareAccessibilityFix = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(accessibilityFixInputSchema)
  .handler(({ context, data }) =>
    AccessibilityFixService.prepare(context, {
      ...data,
      projectId: context.projectId,
    }),
  );

export const suggestAccessibleName = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(opportunityDraftInputSchema)
  .handler(({ context, data }) =>
    AccessibilityFixService.suggestName(context, {
      ...data,
      projectId: context.projectId,
    }),
  );

export const draftAltText = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(draftAnchorInputSchema)
  .handler(({ context, data }) =>
    AltTextDraftService.draft(context, {
      ...data,
      projectId: context.projectId,
    }),
  );

// RFC-0013 5.5: axe-core again on the live pages after the fix deploys.
export const checkAccessibilityFix = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(experimentInputSchema)
  .handler(({ context, data }) =>
    AccessibilityCheckService.check(context, {
      ...data,
      projectId: context.projectId,
    }),
  );

export const getAccessibilityFixCheck = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(experimentInputSchema)
  .handler(({ context, data }) =>
    AccessibilityCheckService.latest(context, {
      ...data,
      projectId: context.projectId,
    }),
  );

export const getAccessibilityTrend = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(accessibilityTrendInputSchema)
  .handler(({ context }) =>
    AccessibilityCheckService.trend(context, context.projectId),
  );
