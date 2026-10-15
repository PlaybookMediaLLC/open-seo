import {
  defineCollections,
  defineConfig,
  frontmatterSchema,
  metaSchema,
} from "fumadocs-mdx/config";

// Playbook fork: Relay's product docs, served at /docs by the app itself.
export const docs = defineCollections({
  type: "doc",
  dir: "content/docs",
  schema: frontmatterSchema,
});

export const docsMeta = defineCollections({
  type: "meta",
  dir: "content/docs",
  schema: metaSchema,
});

export default defineConfig();
