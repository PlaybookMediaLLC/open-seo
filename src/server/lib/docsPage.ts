import { createFromSource } from "fumadocs-core/search/server";
import { docsSource } from "@/lib/docs-source";

/**
 * One public docs page and the sidebar tree, or null. Docs are public, so this
 * is read directly during SSR and through /api/docs on client navigation,
 * never through a server function (those all require a signed-in user).
 */
export async function loadDocsPage(slugs: string[]) {
  const page = docsSource.getPage(slugs);
  if (!page) return null;
  return {
    path: page.path,
    url: page.url,
    title: page.data.title,
    description: page.data.description,
    pageTree: await docsSource.serializePageTree(docsSource.getPageTree()),
  };
}

export type DocsPageData = NonNullable<
  Awaited<ReturnType<typeof loadDocsPage>>
>;

/** Full-text search over the docs, served publicly at /api/search. */
export const docsSearch = createFromSource(docsSource);
