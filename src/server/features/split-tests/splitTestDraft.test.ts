import { expect, it } from "vitest";
import { checkVariantText, draftTemplate } from "./splitTestDraft";
import { diffCheck, splitFiles } from "./splitTestFiles";

// RFC-0011 phase 2: Relay drafts the variant for simple patterns and
// changes only the targeted property.
const PATH = "app/integrations/[slug]/page.tsx";
const SOURCE = `import { getIntegration } from "@/lib/integrations";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const integration = await getIntegration(slug);
  return {
    title: integration.title,
    description: integration.summary,
  };
}
`;
const draft = (kind: "suffix" | "prefix", text: string) =>
  draftTemplate({
    source: SOURCE,
    templatePath: PATH,
    field: "title",
    draft: { kind, text },
    importPath: "../../../relay-split",
  });

it("wraps only the title in inSplitVariant and passes the diff check", () => {
  const result = draft("suffix", " for Conduitt");
  expect(result.problems).toEqual([]);
  expect(result.source).toContain(
    "title: inSplitVariant(`/integrations/${slug}`)\n      ? `${integration.title} for Conduitt`\n      : integration.title,",
  );
  expect(result.source).toContain("description: integration.summary,");
  const files = splitFiles("t1", ["/integrations/a"], "");
  expect(
    diffCheck({
      changedFiles: [...files.map((file) => file.path), PATH],
      expected: files,
      headJson: files[0]?.source ?? null,
      template: { path: PATH, source: result.source },
      templatePath: PATH,
    }),
  ).toEqual([]);
});

it("swaps to another plain field and refuses anything else", () => {
  const swap = (expression: string) =>
    draftTemplate({
      source: SOURCE,
      templatePath: PATH,
      field: "title",
      draft: { kind: "swap", expression },
      importPath: "../../../relay-split",
    });
  expect(swap("integration.name").source).toContain(
    "? integration.name\n      : integration.title",
  );
  expect(swap("fetch(integration.url)").problems).toEqual([
    "Enter the other field as a name such as integration.name.",
  ]);
});

it("checks each variant page's final title with the RFC-0004 rules", () => {
  expect(
    checkVariantText("title", { kind: "suffix", text: " for Conduitt" }, [
      "Slack integration for teams",
      "A much longer integration page title for the busiest teams",
    ]),
  ).toEqual([
    "1 variant pages: The title is outside the length. Use 30 to 60.",
  ]);
});
