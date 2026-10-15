import { createFileRoute } from "@tanstack/react-router";
import { docsSearch } from "@/server/lib/docsPage";

// Public full-text search for /docs. Fumadocs' search dialog calls this path.
export const Route = createFileRoute("/api/search")({
  server: {
    handlers: {
      GET: ({ request }) => docsSearch.GET(request),
    },
  },
});
