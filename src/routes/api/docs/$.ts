import { createFileRoute } from "@tanstack/react-router";
import { loadDocsPage } from "@/server/lib/docsPage";

// Public JSON for client-side navigation between docs pages.
export const Route = createFileRoute("/api/docs/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slugs = (params._splat ?? "").split("/").filter(Boolean);
        const page = await loadDocsPage(slugs);
        if (!page)
          return Response.json({ error: "not_found" }, { status: 404 });
        return Response.json(page, {
          headers: { "Cache-Control": "public, max-age=300" },
        });
      },
    },
  },
});
