import { expect, it } from "vitest";
import { searchResult } from "./docsResult";

// RFC-0017 5.7: 50 searches in each window and a change of 25% or more.
it.each([
  [100, 75, "fewer searches"],
  [100, 125, "more searches"],
  [100, 76, "inconclusive"],
  [49, 10, "inconclusive"],
  [100, 49, "inconclusive"],
] as const)("labels %i then %i searches as %s", (before, after, label) => {
  expect(searchResult(before, after).label).toBe(label);
});
