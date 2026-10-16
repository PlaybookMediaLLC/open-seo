import { describe, expect, it } from "vitest";
import { metadataHelperCandidates } from "./metadataHelper";
import { prepareMetadataChange } from "./nextMetadata";

// The shape of test site S1: a (site) route group and a shared metadata helper.
const s1Helper = {
  path: "apps/www/lib/site.ts",
  source: `import type { Metadata } from 'next';
export function pageMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  const image = { url: \`/og/\${path}.png\`, alt: \`\${title} | Playbook Media\` };
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, images: [image] },
    twitter: { card: 'summary_large_image', title, description },
  };
}
`,
};
const s1Page = `import { pageMetadata } from '@/lib/site';
export const metadata = pageMetadata(
  'Our approach',
  'How Playbook Media approaches software ownership.',
  '/approach',
);
export default function Page() {
  return null;
}
`;
const prepareS1 = (
  overrides: Partial<Parameters<typeof prepareMetadataChange>[0]> = {},
) =>
  prepareMetadataChange({
    path: "apps/www/app/(site)/approach/page.tsx",
    url: "https://playbookmedia.io/approach",
    rootDirectory: "apps/www",
    source: s1Page,
    helper: s1Helper,
    newDescription: "New approach copy",
    ...overrides,
  });

describe("metadata helper calls", () => {
  it("changes only the description argument and names the helper and its other uses", () => {
    const result = prepareS1();
    expect(result.afterSource).toBe(
      s1Page.replace(
        "'How Playbook Media approaches software ownership.'",
        "'New approach copy'",
      ),
    );
    expect(result.helperNote).toBe(
      "Changes the description argument of pageMetadata (defined in apps/www/lib/site.ts). The same parameter is also used on lines 12, 13 of apps/www/lib/site.ts.",
    );
  });

  it("accepts an arrow function helper from a relative import", () => {
    const result = prepareMetadataChange({
      path: "app/about/page.tsx",
      url: "https://example.com/about",
      source:
        "import { seo } from '../lib/seo';\nexport const metadata = seo('About', `Old copy`);",
      helper: {
        path: "lib/seo.ts",
        source:
          "export const seo = (title: string, text: string) => ({ title, description: text });",
      },
      newDescription: "New copy",
    });
    expect(result.afterSource).toContain("seo('About', \"New copy\")");
    expect(result.helperNote).toBe(
      "Changes the description argument of seo (defined in lib/seo.ts).",
    );
  });

  it.each([
    [
      "destructured parameters",
      s1Page,
      "export function pageMetadata({ title, description }: Args) { return { title, description }; }",
      "The metadata helper's parameters must be plain names.",
    ],
    [
      "a computed argument",
      s1Page.replace(
        "'How Playbook Media approaches software ownership.'",
        "copy.approach",
      ),
      s1Helper.source,
      "The description is computed. Relay can only change literal text.",
    ],
    [
      "a helper that renames the field",
      s1Page,
      "export function pageMetadata(title: string, summary: string) { return { title, summary }; }",
      "The metadata helper does not return a description field.",
    ],
    [
      "a helper that changes the parameter",
      s1Page,
      "export function pageMetadata(title: string, description: string) { description = description.trim(); return { description }; }",
      "The metadata helper changes the description before it returns it.",
    ],
    [
      "a default import",
      s1Page.replace("{ pageMetadata }", "pageMetadata"),
      s1Helper.source,
      "The metadata helper must be a named import.",
    ],
  ])("rejects %s", (_name, pageSource, helperSource, message) => {
    expect(() =>
      prepareS1({
        source: pageSource,
        helper: { ...s1Helper, source: helperSource },
      }),
    ).toThrowError(
      expect.objectContaining({ code: "VALIDATION_ERROR", message }),
    );
  });
});

describe("metadataHelperCandidates", () => {
  const candidates = (
    specifier: string,
    tsconfig = '{"compilerOptions":{"paths":{"@/*":["./*"]}}}',
  ) =>
    metadataHelperCandidates({
      specifier,
      pagePath: "apps/www/app/(site)/approach/page.tsx",
      rootDirectory: "apps/www",
      tsconfig,
    });

  it("resolves a tsconfig alias and a relative import", () => {
    expect(candidates("@/lib/site")).toEqual([
      "apps/www/lib/site.ts",
      "apps/www/lib/site.tsx",
      "apps/www/lib/site.js",
      "apps/www/lib/site.jsx",
      "apps/www/lib/site/index.ts",
      "apps/www/lib/site/index.tsx",
      "apps/www/lib/site/index.js",
      "apps/www/lib/site/index.jsx",
    ]);
    expect(candidates("../_lib/seo")[0]).toBe(
      "apps/www/app/(site)/_lib/seo.ts",
    );
  });

  it.each([
    [
      "@acme/seo",
      undefined,
      "The import @acme/seo is not a relative path or a tsconfig.json path alias.",
    ],
    [
      "@/lib/site",
      '{ "compilerOptions": {} // comment\n}',
      "Relay could not read tsconfig.json as plain JSON.",
    ],
    [
      "../../../../../../x",
      undefined,
      "The metadata helper import points outside the repository.",
    ],
  ])("refuses an unresolvable import: %s", (specifier, tsconfig, message) => {
    expect(() => candidates(specifier, tsconfig)).toThrowError(
      expect.objectContaining({ code: "VALIDATION_ERROR", message }),
    );
  });
});
