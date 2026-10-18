import { createServerFn } from "@tanstack/react-start";
import { SpendLimitService } from "@/server/features/spend/SpendLimitService";
import {
  requireAuthenticatedContext,
  requireProjectContext,
} from "@/serverFunctions/middleware";
import {
  projectSpendSchema,
  saveOrganizationLimitSchema,
  saveProjectLimitSchema,
} from "@/types/schemas/spendLimits";

// RFC-0009 5.5: monthly credit limits and this month's committed spend.
export const getOrganizationSpend = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .handler(({ context }) => SpendLimitService.organization(context));

export const saveOrganizationLimit = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .validator(saveOrganizationLimitSchema)
  .handler(({ context, data }) =>
    SpendLimitService.save(context, { ...data, projectId: null }),
  );

export const getProjectSpend = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(projectSpendSchema)
  .handler(({ context }) =>
    SpendLimitService.project(context, context.projectId),
  );

export const saveProjectLimit = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(saveProjectLimitSchema)
  .handler(({ context, data }) =>
    SpendLimitService.save(context, {
      monthlyLimitCredits: data.monthlyLimitCredits,
      projectId: context.projectId,
    }),
  );
