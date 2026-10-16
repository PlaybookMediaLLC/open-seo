import { sort } from "remeda";
import { describe, expect, it } from "vitest";
import type { InspectionEvidence } from "@/types/schemas/opportunities";
import { detectOpportunities } from "./detectOpportunities";
import { input, page, row } from "./detectionTestSupport";
import type { AuditSignals } from "./detectors/shared";

function audit(overrides: Partial<AuditSignals> = {}): AuditSignals {
  return {
    auditId: "audit-1",
    completedAt: "2026-10-10T00:00:00.000Z",
    issues: [],
    pages: [],
    inlinks: new Map(),
    ...overrides,
  };
}
const issue = (pageUrl: string, issueType = "noindex-page") => ({
  id: `${issueType}-${pageUrl}`,
  issueType,
  severity: "critical" as const,
  pageUrl,
});
const ofType = (
  results: ReturnType<typeof detectOpportunities>,
  type: string,
) => results.filter((result) => result.type === type);

describe("technical_blocker", () => {
  it.each([
    ["50 current impressions", { impressions: 50 }, [], 1],
    ["49 current impressions", { impressions: 49 }, [], 0],
    ["no impressions on a key page", { impressions: 0 }, ["hub"], 1],
  ] as const)("applies the threshold at %s", (_name, metrics, roles, count) => {
    const results = detectOpportunities(
      input({
        audit: audit({ issues: [issue(page("a"))] }),
        currentPages: [row([page("a")], { ...metrics, clicks: 0 })],
        keyPages: roles.map((role) => ({ url: page("a"), role })),
      }),
    );
    expect(ofType(results, "technical_blocker")).toHaveLength(count);
  });

  it("uses the larger of the two periods and ignores other issue types", () => {
    const results = detectOpportunities(
      input({
        audit: audit({
          issues: [issue(page("a")), issue(page("a"), "missing-alt-text")],
        }),
        currentPages: [row([page("a")], { impressions: 10, clicks: 0 })],
        previousPages: [row([page("a")], { impressions: 60, clicks: 0 })],
      }),
    );
    expect(ofType(results, "technical_blocker")).toMatchObject([
      { audit: { issueType: "noindex-page", auditId: "audit-1" } },
    ]);
    expect(input().audit).toBeNull();
    expect(detectOpportunities(input())).toEqual([]);
  });

  it.each([
    ["case and fragment", "https://Example.com/a#top", page("a")],
    ["trailing slash", `${page("a")}/`, page("a")],
    ["default port", "https://example.com:443/a", page("a")],
    ["query order", `${page("a")}?b=2&a=1`, `${page("a")}?a=1&b=2`],
    ["the root slash", "https://example.com", "https://example.com/"],
  ])(
    "joins audit and Search Console URLs across %s",
    (_name, auditUrl, gscUrl) => {
      const results = detectOpportunities(
        input({
          audit: audit({ issues: [issue(auditUrl)] }),
          currentPages: [row([gscUrl], { impressions: 80, clicks: 0 })],
        }),
      );
      expect(ofType(results, "technical_blocker")).toHaveLength(1);
    },
  );

  it("raises confidence to 0.7 only when URL inspection confirms an indexing issue", () => {
    const inspection = (verdict: string): InspectionEvidence => ({
      url: page("a"),
      verdict,
      coverageState: "Excluded by noindex tag",
      indexingState: "BLOCKED_BY_META_TAG",
      robotsTxtState: null,
      pageFetchState: null,
      googleCanonical: null,
      userCanonical: null,
      lastCrawlTime: null,
      inspectedAt: "2026-10-16T00:00:00.000Z",
    });
    const detect = (issueType: string, verdict: string) =>
      ofType(
        detectOpportunities(
          input({
            audit: audit({ issues: [issue(page("a"), issueType)] }),
            currentPages: [row([page("a")], { impressions: 80, clicks: 0 })],
            inspections: new Map([[page("a"), inspection(verdict)]]),
          }),
        ),
        "technical_blocker",
      )[0];
    expect(detect("noindex-page", "FAIL")).toMatchObject({
      confidence: 0.7,
      inspection: { verdict: "FAIL" },
    });
    expect(detect("noindex-page", "PASS").confidence).toBe(0.5);
    expect(detect("missing-title", "FAIL")).toMatchObject({ confidence: 0.5 });
    expect(detect("missing-title", "FAIL").inspection).toBeUndefined();
  });
});

describe("internal_link", () => {
  // The target ranks for three queries; each source ranks for "q1".
  function linkInput(
    sources: Array<{ path: string; position?: number; impressions?: number }>,
    overrides: Partial<AuditSignals> = {},
    role = "money",
  ) {
    return input({
      queryPages: [
        row(["q1", page("target")], { position: 9 }),
        row(["q2", page("target")]),
        row(["q3", page("target")]),
        ...sources.map((source) =>
          row(["q1", page(source.path)], {
            position: source.position ?? 12,
            impressions: source.impressions ?? 400,
            clicks: 0,
          }),
        ),
      ],
      keyPages: [{ url: page("target"), role }],
      audit: audit({
        pages: [
          { url: page("target"), statusCode: 200, isIndexable: true },
          ...sources.map((source) => ({
            url: page(source.path),
            statusCode: 200,
            isIndexable: true,
          })),
        ],
        inlinks: new Map([[page("target"), new Set([page("linked")])]]),
        ...overrides,
      }),
    });
  }
  const links = (value: ReturnType<typeof input>) =>
    ofType(detectOpportunities(value), "internal_link");

  it("suggests a source page that ranks for the target's queries", () => {
    expect(links(linkInput([{ path: "blog" }]))).toMatchObject([
      {
        url: page("target"),
        recommendedAction:
          "Add a contextual link from the source page to the target page, in text about 'q1'.",
        urls: [
          { url: page("target"), role: "primary" },
          { url: page("target"), role: "link_target" },
          { url: page("blog"), role: "link_source" },
        ],
        link: {
          sourceUrl: page("blog"),
          sharedQuery: "q1",
          sourcePosition: 12,
        },
      },
    ]);
  });

  it("excludes a source that already links to the target", () => {
    expect(links(linkInput([{ path: "linked" }]))).toEqual([]);
  });

  it.each([
    ["position 30", { path: "blog", position: 30 }, 1],
    ["position 30.1", { path: "blog", position: 30.1 }, 0],
  ])("applies the source position limit at %s", (_name, source, count) => {
    expect(links(linkInput([source]))).toHaveLength(count);
  });

  it("needs a live, indexable source, a money or hub target and three target queries", () => {
    const noindex = linkInput([{ path: "blog" }], {
      pages: [{ url: page("blog"), statusCode: 200, isIndexable: false }],
    });
    expect(links(noindex)).toEqual([]);
    expect(links(linkInput([{ path: "blog" }], {}, "spoke"))).toEqual([]);
    const twoQueries = linkInput([{ path: "blog" }]);
    twoQueries.queryPages = twoQueries.queryPages.filter(
      (entry) => entry.keys![0] !== "q3",
    );
    expect(links(twoQueries)).toEqual([]);
  });

  it("keeps the five sources with the most shared impressions", () => {
    const sources = Array.from({ length: 6 }, (_, index) => ({
      path: `source-${index}`,
      impressions: 100 + index,
    }));
    expect(
      new Set(
        links(linkInput(sources)).map((result) => result.link!.sourceUrl),
      ),
    ).toEqual(new Set([1, 2, 3, 4, 5].map((index) => page(`source-${index}`))));
  });

  it("skips a target linked from the full inlink cap, and an audit without inlinks", () => {
    const sitewide = new Set(
      Array.from({ length: 2_000 }, (_, index) => page(`p${index}`)),
    );
    expect(
      links(
        linkInput([{ path: "blog" }], {
          inlinks: new Map([[page("target"), sitewide]]),
        }),
      ),
    ).toEqual([]);
    expect(
      links(linkInput([{ path: "blog" }], { inlinks: new Map() })),
    ).toEqual([]);
  });
});

it("adds rank history to a tracked query without changing the score", () => {
  const value = input({ queryPages: [row(["Query", page("page")])] });
  const rank = {
    trackingKeywordId: "keyword-1",
    device: "mobile" as const,
    firstPosition: 14,
    lastPosition: 9,
    firstCheckedAt: "2026-09-20",
    lastCheckedAt: "2026-10-15",
  };
  const [plain] = detectOpportunities(value);
  const [tracked] = detectOpportunities({
    ...value,
    rankHistory: new Map([["query", [rank]]]),
  });
  expect(tracked).toEqual({ ...plain, rank: [rank] });
});

it("adds AI answer citations to every candidate, zero included", () => {
  const [cited, uncited] = sort(
    detectOpportunities(
      input({
        queryPages: [row(["a", page("a")]), row(["b", page("b")])],
        aiCitations: {
          trackerId: "tracker-1",
          answers: 12,
          periodStart: "2026-09-16",
          periodEnd: "2026-10-16",
          citations: new Map([[page("a"), 3]]),
        },
      }),
    ),
    (x, y) => x.url.localeCompare(y.url),
  );
  expect(cited.ai).toMatchObject({ citations: 3, answers: 12 });
  expect(uncited.ai).toMatchObject({ citations: 0, answers: 12 });
});

it("applies a live results check from the last 24 hours to low click-through", () => {
  const curve = Array.from({ length: 5 }, (_, index) =>
    row([`curve ${index}`, page(`curve-${index}`)], {
      clicks: 100,
      ctr: 0.1,
      position: 3,
    }),
  );
  const value = input({
    queryPages: [
      ...curve,
      row(["target", page("target")], { clicks: 20, ctr: 0.02, position: 3 }),
    ],
  });
  const lowCtr = (checks: typeof value.serpChecks) =>
    detectOpportunities({ ...value, serpChecks: checks }).find(
      (result) => result.type === "low_ctr",
    )!;
  const checked = lowCtr(
    new Map([[page("target"), { value: -0.15, reason: "ads were above it" }]]),
  );
  expect(lowCtr(new Map()).confidence).toBe(0.55);
  expect(checked.confidence).toBe(0.4);
  expect(checked.scoreExplanation).toContain("-0.15 because ads were above it");
});
