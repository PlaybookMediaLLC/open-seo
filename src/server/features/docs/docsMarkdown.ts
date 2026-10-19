import GithubSlugger from "github-slugger";
import type { Nodes, Root } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { mdxFromMarkdown } from "mdast-util-mdx";
import { toString } from "mdast-util-to-string";
import { mdxjs } from "micromark-extension-mdxjs";
import { parse as parseYaml } from "yaml";

// RFC-0017 5.2 and 5.5: one syntax tree for the docs index and the docs
// edits, from the MDX tooling that the repository already uses.
const FRONT_MATTER = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;

/**
 * The tree of the body after the front matter. The parser has no front
 * matter extension, so the front matter is cut off first; node offsets in
 * the tree count from `offset`.
 */
function parseDoc(source: string, mdx: boolean) {
  const frontMatter = FRONT_MATTER.exec(source)?.[0] ?? "";
  const tree: Root = fromMarkdown(
    source.slice(frontMatter.length),
    mdx
      ? { extensions: [mdxjs()], mdastExtensions: [mdxFromMarkdown()] }
      : undefined,
  );
  return { frontMatter, offset: frontMatter.length, tree };
}

function frontMatterTitle(frontMatter: string) {
  try {
    const value: unknown = parseYaml(
      frontMatter.replace(/^---\r?\n/, "").replace(/---[ \t]*(\r?\n)?$/, ""),
    );
    return typeof value === "object" &&
      value !== null &&
      "title" in value &&
      typeof value.title === "string"
      ? value.title
      : null;
  } catch {
    return null;
  }
}

function headingsOf(node: Nodes, found: Array<Nodes & { type: "heading" }>) {
  if (node.type === "heading") found.push(node);
  else if ("children" in node)
    for (const child of node.children) headingsOf(child, found);
  return found;
}

/** The title, the headings with their anchors and the word count of a file. */
export function docOutline(source: string, mdx: boolean) {
  const { frontMatter, tree } = parseDoc(source, mdx);
  const slugger = new GithubSlugger();
  const headings = headingsOf(tree, []).map((node) => {
    // Fumadocs reads a custom anchor from "## Heading [#anchor]".
    const [, text = "", anchor] =
      /^(.*?)(?:\s*\[#([^\]]+)\])?$/.exec(toString(node).trim()) ?? [];
    return { level: node.depth, text, anchor: anchor ?? slugger.slug(text) };
  });
  return {
    title:
      frontMatterTitle(frontMatter) ??
      headings.find((heading) => heading.level === 1)?.text ??
      null,
    headings,
    wordCount: toString(tree).split(/\s+/).filter(Boolean).length,
  };
}

/** "content/docs/guides/index.mdx" under "/docs/" is "/docs/guides". */
export function docsUrlPath(
  filePath: string,
  directory: string,
  pathPrefix: string,
) {
  const parts = filePath
    .slice(directory.length + 1)
    .replace(/\.mdx?$/, "")
    .split("/");
  if (parts.at(-1) === "index") parts.pop();
  return `/${[...pathPrefix.split("/"), ...parts].filter(Boolean).join("/")}`;
}
