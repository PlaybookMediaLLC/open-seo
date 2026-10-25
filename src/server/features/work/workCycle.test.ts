import { describe, expect, it } from "vitest";
import { buildCycle, type CycleInput } from "./workCycle";

// RFC-0018 5.3 and 5.4: one test per hard filter, the order and limits,
// Completed from merged and deployed records only, and the empty reasons.
const NOW = new Date("2026-10-19T06:00:00Z");
const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 86_400_000).toISOString();
const item = (
  id: string,
  overrides: Partial<CycleInput["opportunities"][number]> = {},
) => ({
  id,
  type: "low_ctr",
  url: `https://example.com/${id}`,
  title: `Item ${id}`,
  explanation: `Evidence for ${id}. More detail.`,
  status: "approved",
  confidence: 0.6,
  priority: 60,
  effortHours: 1,
  lastDetectedAt: daysAgo(1),
  ...overrides,
});
const change = (
  id: string,
  overrides: Partial<CycleInput["experiments"][number]> = {},
) => ({
  id,
  opportunityType: "low_ctr",
  title: `Change ${id}`,
  targetUrl: `https://example.com/${id}`,
  createdAt: daysAgo(10),
  pullRequestState: "merged",
  mergedAt: daysAgo(9),
  deployedAt: null,
  deploymentBasis: null,
  observationEnd: null,
  windowComplete: false,
  outcome: null,
  ...overrides,
});
const cycle = (input: Partial<CycleInput>) =>
  buildCycle({
    weekStart: "2026-10-19T00:00:00.000Z",
    weekEnd: "2026-10-26T00:00:00.000Z",
    now: NOW,
    bar: 40,
    openPrLimit: 3,
    githubConnected: true,
    latestDetectionAt: daysAgo(1),
    opportunities: [],
    experiments: [],
    splitTests: [],
    proposals: [],
    ...input,
  });
const section = (result: ReturnType<typeof buildCycle>, name: string) =>
  result.entries
    .filter((entry) => entry.section === name)
    .map((entry) => Object.values(entry.link)[0]);

describe("Next", () => {
  it.each([
    [
      "evidence older than 14 days",
      { lastDetectedAt: daysAgo(15) },
      "older than 14 days",
    ],
    ["confidence below 0.4", { confidence: 0.39 }, "confidence below 0.4"],
    ["priority below the bar", { priority: 39 }, "scored 39. The bar is 40"],
    ["a closed status", { status: "rejected" }, "found no open items"],
  ] as const)("excludes an item with %s", (_name, overrides, reason) => {
    const result = cycle({ opportunities: [item("a", overrides)] });
    expect(section(result, "next")).toEqual([]);
    expect(result.emptyReasons).toContain(reason);
  });

  it("excludes a page that changed in 28 days or is measuring", () => {
    const result = cycle({
      opportunities: [item("a"), item("b")],
      experiments: [
        change("a", { deployedAt: daysAgo(28), deploymentBasis: "verified" }),
        change("b", {
          deployedAt: daysAgo(40),
          deploymentBasis: "verified",
          observationEnd: "2026-11-12",
        }),
      ],
    });
    expect(section(result, "next")).toEqual([]);
    expect(result.emptyReasons).toContain(
      "2 items are on pages that changed in the last 28 days or are measuring. Results arrive on 2026-11-12.",
    );
  });

  it("excludes a change class with a negative result on the page in 180 days", () => {
    const result = cycle({
      opportunities: [item("a")],
      experiments: [
        change("a", {
          createdAt: daysAgo(170),
          deployedAt: daysAgo(160),
          windowComplete: true,
          outcome: "negative",
        }),
      ],
    });
    expect(section(result, "next")).toEqual([]);
    expect(result.emptyReasons).toContain("negative result on the same page");
  });

  it("makes a setup reason when GitHub is not connected", () => {
    const result = cycle({
      opportunities: [item("a")],
      githubConnected: false,
    });
    expect(section(result, "next")).toEqual([]);
    expect(result.emptyReasons).toContain(
      "Connect GitHub to prepare 1 changes.",
    );
  });

  it("orders by priority, keeps at most 5, and waits at the pull request limit", () => {
    const items = [30, 90, 50, 70, 60, 80, 45].map((priority, index) =>
      item(`p${index}`, { priority }),
    );
    expect(section(cycle({ opportunities: items }), "next")).toEqual([
      "p1",
      "p5",
      "p3",
      "p4",
      "p2",
    ]);
    const full = cycle({
      opportunities: [item("a")],
      openPrLimit: 1,
      experiments: [
        change("x", { pullRequestState: "open", createdAt: daysAgo(1) }),
      ],
    });
    expect(full.entries[0]?.reason).toContain(
      "Ready after current changes merge",
    );
  });
});

describe("Completed, Measuring and Waiting on you", () => {
  it("counts only merged changes with a deployment in the week", () => {
    const result = cycle({
      experiments: [
        change("deployed", {
          deployedAt: "2026-10-20T10:00:00Z",
          deploymentBasis: "human",
        }),
        change("merged-only", { deploymentBasis: null }),
        change("last-week", {
          deployedAt: "2026-10-18T10:00:00Z",
          deploymentBasis: "verified",
        }),
      ],
    });
    expect(section(result, "completed")).toEqual(["deployed"]);
    expect(section(result, "measuring")).toEqual(["deployed", "last-week"]);
  });

  it("waits on proposals older than 3 days and pull requests older than 7", () => {
    const result = cycle({
      proposals: [
        {
          id: "old",
          opportunityId: "a",
          title: "Old",
          createdAt: daysAgo(4),
          approved: false,
        },
        {
          id: "new",
          opportunityId: "b",
          title: "New",
          createdAt: daysAgo(2),
          approved: false,
        },
      ],
      experiments: [
        change("open-old", { pullRequestState: "open", createdAt: daysAgo(8) }),
        change("open-new", { pullRequestState: "open", createdAt: daysAgo(6) }),
      ],
    });
    expect(section(result, "waiting")).toEqual(["old", "open-old"]);
  });
});

it("does not claim that detection found no work before a completed detection", () => {
  expect(cycle({ latestDetectionAt: null }).emptyReasons).toContain(
    "No detection has completed yet",
  );
  expect(cycle({}).emptyReasons).toContain(
    "The latest detection found no open items",
  );
});
