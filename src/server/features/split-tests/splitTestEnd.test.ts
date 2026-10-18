import { expect, it } from "vitest";
import { endTemplate } from "./splitTestEnd";

// RFC-0011 5.7: ending a test leaves no split code in the template.
const PATH = "app/integrations/[slug]/page.tsx";
const source = `import { inSplitVariant } from "../../../relay-split";
import { getIntegration } from "@/lib/integrations";

export async function generateMetadata({ params }) {
  const integration = await getIntegration(params.slug);
  return {
    title: inSplitVariant(\`/integrations/\${params.slug}\`)
      ? \`\${integration.name} integration for Conduitt\`
      : integration.title,
  };
}
`;

it("keeps the variant to apply the winner, and the current value to remove", () => {
  const applied = endTemplate(source, PATH, "apply");
  expect(applied.problems).toEqual([]);
  expect(applied.source).not.toContain("inSplitVariant");
  expect(applied.source).toContain(
    "title: `${integration.name} integration for Conduitt`,",
  );
  expect(endTemplate(source, PATH, "remove").source).toContain(
    "title: integration.title,",
  );
});

it("leaves any other use of the helper to a person", () => {
  const other = source.replace(
    "return {",
    "const variant = inSplitVariant(params.slug);\n  return {",
  );
  expect(endTemplate(other, PATH, "apply").problems).toEqual([
    `${PATH} uses inSplitVariant outside a "? :" expression. Finish this change by hand.`,
  ]);
});
