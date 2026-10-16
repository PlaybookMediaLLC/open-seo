import { describe, expect, it } from "vitest";
import type { KeywordEvidence } from "@/types/schemas/opportunities";
import { page, row } from "../detectionTestSupport";
import { contentGaps } from "./contentGap";
import { scoringContext } from "./scoreCandidate";

function keyword(
  text: string,
  overrides: Partial<KeywordEvidence> = {},
): KeywordEvidence {
  return {
    keyword: text,
    locationCode: 2840,
    languageCode: "en",
    searchVolume: 100,
    keywordDifficulty: 40,
    intent: "commercial",
    competitorDomain: "rival.com",
    competitorUrl: "https://rival.com/crm",
    competitorPosition: 3,
    fetchedAt: "2026-10-16T00:00:00.000Z",
    ...overrides,
  };
}
// Three keywords that share the topic "crm pricing", 300 searches in all.
const topic = (third: Partial<KeywordEvidence> = {}) => [
  keyword("crm pricing"),
  keyword("crm pricing plans"),
  keyword("crm pricing compare", third),
];
function gaps(
  competitorKeywords: KeywordEvidence[],
  options: {
    queryPages?: ReturnType<typeof row>[];
    tracked?: Map<string, number | null>;
  } = {},
) {
  return contentGaps({
    competitorKeywords,
    queryPages: options.queryPages ?? [],
    trackedPositions: options.tracked ?? new Map<string, number | null>(),
    siteRoot: "https://example.com/",
    context: scoringContext({
      keyPages: [],
      ga4: null,
      keywordDifficulty: new Map(),
      truncated: false,
    }),
  });
}

describe("content_gap", () => {
  it.each([
    ["competitor position 10", { competitorPosition: 10 }, 1],
    ["competitor position 11", { competitorPosition: 11 }, 0],
    ["50 searches", { searchVolume: 50 }, 1],
    ["49 searches", { searchVolume: 49 }, 0],
    ["transactional intent", { intent: "transactional" }, 1],
    ["informational intent", { intent: "informational" }, 0],
  ])("applies the gap rule at %s", (_name, third, count) => {
    expect(gaps(topic(third))).toHaveLength(count);
  });

  it.each([
    ["9 site impressions", 9, 1],
    ["10 site impressions", 10, 0],
  ])("keeps a keyword with %s", (_name, impressions, count) => {
    const queryPages = [
      row(["crm pricing compare", page("blog")], { impressions, clicks: 0 }),
    ];
    expect(gaps(topic(), { queryPages })).toHaveLength(count);
  });

  it.each([
    ["position 20", 20, 0],
    ["position 21", 21, 1],
  ])("excludes a tracked keyword at %s", (_name, position, count) => {
    const tracked = new Map([["crm pricing compare", position]]);
    expect(gaps(topic(), { tracked })).toHaveLength(count);
  });

  it("needs 3 keywords or 500 monthly searches in a topic", () => {
    const pair = (volume: number) => [
      keyword("crm pricing", { searchVolume: volume }),
      keyword("crm pricing plans", { searchVolume: 250 }),
    ];
    expect(gaps(pair(250))).toHaveLength(1);
    expect(gaps(pair(249))).toEqual([]);
  });

  it("names the topic, counts each keyword once and keeps every competitor as evidence", () => {
    const [result] = gaps([
      ...topic(),
      keyword("crm pricing", {
        competitorDomain: "other.com",
        searchVolume: 90,
      }),
    ]);
    expect(result).toMatchObject({
      type: "content_gap",
      topic: "crm pricing",
      title: 'Write about "crm pricing"',
      url: "https://example.com/",
      query: null,
      confidence: 0.35,
      effortHours: 8,
      visibilityScore: 1,
      difficultyScore: 0.4,
    });
    expect(result.explanation).toContain("3 commercial keywords");
    expect(result.explanation).toContain("300 monthly searches");
    expect(result.keywords!.map((item) => item.competitorDomain)).toEqual(
      expect.arrayContaining(["rival.com", "other.com"]),
    );
  });

  it("points at the site page with the most impressions on the topic", () => {
    const queryPages = [
      row(["pricing page", page("pricing")], { impressions: 9, clicks: 0 }),
      row(["crm tips", page("blog")], { impressions: 5, clicks: 0 }),
      row(["shoes", page("shoes")], { impressions: 900, clicks: 0 }),
    ];
    expect(gaps(topic(), { queryPages })[0].url).toBe(page("pricing"));
  });
});
