import type { Plugin } from "vite";

/**
 * Playbook fork: the product ships as "Relay". Upstream source says "OpenSEO"
 * in ~90 files (UI copy, MCP metadata, AI prompts), so this rewrites the brand
 * in app modules at dev and build time instead of editing those files, which
 * would conflict on every upstream merge. New upstream copy is renamed for free.
 *
 * Unit tests run without app plugins, so they keep upstream's strings.
 *
 * Fork seams that keep the rename complete (audit: `grep -rn playbook-seam`):
 * - vite.config.ts: mounts this plugin and the docs plugin.
 * - src/lib/auth-api-key.ts: new API keys start with `relay_`.
 * - src/routes/__root.tsx: icon links come from src/lib/relay-icons.ts.
 * - src/routes/__root.tsx: public pages render on the server too
 *   (src/client/components/RelayClientOnly.tsx).
 * - src/public/: site.webmanifest names and the icon PNGs carry the Relay
 *   brand, because static files skip the module pipeline.
 * - plugins/openseo/.mcp.json: the agent plugin connects to this deployment.
 * - plugins/openseo/assets/icon.png and the Cursor manifest's logo URL: the
 *   agent plugin shows the Relay mark.
 */
const RELAY = "https://relay.playbookmedia.io";

const REPLACEMENTS: [RegExp, string][] = [
  // Whole word only, so identifiers like isOpenSEOHost stay intact. The `\n`
  // escape case covers `?raw` markdown, which arrives as a JSON string.
  [/(?<=^|\W|\\[nrt])OpenSEO(?!\w)/g, "Relay"],
  // Support mail must reach Playbook Media, not the upstream maintainers.
  [/support@openseo\.so/g, "team@playbookmedia.io"],
  // Upstream's hosted app is the fallback origin (SSR, the AI assistant's MCP
  // URL); ours must point users at this deployment, not at app.openseo.so.
  [/https:\/\/app\.openseo\.so/g, RELAY],
  // Help links go to Relay's own docs (content/docs, served at /docs).
  [
    /https:\/\/openseo\.so\/blogs\/google-search-console-setup/g,
    `${RELAY}/docs/google-search-console`,
  ],
  [/https:\/\/openseo\.so\/docs/g, `${RELAY}/docs`],
  [/https:\/\/openseo\.so\/blog\b/g, `${RELAY}/docs`],
  // Pricing is a section of the landing page; keep any query string.
  [/https:\/\/openseo\.so\/pricing(\?[^"'`\s)\]#]*)?/g, `${RELAY}/$1#pricing`],
  [/https:\/\/(?:www\.)?openseo\.so/g, RELAY],
  // Source links (skills, self-hosting notes) point at this fork.
  [/github\.com\/every-app\/open-seo/g, "github.com/PlaybookMediaLLC/open-seo"],
];

const BRANDED_FILE = /\.(?:[cm]?[jt]sx?|mdx?)$/;

export function relayBrand(): Plugin {
  let root = process.cwd();
  return {
    name: "playbook-relay-brand",
    enforce: "pre",
    configResolved(config) {
      root = config.root;
    },
    transform(code, id) {
      // Any project file, not just src/: the agent setup prompt is imported
      // from .agents/. Matching on a "/src/" path segment only worked on
      // machines whose checkout path happened to contain one.
      const file = id.split("?")[0] ?? id;
      if (
        !file.startsWith(`${root}/`) ||
        file.includes("/node_modules/") ||
        !BRANDED_FILE.test(file)
      ) {
        return null;
      }
      const next = REPLACEMENTS.reduce(
        (text, [pattern, value]) => text.replace(pattern, value),
        code,
      );
      // ponytail: map null keeps line numbers (no lines move) but columns
      // drift by a few characters on rewritten lines; emit a real map with
      // magic-string if column-exact sourcemaps ever matter.
      return next === code ? null : { code: next, map: null };
    },
  };
}
