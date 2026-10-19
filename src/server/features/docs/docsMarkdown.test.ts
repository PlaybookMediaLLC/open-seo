import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { docOutline, docsUrlPath } from "./docsMarkdown";

// RFC-0017 5.2: the index reads real Relay docs, with JSX and custom anchors.
it("reads the title, headings and anchors of a real MDX page", () => {
  const outline = docOutline(
    readFileSync("content/docs/agent-setup.mdx", "utf8"),
    true,
  );
  expect(outline.title).toBe("Agent setup");
  expect(outline.headings).toEqual([
    { level: 2, text: "Set up your agent", anchor: "set-up-your-agent" },
    { level: 2, text: "Update your skills", anchor: "update-your-skills" },
  ]);
  expect(outline.wordCount).toBeGreaterThan(100);
});

it("maps a file to its URL path under the docs prefix", () => {
  expect(
    docsUrlPath("content/docs/guides/index.mdx", "content/docs", "/docs/"),
  ).toBe("/docs/guides");
  expect(docsUrlPath("docs/setup.md", "docs", "/")).toBe("/setup");
});
