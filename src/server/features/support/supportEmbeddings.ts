import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { embedMany } from "ai";
import { holdResearch, settleResearch } from "@/server/billing/researchHold";
import type { ResearchSpend } from "@/server/billing/researchSpend";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import { openRouterCostUsd } from "@/server/lib/chatAgent";
import { getRequiredEnvValue } from "@/server/lib/runtime-env";

// RFC-0017 7: embeddings cost model credits, held first and settled at the
// provider's reported cost, as RFC-0009 does for drafts.
const MODEL = "openai/text-embedding-3-small";
const HOLD_CREDITS = 5;

export async function embedTexts(
  customer: BillingCustomerContext,
  values: string[],
) {
  if (!values.length) return [];
  const hold = await holdResearch(customer, {
    estimatedCredits: HOLD_CREDITS,
    ledgerFeature: "ai_research",
  });
  const spend: ResearchSpend[] = [];
  try {
    const openrouter = createOpenRouter({
      apiKey: await getRequiredEnvValue("OPENROUTER_API_KEY"),
    });
    const result = await embedMany({
      model: openrouter.textEmbeddingModel(MODEL),
      values,
      abortSignal: AbortSignal.timeout(60_000),
    });
    spend.push({
      provider: "openrouter",
      creditFeature: "agent",
      operation: "support_topics",
      costUsd: openRouterCostUsd(result.providerMetadata),
    });
    return result.embeddings;
  } finally {
    await settleResearch(customer, hold, spend);
  }
}
