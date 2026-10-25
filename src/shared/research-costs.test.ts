import { describe, expect, it } from "vitest";
import { keywordResearchCost, labsUsd, researchCost } from "./research-costs";
import { creditsForProviderUsd } from "./billing";

const input = {
  keywords: ["seo"],
  locationCode: 2840,
  resultLimit: 150,
  mode: "auto" as const,
  clickstream: false,
};
describe("research cost previews", () => {
  it("includes both blend calls, a full fallback and the first SERP", () => {
    expect(keywordResearchCost(input).credits).toBe(27 + 27 + 39 + 5);
  });
  it("replaces clickstream with local volume and rounds each call", () => {
    const local = keywordResearchCost({
      ...input,
      clickstream: true,
      locationName: "New York,New York,United States",
    });
    expect(local.credits).toBe(keywordResearchCost(input).credits + 116);
  });
  it("includes every seed and the search-operator surcharge", () => {
    const normal = keywordResearchCost(input);
    const operator = keywordResearchCost({
      ...input,
      keywords: ["seo", "site:example.com seo"],
    });
    expect(operator.credits).toBe(normal.credits * 2 + 18);
  });
  it("uses Google Ads pricing outside Labs, without clickstream", () => {
    expect(
      keywordResearchCost({ ...input, locationCode: 2352, clickstream: true })
        .credits,
    ).toBe(121);
  });
  it("sums domain overview and table reservations per call", () => {
    expect(researchCost([labsUsd(1), labsUsd(50)]).credits).toBe(
      creditsForProviderUsd(labsUsd(1)) + creditsForProviderUsd(labsUsd(50)),
    );
  });
});
