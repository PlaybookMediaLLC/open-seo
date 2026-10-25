import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { assetSize, fetchSnapshot } from "./pageSnapshot";

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

it("does not follow an asset redirect to a blocked host", async () => {
  const internal = "http://169.254.169.254/latest/meta-data/";
  mocks.validate.mockImplementation(async (url: string) => {
    if (url === internal) throw new Error("CRAWL_TARGET_BLOCKED");
    return url;
  });
  const fetch = vi.fn(async (_url: string, init: RequestInit) =>
    init.redirect === "follow"
      ? new Response(null, { headers: { "content-length": "123" } })
      : new Response(null, { status: 302, headers: { location: internal } }),
  );
  vi.stubGlobal("fetch", fetch);

  expect(await assetSize("https://example.com/asset.js", null)).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("measures redirected assets without forwarding preview credentials", async () => {
  const cdn = "https://cdn.example.com/asset.js";
  let cdnHeaders: Headers | undefined;
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    if (url === cdn || init.redirect === "follow") {
      cdnHeaders = new Headers(init.headers);
      return new Response(null, { headers: { "content-length": "123" } });
    }
    return new Response(null, { status: 302, headers: { location: cdn } });
  });

  expect(
    await assetSize("https://preview.example.com/asset.js", {
      host: "preview.example.com",
      headers: { "x-vercel-protection-bypass": "test-preview-credential" },
      expiresAt: null,
    }),
  ).toBe(123);
  expect(cdnHeaders?.get("x-vercel-protection-bypass")).toBeNull();
});

it("bounds asset redirect loops", async () => {
  const fetch = vi.fn(
    async () =>
      new Response(null, { status: 302, headers: { location: "/asset.js" } }),
  );
  vi.stubGlobal("fetch", fetch);
  expect(await assetSize("https://example.com/asset.js", null)).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(6);
});
