import { reverse, sort } from "remeda";
import { describe, expect, it } from "vitest";
import type { GscSearchAnalyticsRow } from "@/server/lib/gscClient";
import { detectOpportunities } from "./detectOpportunities";

const page = (path: string) => `https://example.com/${path}`;
function row(
  keys: string[],
  overrides: Partial<GscSearchAnalyticsRow> = {},
): GscSearchAnalyticsRow {
  return {
    keys,
    clicks: 10,
    impressions: 1_000,
    ctr: 0.01,
    position: 10,
    ...overrides,
  };
}
function input(
  overrides: Partial<Parameters<typeof detectOpportunities>[0]> = {},
): Parameters<typeof detectOpportunities>[0] {
  return {
    queryPages: [],
    currentPages: [],
    previousPages: [],
    keyPages: [],
    truncated: false,
    ...overrides,
  };
}

// Each case owns a detector output invariant, using real shaping helpers and no mocks.
describe("detectOpportunities", () => {
  it("produces five reviewable candidates with observed evidence and explicit scoring uncertainty", () => {
    const results = detectOpportunities(
      input({
        queryPages: [
          row(["buy software", page("pricing")]),
          row(["seo guide", page("guide")]),
          row(["seo checklist", page("checklist")]),
        ],
        currentPages: [
          row([page("old-guide")], { clicks: 50 }),
          row([page("product")], { clicks: 10 }),
        ],
        previousPages: [
          row([page("old-guide")], { clicks: 100 }),
          row([page("product")], { clicks: 40 }),
        ],
        keyPages: [
          { url: page("pricing"), role: "money" },
          { url: page("guide"), role: "hub" },
        ],
      }),
    );
    expect(results).toHaveLength(5);
    expect(
      results.filter((result) => result.type === "striking_distance"),
    ).toHaveLength(3);
    expect(
      results.find((result) => result.url === page("product")),
    ).toMatchObject({
      current: { clicks: 10 },
      previous: { clicks: 40 },
      confidence: 0.5,
      effortHours: 4,
    });
    expect(
      results.find((result) => result.url === page("pricing")),
    ).toMatchObject({
      commercialScore: 1,
      confidence: 0.65,
      effortHours: 2,
      previous: null,
    });
    for (const result of results) {
      expect(result.searchIntent).toBe("Unverified; review query and SERP");
      expect(result.uncertainty).toContain("not a traffic or revenue forecast");
      for (const component of [
        result.commercialScore,
        result.demandScore,
        result.visibilityScore,
        result.difficultyScore,
        result.effortScore,
      ]) {
        expect(component).toBeGreaterThanOrEqual(0);
        expect(component).toBeLessThanOrEqual(1);
        expect(result.scoreExplanation).toContain(String(component));
      }
      expect(result.priority).toBe(
        Math.round(
          100 *
            result.confidence *
            (0.3 * result.commercialScore +
              0.25 * result.demandScore +
              0.2 * result.visibilityScore +
              0.15 * (1 - result.difficultyScore) +
              0.1 * result.effortScore),
        ),
      );
    }
  });

  it("suppresses a query whose best page already ranks above the band, even with low impressions", () => {
    expect(
      detectOpportunities(
        input({
          queryPages: [
            row(["software", page("secondary")]),
            row(["software", page("best")], { position: 2, impressions: 20 }),
          ],
        }),
      ),
    ).toEqual([]);
  });

  it("enforces inclusive striking-distance position and impression thresholds", () => {
    const results = detectOpportunities(
      input({
        queryPages: [
          row(["lower", page("lower")], { position: 5, impressions: 100 }),
          row(["upper", page("upper")], { position: 20, impressions: 100 }),
          row(["few", page("few")], { impressions: 99 }),
          row(["near", page("near")], { position: 4.9 }),
          row(["far", page("far")], { position: 20.1 }),
        ],
      }),
    );
    expect(
      sort(
        results.map((result) => result.query),
        (a, b) => (a ?? "").localeCompare(b ?? ""),
      ),
    ).toEqual(["lower", "upper"]);
  });

  it("compares only exact observed pages and applies all decline thresholds", () => {
    const cases = [
      ["prior-boundary", 30, 10],
      ["fraction-boundary", 100, 70],
      ["few-prior", 29, 0],
      ["few-lost", 50, 31],
      ["small-fraction", 100, 71],
    ] as const;
    const results = detectOpportunities(
      input({
        currentPages: [
          ...cases.map(([path, , clicks]) => row([page(path)], { clicks })),
          row([page("alias/")]),
        ],
        previousPages: [
          ...cases.map(([path, clicks]) => row([page(path)], { clicks })),
          row([page("alias")], { clicks: 100 }),
          row([page("missing")], { clicks: 100 }),
        ],
      }),
    );
    expect(
      sort(
        results.map((result) => result.url),
        (a, b) => a.localeCompare(b),
      ),
    ).toEqual([page("fraction-boundary"), page("prior-boundary")]);
  });

  it("ignores malformed metrics, missing keys and unsafe URLs without inventing candidates", () => {
    const invalid = [
      row([], {}),
      row(["query"]),
      row(["", page("empty-query")]),
      row(["query", "javascript:alert(1)"]),
      row(["query", "https://user:secret@example.com/"]),
      row(["query", page("nan")], { clicks: Number.NaN }),
      row(["query", page("infinite")], { position: Infinity }),
      row(["query", page("negative")], { impressions: -1 }),
      row(["query", page("ctr")], { ctr: 1.1 }),
      row(["query", page("count")], { clicks: 1.5 }),
      row(["query", page("over-count")], { clicks: 1_001 }),
    ];
    expect(
      detectOpportunities(
        input({
          queryPages: invalid,
          currentPages: [row([page("bad")], { ctr: -0.1 })],
          previousPages: [row([page("bad")], { clicks: 100 })],
        }),
      ),
    ).toEqual([]);
    expect(detectOpportunities(input())).toEqual([]);
  });

  it("increases priority for stronger saved commercial role and observed demand", () => {
    const base = input({
      queryPages: [row(["query", page("page")], { impressions: 100 })],
    });
    const unknown = detectOpportunities(base)[0];
    const known = detectOpportunities({
      ...base,
      keyPages: [{ url: page("page"), role: "spoke" }],
    })[0];
    const hub = detectOpportunities({
      ...base,
      keyPages: [{ url: page("page"), role: "hub" }],
    })[0];
    const money = detectOpportunities({
      ...base,
      keyPages: [{ url: page("page"), role: "money" }],
    })[0];
    expect([
      unknown.commercialScore,
      known.commercialScore,
      hub.commercialScore,
      money.commercialScore,
    ]).toEqual([0.25, 0.5, 0.7, 1]);
    expect(known.priority).toBeGreaterThan(unknown.priority);
    expect(hub.priority).toBeGreaterThan(known.priority);
    expect(money.priority).toBeGreaterThan(hub.priority);
    expect(
      detectOpportunities({
        ...base,
        queryPages: [row(["query", page("page")], { impressions: 10_000 })],
      })[0].priority,
    ).toBeGreaterThan(unknown.priority);
  });

  it("reduces confidence and priority for truncated evidence", () => {
    const base = input({
      queryPages: [row(["query", page("page")])],
      currentPages: [row([page("decline")])],
      previousPages: [row([page("decline")], { clicks: 100 })],
    });
    const complete = detectOpportunities(base);
    for (const result of detectOpportunities({ ...base, truncated: true })) {
      const original = complete.find(
        (candidate) => candidate.type === result.type,
      )!;
      expect(result.confidence).toBeLessThan(original.confidence);
      expect(result.priority).toBeLessThan(original.priority);
      expect(result.uncertainty).toContain("truncated");
    }
  });

  it("returns the top 50 deterministically, including tied best-page selection", () => {
    const queryPages = Array.from({ length: 60 }, (_, index) =>
      row([`query-${index}`, page(String(index).padStart(2, "0"))]),
    );
    queryPages.push(row(["query-0", page("zz-secondary")]));
    const result = detectOpportunities(input({ queryPages }));
    expect(result).toHaveLength(50);
    expect(result[0].url).toBe(page("00"));
    expect(result[49].url).toBe(page("49"));
    expect(
      detectOpportunities(input({ queryPages: reverse(queryPages) })),
    ).toEqual(result);
  });
});
