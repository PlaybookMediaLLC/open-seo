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
 * - vite.config.ts: mounts this plugin.
 * - src/public/: site.webmanifest names and the icon PNGs carry the Relay
 *   brand, because static files skip the module pipeline.
 */
const REPLACEMENTS: [RegExp, string][] = [
  // Whole word only, so identifiers like isOpenSEOHost stay intact. The `\n`
  // escape case covers `?raw` markdown, which arrives as a JSON string.
  [/(?<=^|\W|\\[nrt])OpenSEO(?!\w)/g, "Relay"],
  // Support mail must reach Playbook Media, not the upstream maintainers.
  [/support@openseo\.so/g, "team@playbookmedia.io"],
  // Upstream's hosted app is the fallback origin (SSR, the AI assistant's MCP
  // URL); ours must point users at this deployment, not at app.openseo.so.
  [/https:\/\/app\.openseo\.so/g, "https://seo.playbookmedia.io"],
  [/https:\/\/openseo\.so\/pricing/g, "https://seo.playbookmedia.io/#pricing"],
];

const APP_MODULE = /\/src\/[^?]*\.(?:[cm]?[jt]sx?|md)(?:\?|$)/;

export function relayBrand(): Plugin {
  return {
    name: "playbook-relay-brand",
    enforce: "pre",
    transform(code, id) {
      if (!APP_MODULE.test(id) || id.includes("/node_modules/")) return null;
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
