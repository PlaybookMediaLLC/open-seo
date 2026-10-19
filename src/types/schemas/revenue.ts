import { z } from "zod";

// RFC-0016: the read-only Stripe connection and the revenue reports.
export const revenueProjectSchema = z.object({ projectId: z.string().min(1) });
export const connectStripeInputSchema = revenueProjectSchema.extend({
  key: z.string().trim().min(10).max(300),
});
