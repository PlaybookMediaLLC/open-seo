import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

// RFC-0013 5.6: no screen and no user guide says that a site is compliant.
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

it("never uses the word compliant in the app or the user guide", () => {
  const sources = [
    ...files("src/client"),
    ...files("src/routes"),
    ...files("src/shared"),
    ...files("content/docs"),
  ].filter((path) => /\.(tsx?|mdx?)$/.test(path) && !path.endsWith(".test.ts"));
  expect(
    sources.filter((path) => /compliant/i.test(readFileSync(path, "utf8"))),
  ).toEqual([]);
});
