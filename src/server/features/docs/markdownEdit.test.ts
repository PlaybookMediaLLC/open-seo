import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { MarkdownEdit } from "@/types/schemas/docs";
import { docOutline } from "./docsMarkdown";
import { applyMarkdownEdit, planMarkdownEdit } from "./markdownEdit";

// RFC-0017 5.5: edits on real Relay docs. Front matter and JSX must stay
// byte-identical, or the edit is refused.
const PATH = "content/docs/agent-setup.mdx";
const source = readFileSync(PATH, "utf8");
const edit = (change: MarkdownEdit, text = source, path = PATH) => {
  const { beforeText, afterText } = planMarkdownEdit(text, path, change);
  return applyMarkdownEdit(text, path, beforeText, afterText).source;
};

describe("markdown edits", () => {
  it("inserts a section at the end of the chosen heading's section", () => {
    const edited = edit({
      kind: "insert_section",
      heading: "Set up your agent",
      markdown:
        "## Check the connection\n\nAsk your agent to list the Relay tools.",
    });
    expect(edited).toContain(
      "- [Cursor and other MCP clients](/docs/mcp)\n\n## Check the connection\n\nAsk your agent to list the Relay tools.\n\n## Update your skills",
    );
  });

  it("adds an item to the list under a heading", () => {
    expect(
      edit({
        kind: "add_faq_item",
        heading: "Set up your agent",
        item: "[Gemini](/docs/mcp)",
      }),
    ).toContain(
      "- [Cursor and other MCP clients](/docs/mcp)\n- [Gemini](/docs/mcp)\n",
    );
  });

  it("replaces one paragraph found by its text", () => {
    const edited = edit({
      kind: "replace_paragraph",
      before:
        "You can also copy this prompt from Agent setup in the Relay app.",
      after: "Copy this prompt from **Agent setup** in the Relay app.",
    });
    expect(edited).toContain(
      "\nCopy this prompt from **Agent setup** in the Relay app.\n",
    );
    expect(edited).not.toContain("You can also copy");
  });

  // RFC-0017 5.6: a draft's placeholder blocks the change until it is filled.
  it("refuses text that still has an owner placeholder", () => {
    expect(() =>
      edit({
        kind: "add_faq_item",
        heading: "Set up your agent",
        item: "[Gemini](/docs/mcp): [Owner: add the setup steps]",
      }),
    ).toThrow("Fill every [Owner: …] placeholder first.");
  });

  it("refuses edits that would touch JSX or front matter, or add JSX", () => {
    const callout = "# Page\n\n<Callout>\n\nOld text.\n\n</Callout>\n";
    expect(() =>
      edit(
        { kind: "replace_paragraph", before: "Old text.", after: "New." },
        callout,
        "a.mdx",
      ),
    ).toThrow("exactly once at the top level");
    expect(() =>
      applyMarkdownEdit(callout, "a.mdx", "Old text.", "New text."),
    ).toThrow("front matter, JSX or HTML");
    expect(() =>
      applyMarkdownEdit(source, PATH, 'title: "Agent setup"', 'title: "Setup"'),
    ).toThrow("front matter, JSX or HTML");
    expect(() =>
      edit({
        kind: "insert_section",
        heading: "Set up your agent",
        markdown: "## New\n\n<Steps />",
      }),
    ).toThrow("Write Markdown only");
  });
});

it("keeps front matter and JSX byte-identical in every real docs page", () => {
  const pages = readdirSync("content/docs").filter((name) =>
    name.endsWith(".mdx"),
  );
  let edited = 0;
  for (const name of pages) {
    const path = `content/docs/${name}`;
    const text = readFileSync(path, "utf8");
    const heading = docOutline(text, true).headings.find(
      (item) => item.level === 2,
    );
    if (!heading) continue;
    const result = edit(
      {
        kind: "insert_section",
        heading: heading.text,
        markdown: "## Added\n\nA new section.",
      },
      text,
      path,
    );
    expect(result).toContain("## Added\n\nA new section.");
    edited++;
  }
  expect(edited).toBeGreaterThanOrEqual(10);
});
