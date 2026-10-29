import { describe, expect, it } from "vitest";
import { protectionReadiness } from "./protectionReadiness";

// RFC-0026 phase A: activation needs every required item to pass. Baseline
// and schedule are not available yet, so nothing activates in this slice.
const ready = {
  originVerified: true,
  allowRepairProposals: false,
  allowPullRequests: false,
  repositoryConnected: false,
  checkedPageCount: 5,
  maxPages: 20,
  reviewerChosen: true,
  reviewerIsMember: true,
  alertConfirmed: true,
  searchConsoleConnected: true,
  analyticsConnected: true,
};
const stateOf = (
  overrides: Partial<typeof ready>,
  id: ReturnType<typeof protectionReadiness>["items"][number]["id"],
) =>
  protectionReadiness({ ...ready, ...overrides }).items.find(
    (item) => item.id === id,
  )?.state;

describe("protectionReadiness", () => {
  it.each([
    ["origin", {}, "passed"],
    ["origin", { originVerified: false }, "failed"],
    ["repository", {}, "not_required"],
    ["repository", { allowPullRequests: true }, "failed"],
    [
      "repository",
      { allowRepairProposals: true, repositoryConnected: true },
      "passed",
    ],
    ["pages", {}, "passed"],
    ["pages", { checkedPageCount: 0 }, "failed"],
    ["pages", { checkedPageCount: 21 }, "failed"],
    ["reviewer", {}, "passed"],
    ["reviewer", { reviewerChosen: false }, "failed"],
    ["reviewer", { reviewerIsMember: false }, "failed"],
    ["reviewer", { alertConfirmed: false }, "failed"],
    ["baseline", {}, "not_available"],
    ["schedule", {}, "not_available"],
    ["repairs", {}, "not_available"],
    ["search_data", {}, "passed"],
    ["search_data", { analyticsConnected: false }, "not_available"],
  ] as const)("%s is %s", (id, overrides, state) => {
    expect(stateOf(overrides, id)).toBe(state);
  });

  it("never lets missing search data block activation", () => {
    const { items } = protectionReadiness({
      ...ready,
      searchConsoleConnected: false,
      analyticsConnected: false,
    });
    expect(items.find((item) => item.id === "search_data")?.required).toBe(
      false,
    );
  });

  it("allows activation only when every required item passes", () => {
    const readiness = protectionReadiness(ready);
    expect(
      readiness.items
        .filter((item) => item.required && item.state !== "passed")
        .map((item) => item.id),
    ).toEqual(["baseline", "schedule"]);
    expect(readiness.canActivate).toBe(false);
    // Resuming skips the schedule, but the baseline still blocks it.
    expect(readiness.canResume).toBe(false);
  });
});
