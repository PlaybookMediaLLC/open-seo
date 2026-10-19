import { createServerFn } from "@tanstack/react-start";
import { PerformanceFixService } from "@/server/features/performance/PerformanceFixService";
import { PerformanceLabService } from "@/server/features/performance/PerformanceLabService";
import { PerformanceVitalsService } from "@/server/features/performance/PerformanceVitalsService";
import { PerformanceResultService } from "@/server/features/performance/PerformanceResultService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { accessibilityProjectInputSchema } from "@/types/schemas/accessibility";
import { performanceFixInputSchema } from "@/types/schemas/performance";
import { opportunityDraftInputSchema } from "@/types/schemas/proposalDrafts";

// RFC-0014 5.6: the field result of a performance item.
export const getPerformanceResult = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(opportunityDraftInputSchema)
  .handler(({ context, data }) =>
    PerformanceResultService.get(context, {
      ...data,
      projectId: context.projectId,
    }),
  );

export const refreshPerformanceResult = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(opportunityDraftInputSchema)
  .handler(({ context, data }) =>
    PerformanceResultService.refresh(context, {
      ...data,
      projectId: context.projectId,
    }),
  );

// RFC-0014 5.5: prepare a performance fix in code for review.
export const preparePerformanceFix = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(performanceFixInputSchema)
  .handler(({ context, data }) =>
    PerformanceFixService.prepare(context, {
      ...data,
      projectId: context.projectId,
    }),
  );

// RFC-0014 5.6: lab checks of three Lighthouse runs.
export const getPerformanceLab = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(opportunityDraftInputSchema)
  .handler(({ context, data }) =>
    PerformanceLabService.state(context, {
      ...data,
      projectId: context.projectId,
    }),
  );

export const runPerformanceLab = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(opportunityDraftInputSchema)
  .handler(({ context, data }) =>
    PerformanceLabService.run(context, {
      ...data,
      projectId: context.projectId,
    }),
  );

// RFC-0014 5.7: the snippet's events from the site's own GA4.
export const getWebVitalsReport = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(accessibilityProjectInputSchema)
  .handler(({ context }) =>
    PerformanceVitalsService.report(context, context.projectId),
  );
