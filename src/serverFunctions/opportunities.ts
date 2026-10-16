import { createServerFn } from "@tanstack/react-start";
import { BrandTermService } from "@/server/features/opportunities/services/BrandTermService";
import { ContentGapService } from "@/server/features/opportunities/services/ContentGapService";
import { SerpCheckService } from "@/server/features/opportunities/services/SerpCheckService";
import { OpportunityService } from "@/server/features/opportunities/services/OpportunityService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  brandTermsInputSchema,
  contentGapEstimateInputSchema,
  findContentGapsInputSchema,
  serpCheckInputSchema,
  detectOpportunitiesInputSchema,
  listOpportunitiesInputSchema,
  opportunityDetailInputSchema,
  reviewOpportunityInputSchema,
  updateBrandTermsInputSchema,
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

export const getBrandTerms = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(brandTermsInputSchema)
  .handler(({ context }) => BrandTermService.get(context.projectId));

export const updateBrandTerms = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(updateBrandTermsInputSchema)
  .handler(async ({ data, context }) => {
    // A person editing the context page. SAM and MCP write with their own author.
    await BrandTermService.save(context.projectId, data.terms, "user");
    return BrandTermService.get(context.projectId);
  });

// RFC-0002 phase 3. Each paid action shows its estimate first; the run
// refuses when the estimate rose above what the person confirmed.
export const estimateContentGaps = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(contentGapEstimateInputSchema)
  .handler(({ data, context }) =>
    ContentGapService.estimate(context, context.projectId, data.domains),
  );

export const findContentGaps = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(findContentGapsInputSchema)
  .handler(({ data, context }) =>
    ContentGapService.detect(context, {
      ...data,
      projectId: context.projectId,
    }),
  );

export const estimateLiveSerpCheck = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(opportunityDetailInputSchema)
  .handler(({ data, context }) =>
    SerpCheckService.estimate(context, context.projectId, data.opportunityId),
  );

export const checkLiveSerp = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(serpCheckInputSchema)
  .handler(({ data, context }) =>
    SerpCheckService.check(context, { ...data, projectId: context.projectId }),
  );
