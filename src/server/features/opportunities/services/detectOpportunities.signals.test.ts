import { describe, expect, it } from "vitest";
import type { GscSearchAnalyticsRow } from "@/server/lib/gscClient";
import { detectOpportunities } from "./detectOpportunities";
import { input, page, row } from "./detectionTestSupport";

// Five curve rows at one position give the site a median CTR there.
function curveRows(
  position: number,
  ctr: number,
  count = 5,
  impressions = 1_000,
) {
  return Array.from({ length: count }, (_, index) =>
    row([`curve ${position} ${index}`, page(`curve-${position}-${index}`)], {
      impressions,
      clicks: Math.round(impressions * ctr),
      ctr,
      position,
    }),
  );
}
function target(
  impressions: number,
  clicks: number,
  position = 3,
  query = "target query",
) {
  return row([query, page("target")], {
    impressions,
    clicks,
    ctr: clicks / impressions,
    position,
  });
}
const ofType = (
  results: ReturnType<typeof detectOpportunities>,
  type: string,
) => results.filter((result) => result.type === type);

describe("low_ctr", () => {
  it.each([
    ["the 0.6 click share", curveRows(3, 0.1), target(1_000, 60), 1],
    ["above the click share", curveRows(3, 0.1), target(1_000, 61), 0],
    ["500 impressions", curveRows(3, 0.1), target(500, 30), 1],
    ["499 impressions", curveRows(3, 0.1), target(499, 0), 0],
    ["20 missing clicks", curveRows(7, 0.04), target(1_000, 20, 7), 1],
    ["19 missing clicks", curveRows(7, 0.04), target(1_000, 21, 7), 0],
    ["a curve of 5 rows", curveRows(3, 0.1, 4), target(1_000, 20), 1],
    ["a curve of 4 rows", curveRows(3, 0.1, 3), target(1_000, 20), 0],
    [
      "curve rows under 100 impressions",
      curveRows(3, 0.1, 5, 99),
      target(1_000, 20),
      0,
    ],
    ["position 11", curveRows(11, 0.1), target(1_000, 20, 11), 0],
  ])("applies the threshold at %s", (_name, curve, targetRow, count) => {
    expect(
      ofType(
        detectOpportunities(input({ queryPages: [...curve, targetRow] })),
        "low_ctr",
      ),
    ).toHaveLength(count);
  });

  it("leaves branded queries out of the curve and the page totals", () => {
    const queryPages = [
      ...curveRows(3, 0.1),
      target(1_000, 20, 3, "acme pricing"),
    ];
    expect(
      ofType(
        detectOpportunities(input({ queryPages, brandTerms: ["acme"] })),
        "low_ctr",
      ),
    ).toEqual([]);
    // A word inside another word is not a brand match.
    expect(
      ofType(
        detectOpportunities(input({ queryPages, brandTerms: ["acm"] })),
        "low_ctr",
      ),
    ).toHaveLength(1);
  });

  it("stores the page row and the top 5 queries as evidence", () => {
    const queries = Array.from({ length: 6 }, (_, index) =>
      target(1_000 - index, 0, 3, `query ${index}`),
    );
    const [result] = ofType(
      detectOpportunities(
        input({
          // Seven curve rows keep the median at 0.1 beside six zero-CTR rows.
          queryPages: [...curveRows(3, 0.1, 7), ...queries],
          currentPages: [
            row([page("target")], { clicks: 5, impressions: 9_000 }),
          ],
        }),
      ),
      "low_ctr",
    );
    expect(result).toMatchObject({ url: page("target"), query: null });
    expect(result.evidence.map(({ query }) => query)).toEqual([
      "",
      "query 0",
      "query 1",
      "query 2",
      "query 3",
      "query 4",
    ]);
    expect(result.evidence[0].metrics.impressions).toBe(9_000);
    expect(result.explanation).toContain("about 599 clicks");
  });
});

function pair(
  query: string,
  first: Partial<GscSearchAnalyticsRow>,
  second: Partial<GscSearchAnalyticsRow>,
  urls = [page("a"), page("b")],
) {
  return [
    row([query, urls[0]], { position: 5, ...first }),
    row([query, urls[1]], { position: 8, ...second }),
  ];
}

describe("cannibalization", () => {
  it.each([
    ["two shared queries", [...pair("one", {}, {}), ...pair("two", {}, {})], 1],
    [
      "one query with 200 impressions",
      pair("one", { impressions: 100 }, { impressions: 100 }),
      1,
    ],
    [
      "one query with 199 impressions",
      pair("one", { impressions: 100 }, { impressions: 99 }),
      0,
    ],
    [
      "a 50-impression page",
      pair("one", { impressions: 150 }, { impressions: 50 }),
      1,
    ],
    [
      "a 49-impression page",
      pair("one", { impressions: 151 }, { impressions: 49 }),
      0,
    ],
    ["position 20", pair("one", {}, { position: 20 }), 1],
    ["position 20.1", pair("one", {}, { position: 20.1 }), 0],
    [
      "a 25% share",
      [...pair("one", { impressions: 300 }, { impressions: 100 })],
      1,
    ],
    [
      "a share under 25%",
      [
        ...pair("one", { impressions: 300 }, { impressions: 100 }),
        row(["one", page("c")], { impressions: 10, position: 30 }),
      ],
      0,
    ],
  ])("applies the threshold at %s", (_name, queryPages, count) => {
    expect(
      ofType(detectOpportunities(input({ queryPages })), "cannibalization"),
    ).toHaveLength(count);
  });

  it("does not report URL variants of one page", () => {
    const queryPages = [
      ...pair("one", {}, {}, [
        "https://example.com/x",
        "http://www.example.com/X/",
      ]),
      ...pair("two", {}, {}, [
        "https://example.com/x",
        "http://www.example.com/X/",
      ]),
    ];
    expect(
      ofType(detectOpportunities(input({ queryPages })), "cannibalization"),
    ).toEqual([]);
  });

  it("leaves branded queries out", () => {
    const queryPages = [
      ...pair("acme one", {}, {}),
      ...pair("acme two", {}, {}),
    ];
    expect(
      ofType(
        detectOpportunities(input({ queryPages, brandTerms: ["acme"] })),
        "cannibalization",
      ),
    ).toEqual([]);
  });

  it("makes the page with more clicks primary and stores per-URL query rows", () => {
    const queryPages = [
      ...pair("one", { clicks: 5 }, { clicks: 30 }),
      ...pair("two", { clicks: 5 }, { clicks: 30 }),
    ];
    const [result] = ofType(
      detectOpportunities(input({ queryPages })),
      "cannibalization",
    );
    expect(result).toMatchObject({
      url: page("b"),
      query: null,
      urls: [
        { url: page("b"), role: "primary" },
        { url: page("a"), role: "competing" },
      ],
    });
    expect(result.evidence.map(({ url, query }) => [url, query])).toEqual([
      ["", ""],
      [page("a"), "one"],
      [page("b"), "one"],
      [page("a"), "two"],
      [page("b"), "two"],
    ]);
  });
});

describe("declining_page diagnosis", () => {
  const previous = { clicks: 100, impressions: 1_000, ctr: 0.1, position: 5 };
  function diagnose(
    current: Partial<GscSearchAnalyticsRow>,
    yearAgo?: [previousClicks: number, currentClicks: number],
  ) {
    const [result] = detectOpportunities(
      input({
        currentPages: [
          row([page("p")], { ...previous, clicks: 50, ...current }),
        ],
        previousPages: [row([page("p")], previous)],
        yearAgoPreviousPages: yearAgo
          ? [row([page("p")], { clicks: yearAgo[0] })]
          : [],
        yearAgoPages: yearAgo ? [row([page("p")], { clicks: yearAgo[1] })] : [],
      }),
    );
    return result;
  }

  it.each([
    ["ranking_drop", { impressions: 800, ctr: 0.0625, position: 7 }],
    ["ctr_drop", { impressions: 950, ctr: 0.0526, position: 5.5 }],
    ["demand_drop", { impressions: 600, ctr: 0.0833, position: 5.5 }],
    ["mixed", { impressions: 1_000, ctr: 0.05, position: 7 }],
    ["unknown", { impressions: 800, ctr: 0.0625, position: 6 }],
  ])("diagnoses %s", (diagnosis, current) => {
    const result = diagnose(current);
    expect(result.diagnosis).toBe(diagnosis);
    expect(result.confidence).toBe(0.5);
  });

  it("diagnoses seasonal at 70% of the loss a year ago, and lowers confidence", () => {
    const ranking = { impressions: 800, ctr: 0.0625, position: 7 };
    const seasonal = diagnose(ranking, [100, 65]);
    expect(seasonal).toMatchObject({ diagnosis: "seasonal", confidence: 0.3 });
    expect(seasonal.evidence.map(({ period }) => period)).toEqual([
      "current",
      "previous",
      "year_ago",
      "year_ago_previous",
    ]);
    expect(diagnose(ranking, [100, 66]).diagnosis).toBe("ranking_drop");
  });
});

const strikingInput = (
  overrides: Partial<Parameters<typeof detectOpportunities>[0]> = {},
) => input({ queryPages: [row(["query", page("page")])], ...overrides });
const ga4 = (keyEvents: number) => ({
  currency: "USD",
  rows: [
    {
      period: "current" as const,
      hostName: "example.com",
      landingPage: "/page",
      sessions: 100,
      keyEvents,
      revenue: null,
    },
  ],
});

describe("commercial and difficulty signals", () => {
  it.each([
    [0, 0.25],
    [1, 0.7],
    [9, 0.7],
    [10, 1],
  ])("scores %i organic key events as commercial %d", (keyEvents, score) => {
    const [result] = detectOpportunities(
      strikingInput({ ga4: ga4(keyEvents) }),
    );
    expect(result.commercialScore).toBe(score);
    expect(result.ga4).toMatchObject([{ keyEvents, currency: "USD" }]);
    expect(result.uncertainty).not.toContain("GA4 not connected");
  });

  it("keeps the higher page role score and says when GA4 is not connected", () => {
    const keyPages = [{ url: page("page"), role: "money" }];
    expect(
      detectOpportunities(strikingInput({ keyPages, ga4: ga4(1) }))[0]
        .commercialScore,
    ).toBe(1);
    expect(detectOpportunities(strikingInput())[0].uncertainty).toContain(
      "GA4 not connected; commercial value uses page roles only.",
    );
  });

  it("uses cached keyword difficulty for the query when present", () => {
    const [cached] = detectOpportunities(
      strikingInput({ keywordDifficulty: new Map([["query", 40]]) }),
    );
    expect(cached.difficultyScore).toBe(0.4);
    expect(cached.scoreExplanation).toContain("cached keyword difficulty 40");
    const [proxy] = detectOpportunities(strikingInput());
    expect(proxy.scoreExplanation).toContain("existing-rank proxy");
  });
});
