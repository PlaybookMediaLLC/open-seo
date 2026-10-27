import { sort } from "remeda";
import type {
  KeywordEvidence,
  OpportunityCandidate,
} from "@/types/schemas/opportunities";
import { scoreCandidate, type ScoringContext } from "./scoreCandidate";
import { bounded, compareText, type UsableGscRow } from "./shared";

const MAX_COMPETITOR_POSITION = 10;
const MIN_SEARCH_VOLUME = 50;
const GAP_INTENTS = new Set(["commercial", "transactional"]);
const MAX_SITE_IMPRESSIONS = 10;
const MAX_TRACKED_POSITION = 20;
const MIN_TOPIC_KEYWORDS = 3;
const MIN_TOPIC_VOLUME = 500;
const EVIDENCE_KEYWORDS = 20;
// ponytail: a short English list. Other languages keep their stop words in
// topic keys; add a list per language when a non-English project needs it.
const STOP_WORDS = new Set(
  "a an and are as at be best buy by can do for from get how i in is it my near of on or the to top vs what when where which who why with you your".split(
    " ",
  ),
);

type CompetitorKeyword = KeywordEvidence;

function tokens(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((token) => token.length >= 2 && !STOP_WORDS.has(token)),
    ),
  ];
}

/**
 * Commercial keywords where a competitor ranks in the top 10 and this site
 * barely appears, grouped into topics by their two most frequent tokens.
 */
export function contentGaps(input: {
  competitorKeywords: CompetitorKeyword[];
  /** This site's usable query+page rows for the current window. */
  queryPages: UsableGscRow[];
  /** Lowercase tracked keyword to its best last position. */
  trackedPositions: Map<string, number | null>;
  siteRoot: string;
  context: ScoringContext;
}): OpportunityCandidate[] {
  const siteImpressions = new Map<string, number>();
  for (const row of input.queryPages) {
    const query = row.keys[0].toLowerCase();
    siteImpressions.set(
      query,
      (siteImpressions.get(query) ?? 0) + row.impressions,
    );
  }
  const gaps = input.competitorKeywords.filter((row) => {
    const keyword = row.keyword.toLowerCase();
    const tracked = input.trackedPositions.get(keyword);
    return (
      row.competitorPosition <= MAX_COMPETITOR_POSITION &&
      row.searchVolume >= MIN_SEARCH_VOLUME &&
      GAP_INTENTS.has(row.intent ?? "") &&
      (siteImpressions.get(keyword) ?? 0) < MAX_SITE_IMPRESSIONS &&
      !(tracked != null && tracked <= MAX_TRACKED_POSITION)
    );
  });
  // One volume per keyword, even when several competitors rank for it.
  const volumes = new Map<string, number>();
  for (const row of gaps)
    volumes.set(
      row.keyword.toLowerCase(),
      Math.max(volumes.get(row.keyword.toLowerCase()) ?? 0, row.searchVolume),
    );
  const frequency = new Map<string, number>();
  for (const keyword of volumes.keys())
    for (const token of tokens(keyword))
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
  const topicOf = (keyword: string) =>
    sort(
      sort(
        tokens(keyword),
        (a, b) =>
          (frequency.get(b) ?? 0) - (frequency.get(a) ?? 0) ||
          compareText(a, b),
      ).slice(0, 2),
      compareText,
    ).join(" ");
  const topics = new Map<string, CompetitorKeyword[]>();
  for (const row of gaps) {
    const topic = topicOf(row.keyword);
    if (!topic) continue;
    topics.set(topic, [...(topics.get(topic) ?? []), row]);
  }

  const candidates: OpportunityCandidate[] = [];
  for (const [topic, rows] of topics) {
    const keywords = [...new Set(rows.map((row) => row.keyword.toLowerCase()))];
    const volume = keywords.reduce(
      (sum, keyword) => sum + (volumes.get(keyword) ?? 0),
      0,
    );
    if (keywords.length < MIN_TOPIC_KEYWORDS && volume < MIN_TOPIC_VOLUME)
      continue;
    const topicTokens = new Set(topic.split(" "));
    const pages = new Map<string, number>();
    for (const row of input.queryPages)
      if (tokens(row.keys[0]).some((token) => topicTokens.has(token)))
        pages.set(row.keys[1], (pages.get(row.keys[1]) ?? 0) + row.impressions);
    const [page] = sort(
      [...pages],
      (a, b) => b[1] - a[1] || compareText(a[0], b[0]),
    );
    const url = page?.[0] ?? input.siteRoot;
    const difficulties = rows
      .map((row) => row.keywordDifficulty)
      .filter((value): value is number => value !== null);
    const difficulty = difficulties.length
      ? difficulties.reduce((sum, value) => sum + value, 0) /
        difficulties.length /
        100
      : null;
    const domains = [...new Set(rows.map((row) => row.competitorDomain))];
    candidates.push({
      topic,
      type: "content_gap",
      url,
      query: null,
      title: `Write about "${topic}"`,
      explanation: `${keywords.length} commercial keywords about "${topic}" have ${volume} monthly searches. ${domains.join(", ")} rank in the top 10 for them, and this site has fewer than 10 impressions for each.${page ? "" : " No page on this site gets impressions for this topic, so the site root stands in."}`,
      recommendedAction:
        "Write a brief for a new or refreshed page about this topic.",
      searchIntent: "Commercial or transactional, as DataForSEO reports",
      diagnosis: null,
      ...scoreCandidate(input.context, {
        type: "content_gap",
        url,
        query: null,
        position: null,
        demandImpressions: volume,
        visibilityScore: 1,
        visibilityRule:
          "1, because this site has almost no impressions for these keywords",
        difficulty:
          difficulty === null
            ? undefined
            : {
                value: bounded(difficulty),
                source: `the mean competitor keyword difficulty, ${Math.round(difficulty * 100)} / 100`,
              },
        uncertainty: `Competitor rankings and search volumes are DataForSEO estimates from ${rows[0].fetchedAt.slice(0, 10)}. Demand uses monthly searches, not impressions.`,
      }),
      evidence: [],
      urls: [],
      keywords: sort(
        rows,
        (a, b) =>
          b.searchVolume - a.searchVolume ||
          compareText(a.keyword, b.keyword) ||
          compareText(a.competitorDomain, b.competitorDomain),
      ).slice(0, EVIDENCE_KEYWORDS),
    });
  }
  return candidates;
}
