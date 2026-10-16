import type { GscSearchAnalyticsRow } from "@/server/lib/gscClient";
import type { detectOpportunities } from "./detectOpportunities";

export const page = (path: string) => `https://example.com/${path}`;
export function row(
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
export function input(
  overrides: Partial<Parameters<typeof detectOpportunities>[0]> = {},
): Parameters<typeof detectOpportunities>[0] {
  return {
    queryPages: [],
    currentPages: [],
    previousPages: [],
    yearAgoPages: [],
    yearAgoPreviousPages: [],
    keyPages: [],
    brandTerms: [],
    ga4: null,
    keywordDifficulty: new Map(),
    audit: null,
    inspections: new Map(),
    rankHistory: new Map(),
    aiCitations: null,
    serpChecks: new Map(),
    truncated: false,
    ...overrides,
  };
}
