import { describe, expect, it } from "vitest";
import {
  auditFindings,
  indexStateFindings,
  queryLossFindings,
  rankFindings,
} from "./investigationFindings";

const row = (query: string, clicks: number) => ({ keys: [query], clicks });
const entry = (first: number | null, last: number | null) => ({
  trackingKeywordId: "k",
  device: "desktop" as const,
  firstPosition: first,
  lastPosition: last,
  firstCheckedAt: "2026-09-01",
  lastCheckedAt: "2026-10-01",
});

describe("investigation findings", () => {
  it("ranks the queries that lost the most clicks, by their share of the loss", () => {
    const findings = queryLossFindings(
      [row("pricing", 40), row("about", 10), row("new", 30)],
      [row("pricing", 100), row("about", 20), row("blog", 5)],
    );
    expect(findings.map((item) => [item.severity, item.summary])).toEqual([
      ["high", '"pricing" lost 60 clicks (100 → 40).'],
      ["low", '"about" lost 10 clicks (20 → 10).'],
      ["low", '"blog" lost 5 clicks (5 → 0).'],
    ]);
    expect(findings[0]).toMatchObject({ metricBefore: 100, metricAfter: 40 });
    expect(queryLossFindings([row("a", 5)], [row("a", 5)])).toMatchObject([
      { kind: "query_loss", severity: "info" },
    ]);
  });

  it("flags an unindexed page, a robots block and a different Google canonical", () => {
    expect(
      indexStateFindings({
        verdict: "FAIL",
        coverageState: "Crawled - currently not indexed",
        robotsTxtState: "DISALLOWED",
        googleCanonical: "https://a.com/x",
        userCanonical: "https://a.com/y",
      }).map((item) => [item.severity, item.summary]),
    ).toEqual([
      [
        "high",
        "Google does not report the page as indexed: Crawled - currently not indexed.",
      ],
      ["high", "robots.txt blocks the page."],
      [
        "high",
        "Google chose a different canonical: https://a.com/x instead of https://a.com/y.",
      ],
    ]);
    expect(
      indexStateFindings({ verdict: "PASS", coverageState: "Indexed" }),
    ).toMatchObject([{ severity: "info" }]);
  });

  it("maps site audit issues to severities", () => {
    expect(
      auditFindings(
        [
          { issueType: "missing_title", severity: "critical" },
          { issueType: "slow_page", severity: "warning" },
        ],
        "2026-10-01T10:00:00.000Z",
      ).map((item) => [item.severity, item.summary]),
    ).toEqual([
      ["high", "The site audit of 2026-10-01 found missing title."],
      ["medium", "The site audit of 2026-10-01 found slow page."],
    ]);
  });

  it("reports rank moves only for tracked keywords that are the page's queries", () => {
    const history = new Map([
      ["pricing", [entry(3, 9)]],
      ["about", [entry(8, null)]],
      ["blog", [entry(12, 4)]],
      ["other", [entry(1, 20)]],
    ]);
    expect(
      rankFindings(history, ["Pricing", "about", "blog"]).map((item) => [
        item.severity,
        item.summary,
      ]),
    ).toEqual([
      [
        "high",
        'Tracked keyword "pricing" (desktop) moved from position 3 to position 9.',
      ],
      [
        "high",
        'Tracked keyword "about" (desktop) moved from position 8 to not ranking.',
      ],
      [
        "info",
        'Tracked keyword "blog" (desktop) moved from position 12 to position 4.',
      ],
    ]);
  });
});
