import { createClientLoader } from "fumadocs-mdx/runtime/vite";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import { docsMdxComponents } from "@/client/features/docs/docsMdxComponents";
import { docs } from "../../../../.source/index";

/**
 * Renders a docs page's compiled MDX. Its own module, so the docs route's
 * loader can import it lazily: that keeps Fumadocs and the agent prompts out
 * of the bundle every page loads.
 */
export const docsClientLoader = createClientLoader(docs, {
  id: "docs",
  component({ toc, frontmatter, default: MDX }) {
    return (
      <DocsPage
        toc={toc}
        tableOfContent={{ style: "clerk" }}
        breadcrumb={{ enabled: false }}
      >
        <DocsTitle>{frontmatter.title}</DocsTitle>
        <DocsDescription>{frontmatter.description}</DocsDescription>
        <DocsBody>
          <MDX components={docsMdxComponents} />
        </DocsBody>
      </DocsPage>
    );
  },
});
