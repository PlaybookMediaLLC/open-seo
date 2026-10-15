import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { docsSource } from "@/lib/docs-source";

/** One public docs page and the sidebar tree, or null. No sign-in needed. */
export const getDocsPage = createServerFn({ method: "GET" })
  .inputValidator(z.array(z.string()))
  .handler(async ({ data: slugs }) => {
    const page = docsSource.getPage(slugs);
    if (!page) return null;
    return {
      path: page.path,
      url: page.url,
      title: page.data.title,
      description: page.data.description,
      pageTree: await docsSource.serializePageTree(docsSource.getPageTree()),
    };
  });
