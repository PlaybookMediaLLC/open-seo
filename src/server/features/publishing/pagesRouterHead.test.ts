import { describe, expect, it } from "vitest";
import { preparePagesHeadChange } from "./pagesRouterHead";

const page = (head: string, imports = 'import Head from "next/head";') =>
  `${imports}
export default function About() {
  return (
    <>
      <Head>${head}</Head>
      <main />
    </>
  );
}
`;
const plain = page(
  '<title>About our team</title><meta name="description" content="Old copy" />',
);
const change = (
  overrides: Partial<Parameters<typeof preparePagesHeadChange>[0]>,
) =>
  preparePagesHeadChange({
    path: "pages/about.tsx",
    url: "https://example.com/about",
    rootDirectory: "",
    source: plain,
    ...overrides,
  });

describe("Pages Router next/head", () => {
  it("changes the title and the description and nothing else", () => {
    const result = change({
      newTitle: "The team behind Example",
      newDescription: "New copy",
    });
    expect(result.afterSource).toBe(
      page(
        '<title>The team behind Example</title><meta name="description" content="New copy" />',
      ),
    );
    expect(result).toMatchObject({
      beforeTitle: "About our team",
      afterTitle: "The team behind Example",
      beforeDescription: "Old copy",
    });
  });

  it("writes JSX-special characters as entities that read back exactly", () => {
    const result = change({
      newTitle: "Plans & {pricing} <today>",
      newDescription: 'Say "hi" & more',
    });
    expect(result.afterSource).toContain(
      "<title>Plans &#38; &#123;pricing&#125; &#60;today&#62;</title>",
    );
    expect(result.afterSource).toContain(
      'content="Say &#34;hi&#34; &#38; more"',
    );
    expect(
      change({ source: result.afterSource, newTitle: "Something else here" })
        .beforeTitle,
    ).toBe("Plans & {pricing} <today>");
  });

  it.each([
    ["pages/index.tsx", "https://example.com/"],
    ["src/pages/blog/index.jsx", "https://example.com/blog"],
  ])("maps the index route %s", (path, url) => {
    expect(() =>
      change({ path, url, newDescription: "New copy" }),
    ).not.toThrow();
  });

  it.each([
    [
      { path: "pages/_app.tsx" },
      "API routes, _app, _document and private files are not pages.",
    ],
    [
      { path: "pages/api/hello.ts", url: "https://example.com/api/hello" },
      "API routes, _app, _document and private files are not pages.",
    ],
    [
      { path: "pages/[slug].tsx" },
      "The dynamic route segment [slug] is not supported. Relay changes static pages only. Track this page as a ticket instead.",
    ],
    [
      { source: page("<title>{title}</title>") },
      "The title must be one plain text title in Head.",
    ],
    [
      { source: page("<title>One</title></Head><Head><title>Two</title>") },
      "The page renders Head more than once.",
    ],
    [
      { source: page("<title>About</title>", 'import Head from "./seo";') },
      "The page does not import Head from next/head.",
    ],
    [
      { source: plain.replace("<Head>", "<Seo>").replace("</Head>", "</Seo>") },
      "The page does not render Head itself. Relay cannot change a component that wraps Head.",
    ],
    [
      { source: page('<meta {...props} name="description" content="x" />') },
      "Head elements with spread attributes are not supported.",
    ],
  ])("refuses %j", (overrides, message) => {
    expect(() =>
      change({ newTitle: "A new title for the page", ...overrides }),
    ).toThrowError(
      expect.objectContaining({ code: "VALIDATION_ERROR", message }),
    );
  });
});
