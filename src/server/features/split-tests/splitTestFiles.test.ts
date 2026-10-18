import { expect, it } from "vitest";
import { diffCheck, splitFiles } from "./splitTestFiles";

// RFC-0011 5.4: the final pull request may change only the split files and
// the template, and the template may use inSplitVariant only in metadata.
const TEMPLATE = "app/integrations/[slug]/page.tsx";
const expected = splitFiles("t1", ["/integrations/b", "/integrations/a"], "");
const page = (metadata: string, extra = "") => ({
  path: TEMPLATE,
  source: `import { inSplitVariant } from "../../../relay-split";
${extra}
export async function generateMetadata({ params }) {
  ${metadata}
}
export default function Page() { return null; }
`,
});
const check = (
  template = page(`return { title: inSplitVariant("/a") ? "A" : "B" };`),
  changed = [...expected.map((file) => file.path), TEMPLATE],
) =>
  diffCheck({
    changedFiles: changed,
    expected,
    headJson: expected[0]?.source ?? null,
    template,
    templatePath: TEMPLATE,
  });

it("writes a sorted static variant list and a helper with no request input", () => {
  expect(expected.map((file) => file.path)).toEqual([
    "relay-split/t1.json",
    "relay-split/index.ts",
  ]);
  expect(JSON.parse(expected[0]?.source ?? "")).toEqual({
    testId: "t1",
    paths: ["/integrations/a", "/integrations/b"],
  });
  expect(expected[1]?.source).not.toMatch(/cookies|headers|fetch|Math\.random/);
});

it("passes a template that calls inSplitVariant inside generateMetadata", () => {
  expect(check()).toEqual([]);
});

it("refuses other files, a changed list and use outside the metadata", () => {
  expect(
    check(undefined, [
      ...expected.map((file) => file.path),
      TEMPLATE,
      "app/layout.tsx",
    ]),
  ).toEqual([
    "The pull request also changes app/layout.tsx. Only the split files and the template may change.",
  ]);
  expect(
    diffCheck({
      changedFiles: [...expected.map((file) => file.path), TEMPLATE],
      expected,
      headJson: '{"testId":"t1","paths":["/integrations/a"]}',
      template: page(`return { title: inSplitVariant("/a") ? "A" : "B" };`),
      templatePath: TEMPLATE,
    }),
  ).toEqual(["relay-split/t1.json differs from the stored assignment."]);
  expect(
    check(
      page(`return { title: "A" };`, `const variant = inSplitVariant("/a");`),
    ),
  ).toEqual([`${TEMPLATE} uses inSplitVariant outside its metadata.`]);
  expect(
    check(
      undefined,
      expected.map((file) => file.path),
    ),
  ).toEqual([
    `Edit ${TEMPLATE} in this pull request, as the description shows.`,
  ]);
});

it("accepts a shared metadata helper as the template, used inside the helper only", () => {
  const helperPath = "lib/metadata.ts";
  const helper = (extra = "") => ({
    path: helperPath,
    source: `import { inSplitVariant } from "../relay-split";
${extra}
export function pageMetadata(title: string, description: string, path: string) {
  return { title: inSplitVariant(path) ? \`\${title} | Acme\` : title, description };
}
`,
  });
  const run = (template = helper()) =>
    diffCheck({
      changedFiles: [...expected.map((file) => file.path), helperPath],
      expected,
      headJson: expected[0]?.source ?? null,
      template,
      templatePath: helperPath,
      helper: "pageMetadata",
    });
  expect(run()).toEqual([]);
  expect(run(helper('const early = inSplitVariant("/a");'))).toEqual([
    `${helperPath} uses inSplitVariant outside pageMetadata.`,
  ]);
});
