import type { OpportunityCandidate } from "@/types/schemas/opportunities";
import {
  bounded,
  type DetectionInput,
  type Ga4LandingPageRow,
  landingPageKey,
  urlLandingPageKey,
} from "./shared";

// RFC-0002 5.2 per-type defaults. The score explanation prints the values used.
const TYPE_DEFAULTS = {
  striking_distance: {
    confidence: 0.65,
    truncatedConfidence: 0.45,
    effortHours: 2,
  },
  declining_page: {
    confidence: 0.5,
    truncatedConfidence: 0.35,
    effortHours: 4,
  },
  low_ctr: { confidence: 0.55, truncatedConfidence: 0.4, effortHours: 1 },
  cannibalization: {
    confidence: 0.4,
    truncatedConfidence: 0.3,
    effortHours: 4,
  },
  // Effort depends on the issue type; URL inspection can raise confidence.
  technical_blocker: {
    confidence: 0.5,
    truncatedConfidence: 0.4,
    effortHours: 2,
  },
  internal_link: {
    confidence: 0.45,
    truncatedConfidence: 0.35,
    effortHours: 0.5,
  },
  content_gap: {
    confidence: 0.35,
    truncatedConfidence: 0.25,
    effortHours: 8,
  },
} as const;

type ScoreComponents = Pick<
  OpportunityCandidate,
  | "commercialScore"
  | "demandScore"
  | "visibilityScore"
  | "difficultyScore"
  | "effortScore"
>;

/** The one priority formula (RFC-0002 2). */
export function priorityFor(confidence: number, scores: ScoreComponents) {
  return Math.round(
    100 *
      confidence *
      (0.3 * scores.commercialScore +
        0.25 * scores.demandScore +
        0.2 * scores.visibilityScore +
        0.15 * (1 - scores.difficultyScore) +
        0.1 * scores.effortScore),
  );
}

/** A live results check moves confidence by this much (RFC-0002 5.3). */
export function serpCheckDelta(featuresAbovePage: boolean) {
  return featuresAbovePage ? -0.15 : 0.1;
}

/** Confidence after a live results check, from the type default. */
export function serpCheckedConfidence(truncated: boolean, delta: number) {
  const defaults = TYPE_DEFAULTS.low_ctr;
  return bounded(
    (truncated ? defaults.truncatedConfidence : defaults.confidence) + delta,
  );
}

type DetectedType = keyof typeof TYPE_DEFAULTS;

export type ScoringContext = {
  roles: Map<string, string>;
  /** Landing-page key to GA4 rows. Null when GA4 is not connected. */
  ga4: Map<string, Ga4LandingPageRow[]> | null;
  currency: string | null;
  keywordDifficulty: Map<string, number>;
  truncated: boolean;
};

export function scoringContext(
  input: Pick<
    DetectionInput,
    "keyPages" | "ga4" | "keywordDifficulty" | "truncated"
  >,
): ScoringContext {
  let ga4: ScoringContext["ga4"] = null;
  if (input.ga4) {
    ga4 = new Map();
    for (const row of input.ga4.rows) {
      const key = landingPageKey(row.hostName, row.landingPage);
      ga4.set(key, [...(ga4.get(key) ?? []), row]);
    }
  }
  return {
    roles: new Map(input.keyPages.map((page) => [page.url, page.role])),
    ga4,
    currency: input.ga4?.currency ?? null,
    keywordDifficulty: input.keywordDifficulty,
    truncated: input.truncated,
  };
}

type Scored = Pick<
  OpportunityCandidate,
  | "confidence"
  | "effortHours"
  | "priority"
  | "commercialScore"
  | "demandScore"
  | "visibilityScore"
  | "difficultyScore"
  | "effortScore"
  | "scoreExplanation"
  | "uncertainty"
  | "ga4"
>;

export function scoreCandidate(
  context: ScoringContext,
  input: {
    type: DetectedType;
    url: string;
    query: string | null;
    /** Null when Search Console has no row for the page. */
    position: number | null;
    demandImpressions: number;
    visibilityScore: number;
    visibilityRule: string;
    /** Multiplies the default confidence, for example 0.6 for seasonal. */
    confidenceFactor?: number;
    /** Replaces the default confidence, for example 0.7 when confirmed. */
    confidence?: number;
    /** Added to confidence after a live results check. */
    confidenceDelta?: { value: number; reason: string };
    effortHours?: number;
    /** Replaces the position proxy, for example competitor difficulty. */
    difficulty?: { value: number; source: string };
    uncertainty: string;
  },
): Scored {
  const defaults = TYPE_DEFAULTS[input.type];
  const role = context.roles.get(input.url);
  const roleScore =
    role === "money"
      ? 1
      : role === "hub"
        ? 0.7
        : role === "spoke" || role === "other"
          ? 0.5
          : 0.25;
  const ga4Rows = context.ga4?.get(urlLandingPageKey(input.url)) ?? [];
  const keyEvents =
    ga4Rows.find((row) => row.period === "current")?.keyEvents ?? 0;
  const ga4Score = keyEvents >= 10 ? 1 : keyEvents >= 1 ? 0.7 : 0;
  const commercialScore = context.ga4
    ? Math.max(roleScore, ga4Score)
    : roleScore;
  const demandScore = bounded(Math.log10(1 + input.demandImpressions) / 5);
  const cachedDifficulty =
    input.query === null
      ? undefined
      : context.keywordDifficulty.get(input.query.toLowerCase());
  const difficultyScore = bounded(
    input.difficulty
      ? input.difficulty.value
      : cachedDifficulty !== undefined
        ? cachedDifficulty / 100
        : input.position === null
          ? 0.5
          : (input.position - 1) / 19,
  );
  const effortHours = input.effortHours ?? defaults.effortHours;
  const effortScore = bounded(1 / effortHours);
  const baseConfidence =
    input.confidence ??
    (context.truncated ? defaults.truncatedConfidence : defaults.confidence);
  const confidence = bounded(
    baseConfidence * (input.confidenceFactor ?? 1) +
      (input.confidenceDelta?.value ?? 0),
  );
  const priority = priorityFor(confidence, {
    commercialScore,
    demandScore,
    visibilityScore: input.visibilityScore,
    difficultyScore,
    effortScore,
  });
  const ga4Text = context.ga4
    ? `the GA4 score ${ga4Score} from ${keyEvents} organic key events in the current period`
    : "no GA4 score, because GA4 is not connected";
  const difficultyText = input.difficulty
    ? input.difficulty.source
    : cachedDifficulty !== undefined
      ? `cached keyword difficulty ${cachedDifficulty} / 100`
      : input.position === null
        ? "0.5, because Search Console has no position for this page"
        : `(position ${input.position} - 1) / 19, clamped to [0,1], an existing-rank proxy`;
  return {
    confidence,
    effortHours,
    priority,
    commercialScore,
    demandScore,
    visibilityScore: input.visibilityScore,
    difficultyScore,
    effortScore,
    scoreExplanation: `Priority = round(100 × confidence ${confidence} × (0.30 × commercial ${commercialScore} + 0.25 × demand ${demandScore} + 0.20 × visibility ${input.visibilityScore} + 0.15 × (1 - difficulty ${difficultyScore}) + 0.10 × inverse effort ${effortScore})) = ${priority}. Confidence starts at ${baseConfidence}${input.confidence === undefined ? `, the default for this type${context.truncated ? " with truncated rows" : ""}` : ", because URL inspection confirms the problem"}${input.confidenceFactor === undefined ? "" : `, multiplied by ${input.confidenceFactor}`}${input.confidenceDelta ? `, then ${input.confidenceDelta.value > 0 ? "+" : ""}${input.confidenceDelta.value} because ${input.confidenceDelta.reason}` : ""}. Commercial is the higher of the page role score ${roleScore} (${role ?? "unknown"}) and ${ga4Text}. Demand = min(1, log10(1 + ${input.demandImpressions} impressions) / 5). Visibility = ${input.visibilityRule}. Difficulty = ${difficultyText}. Effort is an estimate of ${effortHours} hours.`,
    uncertainty: `${input.uncertainty} Priority is a review heuristic, not a traffic or revenue forecast.${context.ga4 ? "" : " GA4 not connected; commercial value uses page roles only."}${context.truncated ? " Source rows are truncated, so coverage and confidence are limited." : " Bounded source rows may omit queries or pages."}`,
    ga4: ga4Rows.map(({ hostName: _hostName, ...row }) => ({
      ...row,
      currency: context.currency,
    })),
  };
}
