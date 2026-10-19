import { expect, it } from "vitest";
import { assetWeight, mixedContent } from "./assetRules";
import type { PageFacts } from "./seoRules";

// RFC-0015 5.3: one test per links and assets rule; only new problems.
const page = (assets: PageFacts["assets"], bytes = 50_000): PageFacts => ({
  title: "",
  description: "",
  canonical: null,
  robots: null,
  h1s: [],
  internalLinks: [],
  ogTitle: null,
  ogImage: null,
  hreflang: [],
  words: 0,
  jsonLd: [],
  bytes,
  assets,
});
const app = { url: "https://example.com/app.js", kind: "script" as const };

it("blocks a new http: subresource on an https: page", () => {
  const legacy = {
    url: "http://cdn.example.com/old.js",
    kind: "script" as const,
  };
  const added = {
    url: "http://cdn.example.com/new.js",
    kind: "script" as const,
  };
  const findings = mixedContent(page([legacy]), page([legacy, added]), {
    path: "/",
    previewOrigin: "https://pr-7.example.com",
  });
  expect(findings).toEqual([
    expect.objectContaining({
      rule: "mixed-content",
      severity: "blocking",
      after: added.url,
    }),
  ]);
});

it("warns on a new image over the budget", () => {
  const hero = { url: "https://example.com/hero.png", kind: "image" as const };
  const sizes = new Map([[hero.url, 800 * 1024]]);
  expect(
    assetWeight(page([]), page([hero]), sizes, { path: "/", imageMaxKb: 300 }),
  ).toContainEqual(
    expect.objectContaining({ rule: "image-too-large", severity: "warning" }),
  );
  expect(
    assetWeight(page([]), page([hero]), sizes, { path: "/", imageMaxKb: 900 }),
  ).not.toContainEqual(expect.objectContaining({ rule: "image-too-large" }));
});

it("warns when the page grows by 25% or more, and only with every size known", () => {
  const big = { url: "https://example.com/big.js", kind: "script" as const };
  const sizes = new Map<string, number | null>([
    [app.url, 50_000],
    [big.url, 30_000],
  ]);
  expect(
    assetWeight(page([app]), page([app, big]), sizes, {
      path: "/",
      imageMaxKb: 300,
    }),
  ).toEqual([
    expect.objectContaining({
      rule: "page-weight-grew",
      before: "98 KB",
      after: "127 KB",
    }),
  ]);
  sizes.delete(big.url);
  expect(
    assetWeight(page([app]), page([app, big]), sizes, {
      path: "/",
      imageMaxKb: 300,
    }),
  ).toEqual([]);
});
