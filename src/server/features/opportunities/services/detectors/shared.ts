import type { GscSearchAnalyticsRow } from "@/server/lib/gscClient";
import type {
  Ga4LandingPageMetrics,
  InspectionEvidence,
  OpportunityMetrics,
  RankEvidence,
} from "@/types/schemas/opportunities";
import type { PerformanceSignals } from "@/server/features/performance/performanceSignals";
import type { RevenueScores } from "@/server/features/revenue/revenuePaths";

export type Ga4LandingPageRow = Pick<
  Ga4LandingPageMetrics,
  "period" | "landingPage" | "sessions" | "keyEvents" | "revenue"
> & {
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
  /** The latest audit that completed in the last 30 days, if any. */
  audit: AuditSignals | null;
  /** URL inspection results by URL join key. */
  inspections: Map<string, InspectionEvidence>;
  /** Lowercase tracked keyword to its rank history over the last 30 days. */
  rankHistory: Map<string, RankEvidence[]>;
  /** AI answer citations over the last 30 days. Null without a tracker. */
  aiCitations: AiCitations | null;
  /** Live results checks from the last 24 hours, by URL join key. */
  serpChecks: Map<string, { value: number; reason: string }>;
  /** RFC-0014: recent field data and Lighthouse causes. Null without data. */
  performance: PerformanceSignals | null;
  /** RFC-0016: first-touch revenue scores. Null under 80% coverage. */
  revenue: RevenueScores | null;
};

export type AiCitations = {
  trackerId: string;
  answers: number;
  periodStart: string;
  periodEnd: string;
  /** URL join key to the answers that cite it. */
  citations: Map<string, number>;
};

export type AuditSignals = {
  auditId: string;
  completedAt: string;
  issues: Array<{
    id: string;
    issueType: string;
    severity: "critical" | "warning" | "info";
    pageUrl: string;
  }>;
  pages: Array<{
    url: string;
    statusCode: number | null;
    isIndexable: boolean;
  }>;
  /** Target join key to the join keys of the pages that link to it. */
  inlinks: Map<string, Set<string>>;
  /** RFC-0013: axe-core violations grouped by cluster key. */
  accessibility: AccessibilityCluster[];
};

export type AccessibilityCluster = {
  clusterKey: string;
  ruleId: string;
  /** The most severe impact seen in the cluster. */
  impact: "minor" | "moderate" | "serious" | "critical";
  wcagTags: string;
  pageUrls: string[];
  example: { url: string; selector: string; snippet: string };
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

/**
 * Joins audit, Search Console and key-page URLs (RFC-0002 5.3): lowercase
 * host, no fragment, no default port, sorted query, and no trailing slash
 * except on the root.
 */
export function urlJoinKey(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
      return null;
    parsed.hash = "";
    parsed.searchParams.sort();
    if (parsed.pathname.length > 1)
      parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return parsed.toString();
  } catch {
    return null;
  }
}

/** The site's home page URL, also for a domain property. */
export function siteRoot(siteUrl: string): string {
  return siteUrl.startsWith("sc-domain:")
    ? `https://${siteUrl.slice("sc-domain:".length)}/`
    : siteUrl;
}
