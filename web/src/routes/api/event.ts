import { createFileRoute } from "@tanstack/react-router";
import { readToolBody } from "@/lib/free-tools/server";

const PLAUSIBLE_EVENT_URL = "https://plausible.io/api/event";

export const Route = createFileRoute("/api/event")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await readToolBody(request, [
          "application/json",
          "text/plain",
        ]);
        if (body instanceof Response) return body;
        // Forward only analytics metadata, never cookies, bearer tokens or
        // Cloudflare Access credentials from the incoming request.
        const headers = new Headers({ "content-type": "application/json" });
        const userAgent = request.headers.get("user-agent");
        const ip = request.headers.get("cf-connecting-ip");
        if (userAgent) headers.set("user-agent", userAgent);
        if (ip) headers.set("x-forwarded-for", ip);
        const upstreamResponse = await fetch(PLAUSIBLE_EVENT_URL, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          redirect: "error",
          signal: AbortSignal.timeout(5_000),
        });
        return new Response(upstreamResponse.body, {
          status: upstreamResponse.status,
          headers: {
            "content-type": "text/plain",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
