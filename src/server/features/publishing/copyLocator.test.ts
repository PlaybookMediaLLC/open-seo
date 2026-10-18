import { expect, it, vi } from "vitest";
import { AppError } from "@/server/lib/errors";
import { locateCopy, pagesSharing } from "./copyLocator";

// RFC-0012 5.4. The content module has the shape of S1's lib/content.ts,
// trimmed: S1's repository is private and this one is public.
const CONTENT = `import { z } from 'zod';
import { site } from './site';

const hero = z.strictObject({ title: z.string(), introduction: z.string() });
export const approach = z.strictObject({ hero }).parse({
  hero: {
    title: 'Patient ownership. _Practical_ improvement.',
    introduction:
      'Understand the business. Protect what customers value. Improve the product with evidence.',
  },
  steps: [{ title: 'Understand' }, { title: 'Improve' }],
});
export const company = { hero: { title: 'Understand' } };
`;
const PAGE = `import { approach } from '@/lib/content';
import { ArrowLink } from '../_components/ui';
export default function Page() {
  return (
    <>
      <h1>{approach.hero.title}</h1>
      <ArrowLink href="/acquisitions">Read chapter III</ArrowLink>
    </>
  );
}
`;
const PAGE_FILE = "apps/www/app/(site)/approach/page.tsx";
const site = (files: Record<string, string>) => {
  const all = new Map(Object.entries(files));
  return {
    readFile: vi.fn(async (path: string) => {
      const source = all.get(path);
      if (source === undefined) throw new AppError("NOT_FOUND");
      return { source, blobSha: `blob-${path}` };
    }),
    listFiles: async (path: string) => ({
      paths: [...all.keys()].filter((file) => file.startsWith(`${path}/`)),
      truncated: false,
    }),
  };
};
const s1 = (extra: Record<string, string> = {}) =>
  site({
    [PAGE_FILE]: PAGE,
    "apps/www/lib/content.ts": CONTENT,
    "apps/www/lib/site.ts": "export const site = { name: 'Playbook Media' };",
    "apps/www/app/(site)/_components/ui.tsx":
      "export const ArrowLink = (props: object) => <a {...props} />;",
    ...extra,
  });
const locate = (reader: ReturnType<typeof site>, text: string) =>
  locateCopy({
    reader,
    rootDirectory: "apps/www",
    pageFile: PAGE_FILE,
    sha: "a".repeat(40),
    text,
  });

it("finds the hero introduction in lib/content.ts through the @/ import", async () => {
  const result = await locate(
    s1(),
    "Understand the business. Protect what customers value. Improve the product with evidence.",
  );
  expect(result).toMatchObject({
    status: "found",
    file: { path: "apps/www/lib/content.ts" },
    node: { kind: "string_literal", line: 9, exportName: "approach" },
  });
});

it("finds JSX text, and refuses text that is split or carries markup", async () => {
  expect(await locate(s1(), "Read chapter III")).toMatchObject({
    status: "found",
    file: { path: PAGE_FILE },
    node: { kind: "jsx_text" },
  });
  expect(
    (await locate(s1(), "Patient ownership. Practical improvement.")).status,
  ).toBe("not_found");
});

it("stops with every match when the text appears more than once", async () => {
  const result = await locate(s1(), "Understand");
  expect(result).toMatchObject({
    status: "ambiguous",
    matches: [
      { path: "apps/www/lib/content.ts", line: 11 },
      { path: "apps/www/lib/content.ts", line: 13 },
    ],
  });
});

it("reads at most 20 files", async () => {
  const modules = Object.fromEntries(
    Array.from({ length: 25 }, (_, index) => [
      `apps/www/lib/part${index}.ts`,
      `export const part${index} = 'Part ${index}';`,
    ]),
  );
  const page = Object.keys(modules)
    .map((_, index) => `import { part${index} } from '@/lib/part${index}';`)
    .join("\n");
  const result = await locate(
    site({ [PAGE_FILE]: page, ...modules }),
    "Part 24",
  );
  expect(result.filesRead).toHaveLength(20);
  expect(result.status).toBe("not_found");
});

it("lists the other pages that import the export that holds the text", async () => {
  const reader = s1({
    "apps/www/app/(site)/platform/page.tsx":
      "import { approach } from '@/lib/content';",
    "apps/www/app/(site)/company/page.tsx":
      "import { company } from '@/lib/content';",
  });
  expect(
    await pagesSharing({
      reader,
      rootDirectory: "apps/www",
      sha: "a".repeat(40),
      pageFile: PAGE_FILE,
      modulePath: "apps/www/lib/content.ts",
      exportName: "approach",
    }),
  ).toEqual({
    pages: ["apps/www/app/(site)/platform/page.tsx"],
    complete: true,
  });
});
