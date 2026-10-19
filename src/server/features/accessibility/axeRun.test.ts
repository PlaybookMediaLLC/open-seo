import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { clusterKey, loadAxe, runAxe } from "./axeRun";

// The npm package's own file: its hash must match the pin in axeRun.ts.
const AXE = readFileSync("node_modules/axe-core/axe.min.js", "utf8");
const serveAxe = (source: string) =>
  vi.stubGlobal("fetch", async () => new Response(source));
afterEach(() => vi.unstubAllGlobals());

it("loads the pinned axe-core file and refuses any other content", async () => {
  serveAxe(AXE);
  expect(await loadAxe()).toBe(AXE);
  serveAxe(`${AXE}\n// changed`);
  expect(await loadAxe()).toBeNull();
});

/** A stand-in browser binding that answers with one page's HTML. */
const page = (html: string) =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a stand-in for the binding: runAxe calls only quickAction("content")
  ({
    quickAction: async () => Response.json({ success: true, result: html }),
  }) as unknown as Parameters<typeof runAxe>[0];

// RFC-0013 5.2 step 6: one broken component is one cluster.
it("gives one key to the same component on different pages", async () => {
  const onHome = await clusterKey(
    "image-alt",
    "main > .card:nth-child(2) > img",
    '<img src="/a.png" class="card-img" id="x1">',
  );
  const onBlog = await clusterKey(
    "image-alt",
    "main > .card:nth-child(7) > img",
    '<img src="/b.png" class="card-img" id="x9">',
  );
  expect(onBlog).toBe(onHome);
  expect(
    await clusterKey(
      "image-alt",
      "header > img",
      '<img src="/logo.png" class="logo">',
    ),
  ).not.toBe(onHome);
  expect(
    await clusterKey(
      "link-name",
      "main > .card:nth-child(2) > img",
      '<img src="/a.png" class="card-img">',
    ),
  ).not.toBe(onHome);
});

it("reads the result that the injected script writes into the page", async () => {
  const result = {
    version: "4.13.0",
    violations: [
      {
        id: "image-alt",
        impact: "critical",
        tags: ["wcag2a", "wcag111"],
        nodes: [{ target: "img", html: '<img src="/a.png">', summary: "Fix" }],
      },
    ],
  };
  const json = JSON.stringify(result).replaceAll('"', "&quot;");
  expect(
    await runAxe(
      page(
        `<html><body></body><template id="relay-axe-results" data-json="${json}"></template></html>`,
      ),
      "https://example.com/",
      AXE,
    ),
  ).toEqual({ result: { ...result, headings: [] } });
  expect(
    await runAxe(
      page("<html><body></body></html>"),
      "https://example.com/",
      AXE,
    ),
  ).toEqual({
    error:
      "The accessibility check did not finish. The page's security policy may block injected scripts.",
  });
});
