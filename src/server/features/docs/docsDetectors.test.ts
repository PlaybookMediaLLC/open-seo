import { describe, expect, it } from "vitest";
import {
  detectDocsProblems,
  viewedDocsPages,
  type DocsPage,
} from "./docsDetectors";

// RFC-0017 5.3: each rule at its threshold and one step below it.
const NOW = new Date("2026-10-19T00:00:00Z");
const page: DocsPage = {
  filePath: "content/docs/keys.mdx",
  urlPath: "/docs/keys",
  title: "API keys",
  headings: ["Rotate a key"],
};
const detect = (input: Partial<Parameters<typeof detectDocsProblems>[0]>) =>
  detectDocsProblems({
    docsRoot: "https://example.com/docs/",
    pages: [page],
    searches: null,
    gscPages: [],
    viewed: [],
    now: NOW,
    ...input,
  }).map((item) => [item.type, item.query ?? item.url]);
const row = (
  path: string,
  impressions: number,
  position: number,
  ctr = 0.1,
) => ({
  keys: [`https://example.com${path}`],
  clicks: Math.round(impressions * ctr),
  impressions,
  ctr,
  position,
});

describe("docs_search_gap", () => {
  it("needs 20 searches for words that no title or heading contains", () => {
    expect(
      detect({
        searches: [
          { term: "Webhooks", searches: 12 },
          { term: "webhook", searches: 8 },
          { term: "sso", searches: 19 },
        ],
      }),
    ).toEqual([["docs_search_gap", "Webhooks"]]);
  });

  it("finds no gap for a term that a title or heading already answers", () => {
    expect(
      detect({
        searches: [
          { term: "api key", searches: 50 },
          { term: "how to rotate keys", searches: 50 },
        ],
      }),
    ).toEqual([]);
  });
});

describe("docs_page_underperforming", () => {
  it("needs 500 impressions below position 10", () => {
    expect(
      detect({
        gscPages: [
          row("/docs/a", 500, 10.6),
          row("/docs/b", 499, 15),
          row("/docs/c", 900, 10),
          row("/blog/d", 900, 30),
        ],
      }),
    ).toEqual([["docs_page_underperforming", "https://example.com/docs/a"]]);
  });

  it("needs half or less of the docs median CTR at the position", () => {
    const peers = ["x", "y", "z"].map((name) =>
      row(`/docs/${name}`, 200, 3, 0.1),
    );
    expect(
      detect({
        gscPages: [
          ...peers,
          row("/docs/low", 500, 3, 0.05),
          row("/docs/ok", 500, 3, 0.051),
        ],
      }),
    ).toEqual([["docs_page_underperforming", "https://example.com/docs/low"]]);
  });
});

describe("docs_stale_page", () => {
  it("needs 500 views and 12 months without a change", () => {
    const viewed = viewedDocsPages(
      [page, { ...page, filePath: "b.mdx", urlPath: "/docs/b" }],
      [
        { path: "/docs/keys/", views: 500 },
        { path: "/docs/b", views: 499 },
      ],
    );
    expect(viewed.map((item) => item.views)).toEqual([500]);
    expect(
      detect({
        viewed: [{ ...viewed[0], lastChanged: "2025-10-19T00:00:00Z" }],
      }),
    ).toEqual([["docs_stale_page", "https://example.com/docs/keys"]]);
    expect(
      detect({
        viewed: [{ ...viewed[0], lastChanged: "2025-10-20T00:00:00Z" }],
      }),
    ).toEqual([]);
  });
});
