import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchSnapshot } from "./pageSnapshot";

const mocks = vi.hoisted(() => ({ validate: vi.fn() }));
vi.mock("@/server/lib/audit/url-policy", () => ({
  normalizeAndValidateStartUrl: mocks.validate,
}));
beforeEach(() => {
  mocks.validate.mockImplementation(async (url: string) => url);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const html = `<!doctype html><html><head>
  <title>Pricing</title>
  <meta name="description" content="Plans for teams">
  <link rel="canonical" href="https://example.com/pricing">
  <meta name="robots" content="index">
  <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Product"},{"@type":["Offer","Thing"]}]}</script>
  <script type="application/ld+json">{ broken</script>
</head><body><h1>Pricing</h1><a href="/docs">Docs</a><p>Words here.</p></body></html>`;
const page = (status = 200, headers: Record<string, string> = {}) =>
  new Response(status === 200 ? html : null, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...headers },
  });

it("refuses a blocked host without a request", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  mocks.validate.mockRejectedValue(new Error("CRAWL_TARGET_BLOCKED"));
  expect((await fetchSnapshot("http://10.0.0.1/", null)).status).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it("records a redirect without following it", async () => {
  const fetch = vi.fn(async () => page(301, { location: "/elsewhere" }));
  vi.stubGlobal("fetch", fetch);
  expect(await fetchSnapshot("https://example.com/old", null)).toMatchObject({
    status: 301,
    redirected: true,
    page: null,
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("sends protected-preview headers to the preview host only", async () => {
  const fetch = vi.fn(async (_url: string, _init: RequestInit) => page());
  vi.stubGlobal("fetch", fetch);
  const access = {
    host: "pr-7.vercel.app",
    headers: { "x-vercel-protection-bypass": "secret" },
    expiresAt: null,
  };
  await fetchSnapshot("https://pr-7.vercel.app/pricing", access);
  await fetchSnapshot("https://example.com/pricing", access);
  const headersOf = (index: number) =>
    new Headers(fetch.mock.calls[index]?.[1].headers);
  expect(headersOf(0).get("x-vercel-protection-bypass")).toBe("secret");
  expect(headersOf(1).get("x-vercel-protection-bypass")).toBeNull();
});

it("reads the page facts and each JSON-LD block", async () => {
  vi.stubGlobal("fetch", async () => page());
  const snapshot = await fetchSnapshot("https://example.com/pricing", null);
  expect(snapshot.page).toMatchObject({
    title: "Pricing",
    description: "Plans for teams",
    canonical: "https://example.com/pricing",
    robots: "index",
    h1s: ["Pricing"],
    internalLinks: ["/docs"],
    jsonLd: [
      { parses: true, types: ["Product", "Offer", "Thing"] },
      { parses: false, types: [] },
    ],
  });
});
