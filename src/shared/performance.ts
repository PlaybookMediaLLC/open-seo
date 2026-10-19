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
