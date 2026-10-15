import { createFileRoute, notFound } from "@tanstack/react-router";
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
import { BrandMark } from "@/client/components/BrandMark";
import docsCss from "@/client/features/docs/docs.css?url";
import { docsMdxComponents } from "@/client/features/docs/docsMdxComponents";
import { getDocsPage } from "@/serverFunctions/docs";
import { docs } from "../../../.source/index";

const DESCRIPTION =
  "How to use Relay: Search Console opportunities, research, rank tracking, and connecting your AI agent over MCP.";

export const Route = createFileRoute("/docs/$")({
  loader: async ({ params }) => {
    const slugs = (params._splat ?? "").split("/").filter(Boolean);
    const page = await getDocsPage({ data: slugs });
    if (!page) throw notFound();
    await clientLoader.preload(page.path);
    return page;
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.title
          ? `${loaderData.title} · Relay Docs`
          : "Relay Docs",
      },
      { name: "description", content: loaderData?.description ?? DESCRIPTION },
      { name: "theme-color", content: "#000000" },
    ],
    links: [{ rel: "stylesheet", href: docsCss }],
  }),
  component: DocsRoute,
});

const clientLoader = createClientLoader(docs, {
  id: "docs",
  component({ toc, frontmatter, default: MDX }) {
    return (
      <DocsPage toc={toc}>
        <DocsTitle>{frontmatter.title}</DocsTitle>
        <DocsDescription>{frontmatter.description}</DocsDescription>
        <DocsBody>
          <MDX components={docsMdxComponents} />
        </DocsBody>
      </DocsPage>
    );
  },
});

function DocsRoute() {
  const page = useFumadocsLoader(Route.useLoaderData());
  const Content = clientLoader.getComponent(page.path);
  return (
    // Docs are always dark, like the landing page, so the theme switch and
    // the class-based theme are off. Search is off until the docs outgrow
    // the sidebar.
    <RootProvider theme={{ enabled: false }} search={{ enabled: false }}>
      <DocsLayout
        tree={page.pageTree}
        nav={{
          title: (
            <span className="flex items-center gap-2 font-semibold">
              <BrandMark className="size-5" />
              Relay
            </span>
          ),
          url: "/",
        }}
        links={[
          { text: "Home", url: "/" },
          { text: "Pricing", url: "/#pricing" },
          { text: "Open app", url: "/app" },
        ]}
        themeSwitch={{ enabled: false }}
        searchToggle={{ enabled: false }}
      >
        <Content />
      </DocsLayout>
    </RootProvider>
  );
}
