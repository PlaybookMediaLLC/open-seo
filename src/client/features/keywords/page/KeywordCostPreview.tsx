import { isHostedClientAuthMode } from "@/lib/auth-mode";
import { keywordResearchCost } from "@/shared/research-costs";
import { parseKeywordInput } from "../state/keywordControllerActions";
import type { KeywordControlsValues } from "../hooks/useKeywordControlsForm";

export function KeywordCostPreview({
  values,
}: {
  values: KeywordControlsValues;
}) {
  const keywords = parseKeywordInput(values.keyword);
  if (!keywords.length) return null;
  const estimate = keywordResearchCost({ ...values, keywords });
  return (
    <p className="text-sm text-muted-foreground" role="status">
      Estimated maximum for {keywords.length} fresh{" "}
      {keywords.length === 1 ? "search" : "searches"}:{" "}
      <strong className="text-foreground">
        {isHostedClientAuthMode()
          ? `${estimate.credits} credits ($${(estimate.credits / 1000).toFixed(3)})`
          : `$${estimate.providerUsd.toFixed(3)} provider cost`}
      </strong>
      . Includes the first search-results lookup and any automatic research
      fallback. Cached results and fewer returned rows can cost less. Opening
      another keyword or more search results may cost extra.
    </p>
  );
}
