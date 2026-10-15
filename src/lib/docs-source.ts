import { loader } from "fumadocs-core/source";
// The explicit server runtime: in the SSR build, the public entry resolves to
// the browser variant of sourceAsync.
import { fromConfig } from "fumadocs-mdx/runtime/vite.server";
import { docs, docsMeta } from "../../.source/index";
import type * as Config from "../../source.config";

/** Relay's product docs (content/docs), served at /docs. */
export const docsSource = loader({
  source: await fromConfig<typeof Config>().sourceAsync(docs, docsMeta),
  baseUrl: "/docs",
  plugins: [
    {
      transformPageTree: {
        // skills/meta.json lists its own "[Overview](/docs/skills)" link with
        // short labels, so the folder's index entry would repeat it.
        folder(node, folderPath) {
          return folderPath === "skills" ? { ...node, index: undefined } : node;
        },
      },
    },
  ],
});
