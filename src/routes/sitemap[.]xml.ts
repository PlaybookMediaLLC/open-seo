import { createFileRoute } from "@tanstack/react-router";
import { docsSource } from "@/lib/docs-source";
import { RELAY_ORIGIN } from "@/lib/relay-seo";

// Playbook fork: the public pages for search engines. robots.txt points here.
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        const paths = [
          "/",
          "/terms",
          "/privacy",
          ...docsSource.getPages().map((page) => page.url),
        ];
        const urls = paths
          .map((path) => `  <url><loc>${RELAY_ORIGIN}${path}</loc></url>`)
          .join("\n");
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
          {
            headers: {
              "Content-Type": "application/xml; charset=utf-8",
              "Cache-Control": "public, max-age=3600",
            },
          },
        );
      },
    },
  },
});
