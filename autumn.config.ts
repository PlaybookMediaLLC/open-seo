// Autumn pricing for the Playbook Media deployment. Feature and plan IDs must
// match src/shared/billing.ts; prices match src/client/features/billing/plan-offers.ts.
// Apply with `pnpm dlx atmn push` (preview) and `pnpm dlx atmn push --yes`
// using AUTUMN_SECRET_KEY. 1,000 credits = $1 (AUTUMN_SEO_DATA_CREDITS_PER_USD).
import { atmn, feature, plan } from "atmn";

export const managedServiceAccess = feature({
  internalId: "fe_3KhRKFpzyvIYeE3OtShc7dDGfUS",
  featureId: "managed_service_access",
  name: "Managed service access",
  type: "boolean",
});

export const paidPlan = feature({
  internalId: "fe_3KhRKL2pUGSO49ZDTMriWsb5TCj",
  featureId: "paid_plan",
  name: "Paid plan",
  type: "boolean",
});

// Monthly allowance, spent first.
export const usageCredits = feature({
  internalId: "fe_3KhRKGwUotVP0n1qBuMWBdt9BrG",
  featureId: "usage_credits",
  name: "Usage credits",
  type: "metered",
  consumable: true,
});

// Purchased top-ups, spent after usage_credits and never reset.
export const topupCredits = feature({
  internalId: "fe_3KhRKJxXGAZLhL3ySdafN9ZRsk6",
  featureId: "topup_credits",
  name: "Top-up credits",
  type: "metered",
  consumable: true,
});

// Default for every new organization. A small monthly allowance ($1) lets new
// users try paid research before subscribing.
export const free = plan({
  internalId: "prod_3KhRKK27tqsjwqcHAW887y0CWAC",
  planId: "free",
  versionSlug: "v1",
  active: true,
  name: "Free",
  group: "main",
  autoEnable: true,
  items: [
    { featureId: managedServiceAccess.featureId },
    {
      featureId: usageCredits.featureId,
      included: 1000,
      reset: { interval: "month" },
    },
    { featureId: topupCredits.featureId, included: 0 },
  ],
});

export const basePlan = plan({
  internalId: "prod_3KhRKFHSf3FCaoJTRKsRZ6fAutF",
  planId: "base-plan",
  versionSlug: "v1",
  active: true,
  name: "Base Plan",
  group: "main",
  price: { amount: 10, interval: "month" },
  items: [
    { featureId: managedServiceAccess.featureId },
    { featureId: paidPlan.featureId },
    {
      featureId: usageCredits.featureId,
      included: 10_000,
      reset: { interval: "month" },
    },
    { featureId: topupCredits.featureId, included: 0 },
  ],
});

// One-off credit purchase: $1 buys 1,000 credits, bought in any quantity.
export const creditTopUp = plan({
  internalId: "prod_3KhRKGhBwpsXi5yqY4vj68iWmA4",
  planId: "credit-top-up",
  versionSlug: "v1",
  active: true,
  name: "Credit Top-Up",
  addOn: true,
  items: [
    {
      featureId: topupCredits.featureId,
      price: {
        amount: 1,
        billingUnits: 1000,
        interval: "one_off",
        billingMethod: "prepaid",
      },
    },
  ],
});

export default atmn({
  features: [managedServiceAccess, paidPlan, usageCredits, topupCredits],
  plans: [free, basePlan, creditTopUp],
});
