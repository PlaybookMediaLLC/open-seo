import type { Nodes } from "mdast";
import { toString } from "mdast-util-to-string";
import { AppError } from "@/server/lib/errors";
import type { MarkdownEdit } from "@/types/schemas/docs";
import { parseDoc } from "./docsMarkdown";

// RFC-0017 5.5: three docs edits, each one exact replacement of a unique
// span. Front matter, JSX, ESM, expressions and raw HTML stay byte-identical.
const MAX_TEXT = 5_000;
const isMdx = (path: string) => path.endsWith(".mdx");
const invalid = (message: string) => new AppError("VALIDATION_ERROR", message);
const frozen = (node: Nodes) =>
  node.type.startsWith("mdx") || node.type === "html";
const range = (node: Nodes, offset: number) => ({
  start: (node.position?.start.offset ?? 0) + offset,
  end: (node.position?.end.offset ?? 0) + offset,
});

function parse(source: string, path: string) {
  try {
    return parseDoc(source, isMdx(path));
  } catch {
    throw invalid(`${path} is not valid ${isMdx(path) ? "MDX" : "Markdown"}.`);
  }
}

/** The source of every frozen block, outermost first, in file order. */
function frozenSlices(source: string, path: string) {
  const { frontMatter, offset, tree } = parse(source, path);
  const slices = [frontMatter];
  const walk = (node: Nodes) => {
    if (frozen(node)) {
      const { start, end } = range(node, offset);
      slices.push(source.slice(start, end));
    } else if ("children" in node)
      for (const child of node.children) walk(child);
  };
  walk(tree);
  return slices;
}

/** New text may not add JSX, expressions, imports or raw HTML. */
function plainBlocks(text: string, path: string) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > MAX_TEXT)
    throw invalid(`Enter 1 to ${MAX_TEXT} characters.`);
  const { tree } = parse(trimmed, path);
  const walk = (node: Nodes): boolean =>
    !frozen(node) && (!("children" in node) || node.children.every(walk));
  if (!walk(tree))
    throw invalid(
      "Write Markdown only. Relay does not add JSX, imports or HTML.",
    );
  return { text: trimmed, blocks: tree.children };
}

const headingText = (node: Nodes) =>
  toString(node)
    .trim()
    .replace(/\s*\[#[^\]]+\]$/, "");

function sectionOf(source: string, path: string, heading: string) {
  const { offset, tree } = parse(source, path);
  const index = tree.children.findIndex(
    (node) => node.type === "heading" && headingText(node) === heading.trim(),
  );
  const node = tree.children[index];
  if (
    node?.type !== "heading" ||
    tree.children.filter(
      (item) => item.type === "heading" && headingText(item) === heading.trim(),
    ).length !== 1
  )
    throw invalid(
      `The heading "${heading}" must appear once at the top level of ${path}.`,
    );
  const next = tree.children.findIndex(
    (item, position) =>
      position > index && item.type === "heading" && item.depth <= node.depth,
  );
  const blocks = tree.children.slice(index, next < 0 ? undefined : next);
  return { depth: node.depth, blocks, offset };
}

/** The unique span to replace, and its replacement. */
export function planMarkdownEdit(
  source: string,
  path: string,
  edit: MarkdownEdit,
) {
  if (edit.kind === "replace_paragraph") {
    const { offset, tree } = parse(source, path);
    const before = edit.before.trim();
    const matches = tree.children.filter(
      (node) =>
        node.type === "paragraph" &&
        (toString(node) === before ||
          source.slice(range(node, offset).start, range(node, offset).end) ===
            before),
    );
    const [match] = matches;
    if (!match || matches.length !== 1)
      throw invalid(
        `The paragraph must appear exactly once at the top level of ${path}.`,
      );
    const { blocks, text } = plainBlocks(edit.after, path);
    if (blocks.length !== 1 || blocks[0]?.type !== "paragraph")
      throw invalid("Write one paragraph.");
    const { start, end } = range(match, offset);
    return { beforeText: source.slice(start, end), afterText: text };
  }
  const section = sectionOf(source, path, edit.heading);
  const first = section.blocks[0];
  const last = section.blocks.at(-1);
  if (!first || !last) throw invalid("The section is empty.");
  if (edit.kind === "insert_section") {
    const { blocks, text } = plainBlocks(edit.markdown, path);
    const opening = blocks[0];
    if (opening?.type !== "heading" || opening.depth !== section.depth)
      throw invalid(
        `Start the new section with a level ${section.depth} heading (${"#".repeat(section.depth)} Title).`,
      );
    const span = source.slice(
      range(first, section.offset).start,
      range(last, section.offset).end,
    );
    return { beforeText: span, afterText: `${span}\n\n${text}` };
  }
  const list = section.blocks.find((node) => node.type === "list");
  if (list?.type !== "list")
    throw invalid(
      "The section under this heading has no list. Insert a section instead.",
    );
  const { text } = plainBlocks(edit.item, path);
  const span = source.slice(
    range(list, section.offset).start,
    range(list, section.offset).end,
  );
  const lastItem = list.children.at(-1);
  const itemStart = range(lastItem ?? list, section.offset).start;
  const lineStart = source.lastIndexOf("\n", itemStart - 1) + 1;
  const indent = source.slice(lineStart, itemStart);
  const marker = list.ordered
    ? `${(list.start ?? 1) + list.children.length}.`
    : (/^[-*+]/.exec(source.slice(itemStart)) ?? ["-"])[0];
  const lines = text.split(/\r?\n/);
  const item = [
    `${indent}${marker} ${lines[0]}`,
    ...lines
      .slice(1)
      .map((line) =>
        line ? `${indent}${" ".repeat(marker.length + 1)}${line}` : "",
      ),
  ].join("\n");
  return {
    beforeText: span,
    afterText: `${span}${list.spread ? "\n\n" : "\n"}${item}`,
  };
}

const lineAt = (source: string, offset: number) => {
  const start = source.lastIndexOf("\n", offset - 1) + 1;
  const end = source.indexOf("\n", offset);
  return source
    .slice(start, end < 0 ? undefined : end)
    .trim()
    .slice(0, 300);
};

/**
 * Replaces the one span, then parses the file again: the front matter and
 * every JSX, ESM, expression and HTML block must be byte-identical.
 */
export function applyMarkdownEdit(
  source: string,
  path: string,
  beforeText: string,
  afterText: string,
) {
  const start = source.indexOf(beforeText);
  if (!beforeText || start < 0 || source.indexOf(beforeText, start + 1) >= 0)
    throw invalid(`The edited text must appear exactly once in ${path}.`);
  const edited =
    source.slice(0, start) +
    afterText +
    source.slice(start + beforeText.length);
  if (
    JSON.stringify(frozenSlices(source, path)) !==
    JSON.stringify(frozenSlices(edited, path))
  )
    throw invalid(
      `The edit would change front matter, JSX or HTML in ${path}. Relay edits Markdown text only.`,
    );
  return {
    source: edited,
    nodeKind: "markdown_block" as const,
    beforeText,
    afterText,
    beforeSnippet: lineAt(source, start),
    afterSnippet: lineAt(edited, start),
  };
}
