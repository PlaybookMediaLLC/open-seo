import { createServerFn } from "@tanstack/react-start";
import { RevenueConnectionService } from "@/server/features/revenue/RevenueConnectionService";
import { RevenueReportService } from "@/server/features/revenue/RevenueReportService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  connectStripeInputSchema,
  revenueProjectSchema,
  revenueReportInputSchema,
} from "@/types/schemas/revenue";

// RFC-0016 5.3: the project's read-only Stripe connection.
export const getRevenueConnection = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(revenueProjectSchema)
  .handler(({ context }) =>
    RevenueConnectionService.status(context, context.projectId),
  );

export const connectStripe = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(connectStripeInputSchema)
  .handler(({ context, data }) =>
    RevenueConnectionService.connect(context, {
      ...data,
      projectId: context.projectId,
    }),
  );

export const disconnectStripe = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(revenueProjectSchema)
  .handler(({ context }) =>
    RevenueConnectionService.disconnect(context, context.projectId),
  );

// RFC-0016 5.6: revenue by first touch, coverage first.
export const getRevenueReport = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(revenueReportInputSchema)
  .handler(({ context, data }) =>
    RevenueReportService.report(context, {
      ...data,
      projectId: context.projectId,
    }),
  );
