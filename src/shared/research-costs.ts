import { getKeywordDataProvider } from "./keyword-locations";
import { creditsForProviderUsd } from "./billing";
import { costPerSerpAtDepth, serpKeywordCostMultiplier } from "./rank-tracking";

// Shared with the provider metering estimates; costs are raw USD before markup.
export const GOOGLE_ADS_LIVE_TASK_USD = 0.09;
export const KEYWORD_SERP_INITIAL_DEPTH = 20;
export const WEBSITE_RESEARCH_ESTIMATED_CREDITS = 200;

export function labsUsd(rows: number, clickstream = false) {
  return (0.012 + rows * 0.00012) * (clickstream ? 2 : 1);
}

/** Round each provider call exactly as the credit ledger does. */
export function researchCost(calls: number[]) {
  return {
    providerUsd: calls.reduce((sum, usd) => sum + usd, 0),
    credits: calls.reduce((sum, usd) => sum + creditsForProviderUsd(usd), 0),
  };
}

/** Fresh research, including auto-mode fallback and the first SERP per seed. */
export function keywordResearchCost(input: {
  keywords: string[];
  locationCode: number;
  locationName?: string;
  mode: "auto" | "related" | "suggestions" | "ideas";
  resultLimit: number;
  clickstream: boolean;
}) {
  const clickstream = input.clickstream && !input.locationName;
  const calls = input.keywords.flatMap((keyword) => {
    const research =
      getKeywordDataProvider(input.locationCode) === "google_ads"
        ? [GOOGLE_ADS_LIVE_TASK_USD]
        : input.mode === "auto"
          ? [
              labsUsd(Math.ceil(input.resultLimit / 2), clickstream),
              labsUsd(Math.ceil(input.resultLimit / 2), clickstream),
              labsUsd(input.resultLimit, clickstream),
            ]
          : [labsUsd(input.resultLimit, clickstream)];
    return [
      ...research,
      ...(input.locationName ? [GOOGLE_ADS_LIVE_TASK_USD] : []),
      costPerSerpAtDepth(KEYWORD_SERP_INITIAL_DEPTH, "live") *
        serpKeywordCostMultiplier(keyword),
    ];
  });
  return researchCost(calls);
}
