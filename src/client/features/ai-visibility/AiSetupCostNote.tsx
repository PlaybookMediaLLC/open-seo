import { isHostedClientAuthMode } from "@/lib/auth-mode";
import { AI_RECORD_COST_USD } from "@/shared/ai-visibility";
import { creditsForProviderUsd } from "@/shared/billing";
import { WEBSITE_RESEARCH_ESTIMATED_CREDITS } from "@/shared/research-costs";

export function AiSetupCostNote() {
  const hosted = isHostedClientAuthMode();
  const answerCredits = creditsForProviderUsd(AI_RECORD_COST_USD);
  return (
    <div className="space-y-2 rounded-lg border p-3 text-sm">
      <p>
        {hosted
          ? `Research estimate: ${WEBSITE_RESEARCH_ESTIMATED_CREDITS} credits ($${(WEBSITE_RESEARCH_ESTIMATED_CREDITS / 1000).toFixed(3)}).`
          : "Research is billed to your own model and search-provider accounts."}{" "}
        Actual research usage can be higher or lower; this estimate is not a
        spending cap.
      </p>
      <p>
        If tracking is new, setup adds up to 15 ChatGPT prompts, runs them once,
        and schedules weekly checks starting at least one week later. Each fresh
        answer is estimated at{" "}
        {hosted
          ? `${answerCredits} credits ($${(answerCredits / 1000).toFixed(3)})`
          : `$${AI_RECORD_COST_USD.toFixed(4)}`}
        ; a full 15-prompt check is{" "}
        {hosted
          ? `${15 * answerCredits} credits ($${((15 * answerCredits) / 1000).toFixed(3)})`
          : `$${(15 * AI_RECORD_COST_USD).toFixed(3)}`}
        .
      </p>
      <p>
        Existing tracking stays unchanged. You can review prompts and pause the
        schedule in Track &amp; results.
      </p>
    </div>
  );
}
