import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Playbook fork: prerender the public pages to static HTML at build time.
 * Cloudflare's asset layer then serves them without starting the Worker,
 * whose ~8 MB startup chunk costs about a second on every cold start. The
 * pages render the same for every visitor; the session loads in the browser.
 *
 * Only the Playbook deploy build (`--mode playbook`) prerenders, so self-host
 * builds are unchanged. Mounted in vite.config.ts at a `// playbook-seam` line.
 */
export function relayStartOptions(mode: string) {
  if (mode !== "playbook") return {};
  return {
    prerender: {
      enabled: true,
      // Only the listed pages. Discovery and crawling would also prerender
      // app routes (/app, /sign-in, /oauth-consent), whose requests must reach
      // the Worker.
      autoStaticPathsDiscovery: false,
      crawlLinks: false,
      // /terms becomes terms.html, which the asset layer serves at /terms.
      // A terms/index.html would redirect /terms to /terms/.
      autoSubfolderIndex: false,
      failOnError: true,
      retryCount: 1,
    },
    pages: ["/", "/terms", "/privacy", ...docsPaths()].map((path) => ({
      path,
    })),
  };
}

/** Every page in content/docs, as its /docs URL. */
function docsPaths(dir = "content/docs"): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) return docsPaths(file);
    if (!entry.name.endsWith(".mdx")) return [];
    const slug = relative("content/docs", file)
      .replace(/\.mdx$/, "")
      .replace(/(^|\/)index$/, "");
    return [slug ? `/docs/${slug}` : "/docs"];
  });
}
