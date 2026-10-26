import { generateText, NoObjectGeneratedError, Output } from "ai";
import type { z } from "zod";
import { holdResearch, settleResearch } from "@/server/billing/researchHold";
import type { ResearchSpend } from "@/server/billing/researchSpend";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import { requireOpenRouterCostUsd } from "@/server/lib/chatAgent";
import {
  buildChatAgentModel,
  requireOpenRouterAccess,
} from "@/server/lib/openrouter";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";

// RFC-0004: one model call with deterministic checks, retried once with the
// failure reasons. RFC-0009: the call holds its estimate inside the monthly
// limits first, and settles the provider-reported cost when it ends.
const ATTEMPTS = 2;
const HOLD_CREDITS = 50;

export async function generateChecked<T>(options: {
  customer: BillingCustomerContext;
  operation: string;
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  check: (output: T) => string[];
  maxOutputTokens: number;
  timeoutMs: number;
  /** Public image URLs that the model sees with the prompt. */
  images?: URL[];
}) {
  const model = buildChatAgentModel(
    await requireOpenRouterAccess(),
    await getOptionalEnvValue("OPENROUTER_MODEL"),
    "low",
  );
  let output: T | null = null;
  let failures: string[] = [];
  let modelId = "unknown";
  let costUsd = 0;
  const spend: ResearchSpend[] = [];
  const hold = await holdResearch(options.customer, {
    estimatedCredits: HOLD_CREDITS,
    ledgerFeature: options.operation.endsWith("_draft")
      ? "proposal_draft"
      : "ai_research",
  });
  try {
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const prompt = failures.length
        ? `${options.prompt}\n\nYour previous answer failed these checks. Fix every one:\n- ${failures.join("\n- ")}`
        : options.prompt;
      try {
        const result = await generateText({
          model,
          output: Output.object({ schema: options.schema }),
          // Answers are short; the headroom is for the model's reasoning.
          maxOutputTokens: options.maxOutputTokens,
          abortSignal: AbortSignal.timeout(options.timeoutMs),
          system: options.system,
          ...(options.images
            ? {
                messages: [
                  {
                    role: "user" as const,
                    content: [
                      { type: "text" as const, text: prompt },
                      ...options.images.map((image) => ({
                        type: "image" as const,
                        image,
                      })),
                    ],
                  },
                ],
              }
            : { prompt }),
          onStepFinish: (step) => {
            const stepCost = requireOpenRouterCostUsd(step.providerMetadata);
            costUsd += stepCost;
            spend.push({
              provider: "openrouter",
              creditFeature: "agent",
              operation: options.operation,
              costUsd: stepCost,
            });
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
  } finally {
    await settleResearch(options.customer, hold, spend);
  }
  return {
    output: failures.length ? null : output,
    rejected: failures.length ? output : null,
    failures,
    modelId,
    costUsd,
  };
}
