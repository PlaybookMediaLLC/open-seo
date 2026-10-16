import { describe, expect, it } from "vitest";
import { AppError } from "@/server/lib/errors";
import {
  prepareMetadataDescription,
  validateMetadataTarget,
} from "./nextMetadata";

const source = "export const metadata = { description: 'Old description' };";
const target = { path: "app/about/page.tsx", url: "https://example.com/about" };
const prepare = (
  overrides: Partial<Parameters<typeof prepareMetadataDescription>[0]> = {},
) =>
  prepareMetadataDescription({
    ...target,
    source,
    newDescription: "New description",
    ...overrides,
  });

function rejects(overrides: Parameters<typeof prepare>[0], message: string) {
  expect(() => prepare(overrides)).toThrowError(
    expect.objectContaining({
      name: "AppError",
      code: "VALIDATION_ERROR",
      message,
    }),
  );
}

describe("prepareMetadataDescription", () => {
  it("rejects unchanged descriptions including whitespace-trimmed matches", () => {
    for (const newDescription of ["Old description", "  Old description  "]) {
      rejects(
        { newDescription },
        "The new description must differ from the existing description.",
      );
    }
  });
  it.each(["js", "jsx", "tsx"])(
    "supports JSX in page.%s without executing it",
    (extension) => {
      const component =
        " export default function Page() { throw new Error('must not run'); return <main />; }";
      expect(
        prepare({
          path: `app/about/page.${extension}`,
          source: source + component,
        }).afterSource,
      ).toBe(
        "export const metadata = { description: 'New description' };" +
          component,
      );
    },
  );
  it("changes only the literal in typed TSX with satisfies and preserves CRLF, comments and sibling fields", () => {
    const prefix =
      'import type { Metadata } from "next";\r\n// Keep this\r\nexport const metadata: Metadata = ({ title: "About", description: ';
    const suffix =
      ', openGraph: { description: "Social copy" } } as const) satisfies Metadata;\r\nexport default function Page() { return <main>About</main>; }\r\n';
    const result = prepare({
      source: prefix + "'Old description'" + suffix,
      newDescription: "  Human supplied copy  ",
    });
    expect(result.afterSource).toBe(prefix + "'Human supplied copy'" + suffix);
    expect(result).toMatchObject({
      beforeDescription: "Old description",
      afterDescription: "Human supplied copy",
      beforeSnippet: 'Line 3: "Old description"',
      afterSnippet: "Line 3: 'Human supplied copy'",
    });
  });

  it("escapes quotes and backslashes without changing Unicode or interpreting source-like text", () => {
    const newDescription = 'It\'s "café" 😀 \\ ${notCode} </script>';
    const result = prepare({ newDescription });
    expect(result.afterDescription).toBe(newDescription);
    expect(result.afterSource).toBe(
      "export const metadata = { description: 'It\\'s \"café\" 😀 \\\\ ${notCode} </script>' };",
    );
    expect(prepare({ source: result.afterSource }).beforeDescription).toBe(
      newDescription,
    );
  });

  it("keeps the quote style unless the other quote needs fewer escapes, like Prettier", () => {
    expect(prepare({ newDescription: "Don't wait" }).afterSource).toBe(
      'export const metadata = { description: "Don\'t wait" };',
    );
    expect(
      prepare({
        source: 'export const metadata = { description: "Old" };',
        newDescription: 'Say "hi"',
      }).afterSource,
    ).toBe("export const metadata = { description: 'Say \"hi\"' };");
  });

  it("renders old escaped controls as safe literal evidence, not terminal controls", () => {
    const result = prepare({
      source:
        'export const metadata = { description: "old\\n\\u001b\\u202e" };',
    });
    expect(result.beforeSnippet).toBe('Line 1: "old\\n\\u001b\\u202e"');
  });

  it.each([
    [
      '"use client"; ' + source,
      "Client components cannot be edited as static metadata pages.",
    ],
    [
      source + " export function generateMetadata() {}",
      "Dynamic or indirect metadata exports are not supported.",
    ],
    [
      "const metadata = { description: 'Old' };",
      "Expected exactly one direct export const metadata declaration.",
    ],
    [
      "export let metadata = { description: 'Old' };",
      "Expected exactly one direct export const metadata declaration.",
    ],
    [
      source + " export * from './other';",
      "Dynamic or indirect metadata exports are not supported.",
    ],
    [
      "export const metadata = { description: 'Old', get title() { this.description = 'Changed'; return 'Title'; } };",
      "Metadata methods and custom prototypes are not supported.",
    ],
    [
      "export const metadata = { description: 'Old', __proto__: inherited };",
      "Metadata methods and custom prototypes are not supported.",
    ],
    [
      "export const metadata = getMetadata();",
      "The metadata helper must be a named import.",
    ],
    [
      "export const metadata = { ...base, description: 'Old' };",
      "Metadata spreads and computed keys are not supported.",
    ],
    [
      "export const metadata = { description: 'Old', ['title']: 'Title' };",
      "Metadata spreads and computed keys are not supported.",
    ],
    [
      "export const metadata = { description: 'Old', 'description': 'Again' };",
      "Metadata must not contain duplicate description keys.",
    ],
    [
      "export const metadata = { description: `Old` };",
      "Metadata description must be an existing string literal.",
    ],
    [
      "export const metadata = { description: name };",
      "Metadata description must be an existing string literal.",
    ],
    [
      "export const metadata = { get description() { return 'Old' } };",
      "Metadata description must be an existing string literal.",
    ],
    [
      "export const metadata = { title: 'Title' };",
      "Metadata must contain an existing string literal description.",
    ],
    [
      "export const metadata = { description: ",
      "Metadata source could not be parsed safely.",
    ],
    [
      source + " eval(\"metadata.description = 'Other'\")",
      "Sources using eval are not supported.",
    ],
  ])("rejects unsupported metadata syntax: %s", (unsafeSource, message) => {
    rejects({ source: unsafeSource }, message);
  });

  it.each([
    "metadata.description = 'Changed';",
    "Object.assign(metadata, { description: 'Changed' });",
    "const alias = metadata; alias.description = 'Changed';",
    "const { description } = metadata;",
    "export { metadata as other };",
    "function mutate() { metadata['description'] = 'Changed'; }",
    "function shadow(metadata: unknown) { return metadata; }",
    "export const other = { metadata };",
  ])("rejects references or mutations: %s", (extra) => {
    rejects(
      { source: source + extra },
      "Metadata must have one declaration and no other references or mutations.",
    );
  });

  it.each(["", " ", "x".repeat(321)])(
    "rejects out-of-range descriptions",
    (newDescription) => {
      rejects(
        { newDescription },
        "The new description must contain 1 to 320 characters after trimming.",
      );
    },
  );

  it.each(["a\nb", "\ttext", "a\u0000b", "a\u007fb", "a\u202eb", "a\u2028b"])(
    "rejects controls even in trim whitespace",
    (newDescription) => {
      rejects(
        { newDescription },
        "The new description must not contain control characters.",
      );
    },
  );

  it("counts UTF-16 units consistently with the submission schema at the 320-unit boundary", () => {
    expect(prepare({ newDescription: "😀".repeat(160) }).afterDescription).toBe(
      "😀".repeat(160),
    );
  });

  it("enforces the source limit in UTF-8 bytes, including comments", () => {
    rejects(
      { source: source + "/*" + "é".repeat(16_384) + "*/" },
      "Metadata source exceeds the 32 KiB limit.",
    );
    const exact =
      source +
      " ".repeat(32 * 1024 - new TextEncoder().encode(source).byteLength);
    expect(prepare({ source: exact }).beforeDescription).toBe(
      "Old description",
    );
  });
});

describe("validateMetadataTarget", () => {
  it.each([
    { path: "app/page.ts", url: "https://example.com" },
    { path: "src/app/about/page.js", url: "https://example.com/about/" },
    { path: "app/docs/start/page.jsx", url: "https://example.com/docs/start" },
    {
      path: "apps/site/src/app/about/page.tsx",
      url: "https://example.com/about",
      rootDirectory: "apps/site",
    },
    {
      path: "app/(marketing)/about/page.tsx",
      url: "https://example.com/about",
    },
    { path: "app/(site)/page.tsx", url: "https://example.com/" },
  ])("accepts exact static page mapping: $path", (input) => {
    expect(() => validateMetadataTarget(input)).not.toThrow();
  });

  it.each([
    { path: "app/[slug]/page.tsx" },
    { path: "app/@modal/about/page.tsx" },
    { path: "app/(.)about/page.tsx" },
    { path: "app/../about/page.tsx" },
    { path: "/app/about/page.tsx" },
    { path: "app\\about\\page.tsx" },
    { path: "app/_private/page.tsx", url: "https://example.com/_private" },
    { path: "app/about/layout.tsx" },
    { path: "app/about/page.tsx.bak" },
    { path: "app/about//page.tsx" },
    { path: "app/%2e%2e/page.tsx" },
    { rootDirectory: "../site" },
    { rootDirectory: "apps/site" },
    { rootDirectory: "apps/site", path: "apps/site-other/app/about/page.tsx" },
    { url: "https://example.com/other" },
    { url: "https://example.com/About" },
    { url: "https://example.com/about?tracking=1" },
    { url: "https://example.com/about?" },
    { url: "https://example.com/about#anchor" },
    { url: "https://example.com/%61bout" },
    { url: "https://example.com/about%2f" },
    { url: "https://example.com/x/../about" },
    { url: "https://user:secret@example.com/about" },
    { url: "https://example.com/about//" },
    { url: "https://example.com\\about" },
    { url: "/about" },
  ])("rejects unsafe or mismatched mapping: %j", (input) => {
    expect(() => validateMetadataTarget({ ...target, ...input })).toThrow(
      AppError,
    );
  });
});

describe("unsupported route segments", () => {
  it.each([
    [
      "app/[product]/page.tsx",
      "The dynamic route segment [product] is not supported. Relay changes static pages only. Track this page as a ticket instead.",
    ],
    [
      "app/@modal/about/page.tsx",
      "The parallel route @modal is not supported.",
    ],
    [
      "app/(.)about/page.tsx",
      "The intercepting route (.)about is not supported.",
    ],
  ])("names the segment in the refusal: %s", (path, message) => {
    expect(() => validateMetadataTarget({ ...target, path })).toThrowError(
      expect.objectContaining({ code: "VALIDATION_ERROR", message }),
    );
  });
});
