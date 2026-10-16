import type { GscSearchAnalyticsRow } from "@/server/lib/gscClient";
import type {
  Ga4LandingPageMetrics,
  OpportunityMetrics,
} from "@/types/schemas/opportunities";

export type Ga4LandingPageRow = Omit<Ga4LandingPageMetrics, "currency"> & {
  hostName: string;
};

export type DetectionInput = {
  queryPages: GscSearchAnalyticsRow[];
  currentPages: GscSearchAnalyticsRow[];
  previousPages: GscSearchAnalyticsRow[];
  /** The current and previous windows, each moved back 364 days. */
  yearAgoPages: GscSearchAnalyticsRow[];
  yearAgoPreviousPages: GscSearchAnalyticsRow[];
  keyPages: Array<{ url: string; role: string }>;
  brandTerms: string[];
  /** Null when GA4 is not connected for the project. */
  ga4: { rows: Ga4LandingPageRow[]; currency: string | null } | null;
  /** Lowercase query to cached keyword difficulty (0 to 100). */
  keywordDifficulty: Map<string, number>;
  truncated: boolean;
};

export function usableRow(
  row: GscSearchAnalyticsRow,
  pageIndex: number,
): boolean {
  if (
    ![row.clicks, row.impressions, row.ctr, row.position].every(
      (value) => Number.isFinite(value) && value >= 0,
    ) ||
    !Number.isInteger(row.clicks) ||
    !Number.isInteger(row.impressions) ||
    row.clicks > row.impressions ||
    row.ctr > 1
  )
    return false;
  const page = row.keys?.[pageIndex];
  if (!page || page !== page.trim()) return false;
  if (pageIndex === 1 && !row.keys?.[0]?.trim()) return false;
  try {
    const url = new URL(page);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function metrics(row: GscSearchAnalyticsRow): OpportunityMetrics {
  return {
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  };
}

/** Sums rows. Position is the impression-weighted mean, as in Search Console. */
export function totals(rows: OpportunityMetrics[]): OpportunityMetrics {
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  const weighted = rows.reduce(
    (sum, row) => sum + row.position * row.impressions,
    0,
  );
  return {
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    position: impressions ? weighted / impressions : 0,
  };
}

export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function bounded(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 10_000) / 10_000;
}

/** A query is branded when it contains a brand term as a whole word. */
export function brandMatcher(terms: string[]): (query: string) => boolean {
  if (!terms.length) return () => false;
  const escaped = terms.map((term) =>
    term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${escaped.join("|")})(?![\\p{L}\\p{N}])`,
    "u",
  );
  return (query) => pattern.test(query.toLowerCase());
}

/** GA4 reports a host and a path. Search Console reports a full URL. */
export function landingPageKey(hostName: string, path: string): string {
  return `${hostName.toLowerCase()}${path}`;
}

export function urlLandingPageKey(url: string): string {
  const parsed = new URL(url);
  return landingPageKey(parsed.hostname, parsed.pathname);
}
