import { expect, it } from "vitest";
import { applyCopyEdits } from "./copyChange";

// RFC-0012 5.4 step 6: one node changes, escaped for its kind.
const edit = (path: string, source: string, afterText: string) =>
  applyCopyEdits(new Map([[path, { source, blobSha: "a".repeat(40) }]]), [
    { filePath: path, beforeText: "Book a call", afterText },
  ]);

it("escapes the new text for its node and refuses markup in JSX text", async () => {
  const { files, textEdits } = await edit(
    "lib/content.ts",
    "export const cta = 'Book a call';\n",
    "Let's talk",
  );
  expect(files[0].source).toBe("export const cta = 'Let\\'s talk';\n");
  expect(textEdits[0]).toMatchObject({
    nodeKind: "string_literal",
    afterSnippet: "export const cta = 'Let\\'s talk';",
  });
  await expect(
    edit("page.tsx", "const a = <p>Book a call</p>;", "Book <b>now</b>"),
  ).rejects.toThrow("markup");
});
