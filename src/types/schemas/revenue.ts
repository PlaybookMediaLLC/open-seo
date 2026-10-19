import { z } from "zod";

// RFC-0016: the read-only Stripe connection and the revenue reports.
export const revenueProjectSchema = z.object({ projectId: z.string().min(1) });
export const connectStripeInputSchema = revenueProjectSchema.extend({
  key: z.string().trim().min(10).max(300),
});
export const revenueReportInputSchema = revenueProjectSchema.extend({
  days: z.union([z.literal(30), z.literal(90), z.literal(365)]).default(90),
});

type RevenueWindow = {
  newCustomers: number;
  revenue: Array<{ currency: string; revenueMinor: number }>;
};
/** RFC-0016 5.7: revenue from the changed page, in the experiment windows. */
export type ExperimentRevenue =
  | { enough: false; minimum: number }
  | { enough: true; baseline: RevenueWindow; observation: RevenueWindow };
