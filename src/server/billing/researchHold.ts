import { isHostedServerAuthMode } from "@/server/lib/runtime-env";
import { billResearchSpend, type ResearchSpend } from "./researchSpend";
import { reserveWithinLimits } from "./spendAdmission";
import {
  getOrCreateOrganizationCustomer,
  settleUsageCredits,
  type BillingCustomerContext,
  type UsageCreditHold,
} from "./subscription";

// RFC-0009 5.3 and debt 3: AI research holds its estimate inside the monthly
// limits before the model call, so parallel requests cannot all pass one
// balance reading. The hold settles at the real cost, above or below it.

type ResearchHold = UsageCreditHold | null;

/** Holds the estimate in hosted mode; null where Relay meters nothing. */
export async function holdResearch(
  customer: BillingCustomerContext,
  input: { estimatedCredits: number; ledgerFeature?: string },
): Promise<ResearchHold> {
  if (!(await isHostedServerAuthMode())) return null;
  const billingCustomer = await getOrCreateOrganizationCustomer(customer);
  const { holds } = await reserveWithinLimits(
    {
      customer,
      customerId: billingCustomer.id,
      callCredits: [input.estimatedCredits],
      creditFeature: "agent",
      provider: "openrouter",
    },
    input.ledgerFeature,
  );
  return holds[0] ?? null;
}

/** Charges the research's real cost against its hold. Never throws. */
export async function settleResearch(
  customer: BillingCustomerContext,
  hold: ResearchHold,
  spend: ResearchSpend[],
) {
  if (!hold) return billResearchSpend(customer, spend);
  await settleUsageCredits({
    customer,
    hold,
    creditFeature: "agent",
    provider: "openrouter",
    costs: spend
      .filter((item) => item.costUsd > 0)
      .map((item) => ({
        costUsd: item.costUsd,
        path: [item.provider, item.operation],
      })),
  });
}
