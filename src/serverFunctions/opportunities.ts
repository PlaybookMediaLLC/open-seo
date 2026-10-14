import { createServerFn } from "@tanstack/react-start";
import { OpportunityService } from "@/server/features/opportunities/services/OpportunityService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  detectOpportunitiesInputSchema,
  listOpportunitiesInputSchema,
  opportunityDetailInputSchema,
  reviewOpportunityInputSchema,
} from "@/types/schemas/opportunities";

export const listOpportunities = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(listOpportunitiesInputSchema)
  .handler(({ data, context }) =>
    OpportunityService.list(context, { ...data, projectId: context.projectId }),
  );

export const getOpportunity = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(opportunityDetailInputSchema)
  .handler(({ data, context }) =>
    OpportunityService.get(context, context.projectId, data.opportunityId),
  );

export const detectProjectOpportunities = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(detectOpportunitiesInputSchema)
  .handler(({ context }) =>
    OpportunityService.detect(context, context.projectId),
  );

export const reviewOpportunity = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(reviewOpportunityInputSchema)
  .handler(({ data, context }) =>
    OpportunityService.review(context, {
      ...data,
      projectId: context.projectId,
    }),
  );
