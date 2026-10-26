import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { z } from "zod";

// Resolve through the real developer-tool chain so this tests the installed
// transitive package, without adding a second, unrelated copy as a dependency.
const devtoolsRequire = createRequire(
  import.meta.resolve("@tanstack/devtools-vite"),
);
const editorRequire = createRequire(devtoolsRequire.resolve("launch-editor"));
const { quote } = z
  .object({ quote: z.function() })
  .parse(editorRequire("shell-quote"));

await test("oversized constrained arrays stop before accumulating element errors", () => {
  const result = z.array(z.string()).max(1).safeParse(Array(1000).fill(1));
  assert.equal(result.success, false);
  assert.equal(result.error.issues.length, 1);
  assert.equal(result.error.issues[0].code, "too_big");
});

await test("shell quoting rejects line terminators after a comment token", () => {
  // Only construct the string. Never execute it in a shell.
  assert.throws(
    () => quote(["echo", "ok", { comment: "note" }, "value\nid;#"]),
    TypeError,
  );
  assert.doesNotThrow(() => quote(["echo", "ordinary argument"]));
});
