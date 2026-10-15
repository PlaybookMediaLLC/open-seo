/**
 * Playbook fork: serves the public pages' HTML from the edge cache. They render
 * the same for every visitor (the session loads in the browser), but a cold
 * Worker takes 1 to 3 seconds to server-render them, while a cache hit
 * answers in about 100 ms.
 *
 * The cache key carries the build ID, so a deploy never serves HTML that
 * points at the previous build's assets. Mounted on the Worker's fetch handler
 * in src/server.ts at a `// playbook-seam` line.
 */

declare const __RELAY_BUILD_ID__: string | undefined;

const BUILD_ID =
  typeof __RELAY_BUILD_ID__ === "string" ? __RELAY_BUILD_ID__ : "dev";

/** "/", "/terms", "/privacy" and the docs. */
const PUBLIC_PAGE = /^\/(?:terms|privacy|docs(?:\/[^?#]*)?)?$/;

// Content only changes with a deploy, and a deploy changes the key.
const EDGE_TTL_SECONDS = 24 * 60 * 60;

type FetchHandler = (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
) => Response | Promise<Response>;

export function withPublicPageCache(handler: FetchHandler): FetchHandler {
  return async (request, env, ctx) => {
    const url = new URL(request.url);
    // A query string could change the rendered router state, so only bare
    // URLs are cached. Dev builds never cache, so edits show at once.
    if (
      !import.meta.env.PROD ||
      request.method !== "GET" ||
      url.search !== "" ||
      !PUBLIC_PAGE.test(url.pathname)
    ) {
      return handler(request, env, ctx);
    }
    const cache = await caches.open("relay-public-pages");
    const key = new Request(`${url.origin}${url.pathname}?build=${BUILD_ID}`);
    const hit = await cache.match(key);
    if (hit) {
      const served = new Response(hit.body, hit);
      served.headers.set("x-relay-cache", "hit");
      return served;
    }

    const response = await handler(request, env, ctx);
    const isHtml = (response.headers.get("content-type") ?? "").startsWith(
      "text/html",
    );
    if (
      response.status === 200 &&
      isHtml &&
      !response.headers.has("set-cookie")
    ) {
      // The stored copy lives a day at the edge; browsers still revalidate.
      const stored = new Response(response.clone().body, response);
      stored.headers.set(
        "Cache-Control",
        `public, s-maxage=${EDGE_TTL_SECONDS}`,
      );
      ctx.waitUntil(cache.put(key, stored));
    }
    return response;
  };
}
