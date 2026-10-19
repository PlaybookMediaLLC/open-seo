import { sort } from "remeda";

// RFC-0014: Core Web Vitals thresholds at the 75th percentile, and the plain
// causes that Relay names from a stored Lighthouse report.
export const PERFORMANCE_METRICS = ["lcp", "inp", "cls"] as const;
export type PerformanceMetric = (typeof PERFORMANCE_METRICS)[number];

export const GOOD: Record<PerformanceMetric, number> = {
  lcp: 2_500,
  inp: 200,
  cls: 0.1,
};

export const METRIC_NAMES: Record<PerformanceMetric, string> = {
  lcp: "Largest Contentful Paint",
  inp: "Interaction to Next Paint",
  cls: "Cumulative Layout Shift",
};

/** "3.1 s", "180 ms" or "0.12". */
export function metricValue(metric: PerformanceMetric, value: number) {
  if (metric === "cls") return value.toFixed(2);
  return value >= 1_000
    ? `${(value / 1_000).toFixed(1)} s`
    : `${Math.round(value)} ms`;
}

export const FIELD_DATA_LIMITS =
  "Field data is the 75th percentile of real Chrome users over 28 days, so a change needs about 4 weeks to show fully. Relay never says that a speed change caused a ranking change.";

/**
 * RFC-0014 5.4: Lighthouse audit and insight ids to plain causes. The ids
 * depend on the Lighthouse version that DataForSEO runs, so each id has a
 * test.
 */
export const PERFORMANCE_CAUSES = [
  {
    id: "lcp_lazy_image",
    label: "The LCP image loads lazily",
    lighthouseIds: ["lcp-lazy-loaded", "lcp-discovery-insight"],
    metrics: ["lcp"],
    fix: 'Remove loading="lazy" from the largest image above the fold, and give it the priority hint.',
  },
  {
    id: "lcp_not_prioritized",
    label: "The LCP image is not prioritized",
    lighthouseIds: ["prioritize-lcp-image", "lcp-discovery-insight"],
    metrics: ["lcp"],
    fix: "Give the largest image above the fold the priority hint, so the browser loads it first.",
  },
  {
    id: "unsized_images",
    label: "Images without a size",
    lighthouseIds: ["unsized-images", "cls-culprits-insight"],
    metrics: ["cls"],
    fix: "Add width and height to each image, so the layout keeps their space while they load.",
  },
  {
    id: "third_party_scripts",
    label: "Third-party scripts block the page",
    lighthouseIds: ["third-party-summary", "third-parties-insight"],
    metrics: ["lcp", "inp"],
    fix: "Load analytics, chat and tag manager scripts after the page, for example with the next/script lazyOnload strategy.",
  },
  {
    id: "render_blocking",
    label: "Render-blocking CSS or JavaScript",
    lighthouseIds: ["render-blocking-resources", "render-blocking-insight"],
    metrics: ["lcp"],
    fix: "Inline the CSS that the first screen needs, and load the rest without blocking the page.",
  },
  {
    id: "large_images",
    label: "Large or old-format images",
    lighthouseIds: [
      "uses-responsive-images",
      "modern-image-formats",
      "image-delivery-insight",
    ],
    metrics: ["lcp"],
    fix: "Serve images at the size they are shown, in WebP or AVIF.",
  },
  {
    id: "unused_javascript",
    label: "Unused JavaScript",
    lighthouseIds: ["unused-javascript"],
    metrics: ["lcp", "inp"],
    fix: "Split or remove JavaScript that the page does not use.",
  },
  {
    id: "slow_server",
    label: "Slow server response",
    lighthouseIds: ["server-response-time"],
    metrics: ["lcp"],
    fix: "Cache the page or make the server respond faster.",
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  lighthouseIds: readonly string[];
  metrics: readonly PerformanceMetric[];
  fix: string;
}>;
export type PerformanceCause = (typeof PERFORMANCE_CAUSES)[number];

/** The causes behind failing Lighthouse audits, in table order. */
export function causesFor(lighthouseIds: Iterable<string>) {
  const failing = new Set(lighthouseIds);
  return PERFORMANCE_CAUSES.filter((cause) =>
    cause.lighthouseIds.some((id) => failing.has(id)),
  );
}

/** The causes named by stored, space-separated cause ids. */
export function causesOf(causeIds: string) {
  const ids = new Set(causeIds.split(" "));
  return PERFORMANCE_CAUSES.filter((cause) => ids.has(cause.id));
}

/** Google's "poor" limits; between good and poor is "needs improvement". */
const POOR: Record<PerformanceMetric, number> = {
  lcp: 4_000,
  inp: 500,
  cls: 0.25,
};
const rating = (metric: PerformanceMetric, value: number) =>
  value <= GOOD[metric]
    ? "good"
    : value <= POOR[metric]
      ? "needs improvement"
      : "poor";

const DAY_MS = 86_400_000;
const POINTS = 4;
// A 28-day window: after 4 weeks, every day in a point is after the change.
const OFFSET_DAYS = 28;

const median = (values: number[]) => {
  const sorted = sort(values, (a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

const values = (rows: Array<{ value: number | null }>) =>
  rows.flatMap((row) => (row.value === null ? [] : [row.value]));

export type FieldResult =
  | { status: "waiting"; readyOn: string }
  | { status: "not_enough_data" }
  | {
      status: "measured";
      before: number;
      after: number;
      beforeRating: string;
      afterRating: string;
      label: "improved" | "worse" | "no clear change";
    };

/**
 * RFC-0014 5.6: the median of the 4 weekly points before the change against
 * the 4 points that start 4 weeks after it. "Improved" when the value
 * becomes good or improves by 15% or more; "worse" for the reverse.
 */
export function fieldResult(
  points: Array<{ collectionEnd: string; value: number | null }>,
  changedOn: string,
  metric: PerformanceMetric,
): FieldResult {
  const start = new Date(`${changedOn.slice(0, 10)}T00:00:00Z`).getTime();
  const firstAfter = new Date(start + OFFSET_DAYS * DAY_MS)
    .toISOString()
    .slice(0, 10);
  const sorted = sort(points, (a, b) =>
    a.collectionEnd.localeCompare(b.collectionEnd),
  );
  const before = sorted
    .filter((point) => point.collectionEnd < changedOn.slice(0, 10))
    .slice(-POINTS);
  const after = sorted
    .filter((point) => point.collectionEnd >= firstAfter)
    .slice(0, POINTS);
  if (after.length < POINTS)
    return {
      status: "waiting",
      readyOn: new Date(start + (OFFSET_DAYS + (POINTS - 1) * 7) * DAY_MS)
        .toISOString()
        .slice(0, 10),
    };
  if (values(before).length < POINTS || values(after).length < POINTS)
    return { status: "not_enough_data" };
  const was = median(values(before));
  const now = median(values(after));
  const beforeRating = rating(metric, was);
  const afterRating = rating(metric, now);
  const label =
    (beforeRating !== "good" && afterRating === "good") || now <= was * 0.85
      ? "improved"
      : (beforeRating === "good" && afterRating !== "good") || now >= was * 1.15
        ? "worse"
        : "no clear change";
  return {
    status: "measured",
    before: was,
    after: now,
    beforeRating,
    afterRating,
    label,
  };
}

/**
 * RFC-0014 5.7: the optional snippet. It sends each page view's LCP, INP and
 * CLS, with web-vitals' own rating, to the site's own GA4. Nothing goes to
 * Relay.
 */
export const VITALS_SNIPPET = `"use client";
import { useReportWebVitals } from "next/web-vitals";

// Add <WebVitals /> once to the root layout, next to the GA4 tag.
export function WebVitals() {
  useReportWebVitals((metric) => {
    if (!["LCP", "INP", "CLS"].includes(metric.name)) return;
    window.gtag?.("event", metric.name, {
      metric_rating: metric.rating,
      value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
      non_interaction: true,
    });
  });
  return null;
}`;

/** A page passes a metric when 75% or more of its loads are rated good. */
export const GOOD_SHARE = 0.75;
