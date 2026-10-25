import { isPaidResearchPath } from "./items";
import { expect, it } from "vitest";
import { getProjectNavGroup, getProjectNavGroups } from "./items";

it.each([
  ["/p/site", "Home"],
  ["/p/site/", "Home"],
  ["/p/site/opportunities/item", "Work"],
  ["/p/site/keywords", "Research"],
  ["/p/site/ai-visibility/research", "Monitor"],
  ["/p/site/ai-visibility/prompts/prompt", "Monitor"],
  ["/p/site/reports/report", "Library"],
  ["/p/other/reports", undefined],
  ["/settings", undefined],
])("scopes and selects the workspace for %s", (path, expected) => {
  expect(getProjectNavGroup("site", path)?.label).toBe(expected);
});

it("keeps all sixteen project destinations discoverable in five workspaces", () => {
  const groups = getProjectNavGroups("site");
  expect(groups.map((group) => group.label)).toEqual([
    "Home",
    "Work",
    "Research",
    "Monitor",
    "Library",
  ]);
  expect(
    new Set(groups.flatMap((group) => group.items.map((item) => item.to))).size,
  ).toBe(16);
});

it("limits paid-provider setup to the views that need it", () => {
  for (const suffix of [
    "",
    "/work",
    "/opportunities/123",
    "/search-performance",
    "/saved",
    "/settings/integrations",
    "/audit",
  ]) {
    expect(isPaidResearchPath(`/p/project${suffix}`)).toBe(false);
  }
  for (const suffix of [
    "/keywords",
    "/domain",
    "/backlinks",
    "/ai-visibility/research",
    "/prompt-explorer",
    "/rank-tracking/123",
  ]) {
    expect(isPaidResearchPath(`/p/project${suffix}`)).toBe(true);
  }
});
