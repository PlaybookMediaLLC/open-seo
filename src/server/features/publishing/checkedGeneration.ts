import { generateText, NoObjectGeneratedError, Output } from "ai";
import type { z } from "zod";
import { billResearchSpend } from "@/server/billing/researchSpend";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import { requireOpenRouterCostUsd } from "@/server/lib/chatAgent";
import { buildChatAgentModel } from "@/server/lib/openrouter";
import {
  getOptionalEnvValue,
  getRequiredEnvValue,
} from "@/server/lib/runtime-env";

// RFC-0004: one model call with deterministic checks, retried once with the
// failure reasons. Each step bills the provider-reported cost as it finishes,
// so an admitted call is settled even if credits run out meanwhile.
const ATTEMPTS = 2;

export async function generateChecked<T>(options: {
  customer: BillingCustomerContext;
  operation: string;
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  check: (output: T) => string[];
  maxOutputTokens: number;
  timeoutMs: number;
}) {
  const model = buildChatAgentModel(
    await getRequiredEnvValue("OPENROUTER_API_KEY"),
    await getOptionalEnvValue("OPENROUTER_MODEL"),
    "low",
  );
  let output: T | null = null;
  let failures: string[] = [];
  let modelId = "unknown";
  let costUsd = 0;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    try {
      const result = await generateText({
        model,
        output: Output.object({ schema: options.schema }),
        // Answers are short; the headroom is for the model's reasoning.
        maxOutputTokens: options.maxOutputTokens,
        abortSignal: AbortSignal.timeout(options.timeoutMs),
        system: options.system,
        prompt: failures.length
          ? `${options.prompt}\n\nYour previous answer failed these checks. Fix every one:\n- ${failures.join("\n- ")}`
          : options.prompt,
        onStepFinish: async (step) => {
          const stepCost = requireOpenRouterCostUsd(step.providerMetadata);
          costUsd += stepCost;
          await billResearchSpend(options.customer, [
            {
              provider: "openrouter",
              creditFeature: "agent",
              operation: options.operation,
              costUsd: stepCost,
            },
          ]);
        },
      });
      modelId = result.response.modelId;
      output = result.output;
      failures = options.check(output);
    } catch (error) {
      if (!NoObjectGeneratedError.isInstance(error)) throw error;
      modelId = error.response?.modelId ?? modelId;
      output = null;
      failures = ["The answer did not match the required JSON format."];
    }
    if (!failures.length) break;
  }
  return {
    output: failures.length ? null : output,
    rejected: failures.length ? output : null,
    failures,
    modelId,
    costUsd,
  };
}
