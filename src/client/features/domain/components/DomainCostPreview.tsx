import { isHostedClientAuthMode } from "@/lib/auth-mode";
import { labsUsd, researchCost } from "@/shared/research-costs";

export function DomainCostPreview({ pageSize }: { pageSize: number }) {
  const estimate = researchCost([labsUsd(1), labsUsd(pageSize)]);
  const page = researchCost([labsUsd(pageSize)]);
  const price = (cost: typeof estimate) =>
    isHostedClientAuthMode()
      ? `${cost.credits} credits ($${(cost.credits / 1000).toFixed(3)})`
      : `$${cost.providerUsd.toFixed(3)} provider cost`;
  return (
    <p className="text-sm text-muted-foreground">
      Fresh overview and up to {pageSize} rows:{" "}
      <strong className="text-foreground">{price(estimate)}</strong> estimated
      maximum. Each uncached page, filter, sort or tab change can cost up to{" "}
      {price(page)}. Cached results can cost less.
    </p>
  );
}
