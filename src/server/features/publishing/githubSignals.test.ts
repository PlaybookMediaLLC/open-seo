import { describe, expect, it } from "vitest";
import type { GithubRequest } from "./githubRead";
import { createGithubSignals } from "./githubSignals";

const sha = "a".repeat(40);
const checks = (
  runs: { status: string; conclusion: string | null }[],
  status: { state: string; total_count: number },
) => {
  const request: GithubRequest = async (route, schema) =>
    schema.parse(route.includes("check-runs") ? { check_runs: runs } : status);
  return createGithubSignals(request).getChecks(sha);
};
const none = { state: "pending", total_count: 0 };

describe("repository checks", () => {
  it.each([
    ["not_configured", [], none],
    ["passing", [{ status: "completed", conclusion: "success" }], none],
    ["pending", [{ status: "in_progress", conclusion: null }], none],
    ["failing", [{ status: "completed", conclusion: "failure" }], none],
    ["failing", [], { state: "error", total_count: 1 }],
    [
      "pending",
      [{ status: "completed", conclusion: "success" }],
      { state: "pending", total_count: 1 },
    ],
  ] as const)("reports %s", async (expected, runs, status) => {
    expect(await checks([...runs], status)).toBe(expected);
  });
});
