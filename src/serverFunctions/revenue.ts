import { createServerFn } from "@tanstack/react-start";
import { RevenueConnectionService } from "@/server/features/revenue/RevenueConnectionService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  connectStripeInputSchema,
  revenueProjectSchema,
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
