import { describe, expect, it } from "vitest";
import {
  comparePage,
  compareSite,
  weigh,
  type PageFacts,
  type Snapshot,
} from "./seoRules";

const page: PageFacts = {
  title: "Pricing for growing teams",
  description:
    "Compare Relay plans and see which one fits a team that ships SEO changes every week.",
  canonical: "https://example.com/pricing",
  robots: "index, follow",
  h1s: ["Pricing"],
  internalLinks: ["/", "/docs", "/blog", "/about", "/contact", "/login"],
  ogTitle: "Pricing",
  ogImage: "https://example.com/og.png",
  hreflang: ["en", "de"],
  words: 400,
  jsonLd: [{ parses: true, types: ["Product"] }],
};
const base: Snapshot = {
  status: 200,
  redirected: false,
  robotsHeader: null,
  page,
};
const context = {
  path: "/pricing",
  baseOrigin: "https://example.com",
  previewOrigin: "https://pr-7.vercel.app",
  checkRobotsHeader: false,
};
const preview = (change: Partial<PageFacts>, top: Partial<Snapshot> = {}) =>
  comparePage(base, { ...base, ...top, page: { ...page, ...change } }, context);
const rules = (findings: Array<{ rule: string; severity: string }>) =>
  findings.map((finding) => `${finding.rule}:${finding.severity}`);

describe("comparePage", () => {
  it("finds nothing on an identical preview", () => {
    expect(preview({})).toEqual([]);
  });

  it.each<[Partial<PageFacts>, Partial<Snapshot>, string]>([
    [{ robots: "noindex" }, {}, "newly-noindex:blocking"],
    [
      { canonical: "https://example.com/plans" },
      {},
      "canonical-changed:blocking",
    ],
    [{ canonical: null }, {}, "canonical-changed:blocking"],
    [{}, { status: 404 }, "status-regressed:blocking"],
    [{}, { status: 301, redirected: true }, "newly-redirected:blocking"],
    [{ title: "" }, {}, "title-removed:blocking"],
    [{ description: " " }, {}, "description-removed:blocking"],
    [
      { jsonLd: [{ parses: false, types: [] }] },
      {},
      "json-ld-invalid:blocking",
    ],
    [
      { jsonLd: [{ parses: true, types: ["WebPage"] }] },
      {},
      "json-ld-invalid:blocking",
    ],
    [{ title: "Plans" }, {}, "title-changed:warning"],
    [{ description: "New text" }, {}, "description-changed:warning"],
    [{ h1s: ["Plans"] }, {}, "h1-changed:warning"],
    [{ h1s: ["Pricing", "Plans"] }, {}, "multiple-h1:warning"],
    [{ internalLinks: ["/", "/docs"] }, {}, "internal-links-dropped:warning"],
    [{ hreflang: ["en"] }, {}, "hreflang-changed:warning"],
    [{ ogImage: null }, {}, "og-removed:warning"],
    [{ words: 120 }, {}, "content-shrunk:warning"],
  ])("flags %j %j as %s", (change, top, expected) => {
    expect(rules(preview(change, top))).toContain(expected);
  });

  it("compares a preview-origin canonical as production's", () => {
    expect(preview({ canonical: "https://pr-7.vercel.app/pricing/" })).toEqual(
      [],
    );
  });

  it("ignores the preview platform's X-Robots-Tag unless the owner opts in", () => {
    const top = { robotsHeader: "noindex" };
    expect(preview({}, top)).toEqual([]);
    expect(
      rules(
        comparePage(
          base,
          { ...base, ...top },
          { ...context, checkRobotsHeader: true },
        ),
      ),
    ).toEqual(["newly-noindex:blocking"]);
  });

  it("compares nothing when production does not answer 200", () => {
    expect(
      comparePage({ ...base, status: 404 }, { ...base, status: 500 }, context),
    ).toEqual([]);
  });
});

describe("compareSite", () => {
  const site = {
    paths: ["/pricing", "/docs"],
    baseAllows: () => true,
    previewAllows: (path: string) => path !== "/docs",
    baseSitemapCount: 100,
    previewSitemapCount: 95,
  };

  it("flags a robots.txt block on the preview, and a sitemap below 90%", () => {
    expect(rules(compareSite(site))).toEqual(["robots-txt-blocks:blocking"]);
    expect(rules(compareSite({ ...site, previewSitemapCount: 89 }))).toContain(
      "sitemap-shrunk:blocking",
    );
    expect(
      compareSite({ ...site, previewAllows: () => true, baseSitemapCount: 0 }),
    ).toEqual([]);
  });
});

const traffic = () => ({ clicks: 50, impressions: 1500, role: null });

describe("weigh", () => {
  const finding = {
    path: "/pricing",
    rule: "content-shrunk",
    severity: "warning" as const,
    before: null,
    after: null,
    message: "",
  };

  it("raises link and content drops on high-traffic pages, and drops ignored findings", () => {
    expect(
      weigh([finding], traffic, { raiseOnHighTraffic: true, ignores: [] })[0]
        ?.severity,
    ).toBe("blocking");
    expect(
      weigh([finding], traffic, { raiseOnHighTraffic: false, ignores: [] })[0]
        ?.severity,
    ).toBe("warning");
    expect(
      weigh([finding], traffic, {
        raiseOnHighTraffic: true,
        ignores: [{ rule: "content-shrunk", pathPattern: "/pri*" }],
      }),
    ).toEqual([]);
  });

  it("evaluates adversarial ignore patterns without catastrophic backtracking", () => {
    const longPath = { ...finding, path: `/${"a".repeat(1000)}!` };
    expect(
      weigh([longPath], traffic, {
        raiseOnHighTraffic: false,
        ignores: [{ rule: finding.rule, pathRegex: "^/(a+)+$" }],
      }),
    ).toEqual([longPath]);
  });
});
