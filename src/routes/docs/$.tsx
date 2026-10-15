import { createFileRoute, notFound } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { createClientLoader } from "fumadocs-mdx/runtime/vite";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import { RootProvider } from "fumadocs-ui/provider/tanstack";
import docsCss from "@/client/features/docs/docs.css?url";
import { docsMdxComponents } from "@/client/features/docs/docsMdxComponents";
import { publicPageHead } from "@/lib/relay-seo";
import type { DocsPageData } from "@/server/lib/docsPage";
import { docs } from "../../../.source/index";

const DESCRIPTION =
  "How to use Relay: Search Console opportunities, research, rank tracking, and connecting your AI agent over MCP.";

// Docs are public. Server functions all require a signed-in user, so SSR
// reads the docs directly and client navigation uses the public /api/docs.
const getDocsPage = createIsomorphicFn()
  .server(async (slugs: string[]) => {
    const { loadDocsPage } = await import("@/server/lib/docsPage");
    return loadDocsPage(slugs);
  })
  .client(async (slugs: string[]): Promise<DocsPageData | null> => {
    const response = await fetch(`/api/docs/${slugs.join("/")}`);
    if (response.status === 404) return null;
    if (!response.ok)
      throw new Error(`Docs request failed: ${response.status}`);
    return response.json();
  });

export const Route = createFileRoute("/docs/$")({
  loader: async ({ params }) => {
    const slugs = (params._splat ?? "").split("/").filter(Boolean);
    const page = await getDocsPage(slugs);
    if (!page) throw notFound();
    await clientLoader.preload(page.path);
    return page;
  },
  head: ({ loaderData }) => {
    const seo = publicPageHead({
      path: loaderData?.url ?? "/docs",
      title: loaderData?.title
        ? `${loaderData.title} · Relay Docs`
        : "Relay Docs",
      description: loaderData?.description ?? DESCRIPTION,
    });
    return {
      meta: [...seo.meta, { name: "theme-color", content: "#ffffff" }],
      links: [...seo.links, { rel: "stylesheet", href: docsCss }],
    };
  },
  component: DocsRoute,
});

const clientLoader = createClientLoader(docs, {
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

// The site tabs across the top of the docs (desktop). Phones get the same
// links in the sidebar drawer instead.
const SITE_TABS = [
  { text: "Home", url: "/" },
  { text: "Features", url: "/#features" },
  { text: "Docs", url: "/docs" },
  { text: "Pricing", url: "/#pricing" },
  { text: "Support", url: "mailto:team@playbookmedia.io" },
];

function DocsTabBar() {
  return (
    <nav aria-label="Site" className="relay-docs-tabs">
      {SITE_TABS.map((tab) => (
        <a
          key={tab.url}
          href={tab.url}
          aria-current={tab.url === "/docs" ? "page" : undefined}
        >
          {tab.text}
        </a>
      ))}
      <a href="/app" className="relay-docs-tabs-cta">
        Open app ↗
      </a>
    </nav>
  );
}

function DocsRoute() {
  const page = useFumadocsLoader(Route.useLoaderData());
  const Content = clientLoader.getComponent(page.path);
  return (
    // Docs are always light, so the theme switch and the class-based theme
    // are off. Search reads the public /api/search.
    <RootProvider theme={{ enabled: false }}>
      <DocsLayout
        tree={page.pageTree}
        nav={{
          title: <span className="relay-docs-logo">Relay.</span>,
          url: "/docs",
        }}
        links={[
          ...SITE_TABS.filter((tab) => tab.url !== "/docs"),
          { text: "Open app", url: "/app" },
        ]}
        sidebar={{ collapsible: false }}
        themeSwitch={{ enabled: false }}
      >
        <DocsTabBar />
        <Content />
      </DocsLayout>
    </RootProvider>
  );
}
