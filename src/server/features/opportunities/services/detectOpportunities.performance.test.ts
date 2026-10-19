import { describe, expect, it } from "vitest";
import type { FieldSnapshot } from "@/server/features/performance/performanceSignals";
import { causesFor } from "@/shared/performance";
import { detectOpportunities } from "./detectOpportunities";
import { input, page, row } from "./detectionTestSupport";

// RFC-0014 5.3: one item per route template and failing metric.
const field = (
  target: string,
  values: Partial<FieldSnapshot>,
  scope: FieldSnapshot["scope"] = "url",
): FieldSnapshot => ({
  scope,
  target,
  formFactor: "phone",
  collectionEnd: "2026-10-17",
  lcpP75Ms: 2_000,
  inpP75Ms: 150,
  clsP75: 0.05,
  ...values,
});
const performance = (results: ReturnType<typeof detectOpportunities>) =>
  results.filter((result) => result.type === "performance_issue");

describe("performance_issue", () => {
  it("measures a template on its most-visited page with data, with its causes", () => {
    const [item, ...rest] = performance(
      detectOpportunities(
        input({
          currentPages: [
            row([page("blog/how-to-grow-fast")], { clicks: 90 }),
            row([page("blog/why-speed-matters-now")], { clicks: 10 }),
          ],
          performance: {
            field: [
              field(page("blog/how-to-grow-fast"), { lcpP75Ms: 3_100 }),
              field(page("blog/why-speed-matters-now"), { lcpP75Ms: 9_000 }),
            ],
            lab: [
              {
                url: page("blog/how-to-grow-fast"),
                strategy: "mobile",
                lcpMs: 3_700,
                inpMs: null,
                cls: 0.02,
                causes: causesFor([
                  "render-blocking-insight",
                  "unsized-images",
                ]),
              },
            ],
          },
        }),
      ),
    );
    expect(rest).toEqual([]);
    expect(item.performance).toEqual({
      template: "/blog/:slug",
      metric: "lcp",
      formFactor: "phone",
      p75Value: 3_100,
      threshold: 2_500,
      scope: "url",
      target: page("blog/how-to-grow-fast"),
      collectionEnd: "2026-10-17",
      labValue: 3_700,
      // Unsized images cause layout shift, not a slow LCP.
      causeIds: "render_blocking",
    });
  });

  it("gives templates without page data one site-wide item from the origin", () => {
    const results = performance(
      detectOpportunities(
        input({
          currentPages: [row([page("pricing")]), row([page("about")])],
          performance: {
            field: [field("https://example.com", { clsP75: 0.25 }, "origin")],
            lab: [],
          },
        }),
      ),
    );
    expect(results.map((result) => result.performance?.template)).toEqual([
      "*",
    ]);
    expect(results[0].recommendedAction).toContain("Lighthouse");
  });

  it("finds nothing when every metric is good", () => {
    expect(
      performance(
        detectOpportunities(
          input({
            currentPages: [row([page("pricing")])],
            performance: { field: [field(page("pricing"), {})], lab: [] },
          }),
        ),
      ),
    ).toEqual([]);
  });
});
