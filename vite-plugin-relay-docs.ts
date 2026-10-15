import mdx from "fumadocs-mdx/vite";
import type { Plugin } from "vite";

/**
 * Playbook fork: compiles content/docs for the /docs pages (Fumadocs). The app
 * also imports plain markdown as `?raw` strings (agent prompts, the assistant
 * fact sheet); those stay with Vite instead of being compiled as MDX.
 *
 * Mounted from vite.config.ts at a `// playbook-seam` line.
 */
export async function relayDocs(): Promise<Plugin[]> {
  const plugin = await mdx(await import("./source.config"));
  const transform = plugin.transform;
  if (typeof transform === "function") {
    plugin.transform = function (code, id, options) {
      if (new URLSearchParams(id.split("?")[1]).has("raw")) return;
      return transform.call(this, code, id, options);
    };
  }
  return [
    plugin,
    {
      name: "playbook-relay-docs-deps",
      // The plugin above keeps Fumadocs out of dev pre-bundling, so the search
      // dialog's markdown stack loads raw and hits CommonJS (debug, style-to-js).
      // Pre-bundle that stack; production builds handle CommonJS already.
      config: () => ({
        optimizeDeps: {
          include: [
            "fumadocs-core > remark",
            "fumadocs-core > hast-util-to-jsx-runtime",
          ],
        },
      }),
    },
  ];
}
