import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/server/lib/errors";
import { layoutTitleTemplate, readTitleTemplate } from "./layoutTitle";

// The root layout of test site S1: computed fields next to a literal template.
const s1Layout = `import { site } from '@/lib/site';
export const metadata: Metadata = {
  metadataBase: new URL(site.origin),
  title: { default: 'Playbook Media', template: '%s | Playbook Media' },
  robots: { index: site.indexable === 'true' },
};`;

describe("layoutTitleTemplate", () => {
  it("reads a literal template next to computed fields", () => {
    expect(layoutTitleTemplate(s1Layout, "app/layout.tsx")).toBe(
      "%s | Playbook Media",
    );
  });

  it.each([
    "export default function Layout() {}",
    "export const metadata = { title: 'Site' };",
  ])("returns null when the layout sets no template: %s", (source) => {
    expect(layoutTitleTemplate(source, "app/layout.tsx")).toBeNull();
  });

  it.each([
    "export async function generateMetadata() { return {}; }",
    "export const metadata = buildMetadata();",
  ])("refuses a layout it cannot read: %s", (source) => {
    expect(() => layoutTitleTemplate(source, "app/layout.tsx")).toThrowError(
      AppError,
    );
  });
});

describe("readTitleTemplate", () => {
  const client = (files: Record<string, string>) => ({
    readFile: vi.fn(async (path: string) => {
      if (!(path in files)) throw new AppError("NOT_FOUND");
      return { source: files[path], blobSha: "a".repeat(40) };
    }),
  });

  it("uses the nearest layout that sets a template", async () => {
    const files = {
      "apps/www/app/layout.tsx": s1Layout,
      "apps/www/app/(site)/layout.tsx":
        "export const metadata = { title: { template: '%s · Section' } };",
      "apps/www/app/(site)/approach/layout.tsx":
        "export default function Layout() {}",
    };
    await expect(
      readTitleTemplate(
        client(files),
        "a".repeat(40),
        "apps/www/app/(site)/approach/page.tsx",
        "apps/www",
      ),
    ).resolves.toBe("%s · Section");
  });

  it("refuses a page wrapped by more than 3 layouts without a template", async () => {
    const empty = "export default function Layout() {}";
    const files = {
      "app/layout.tsx": empty,
      "app/a/layout.tsx": empty,
      "app/a/b/layout.tsx": empty,
      "app/a/b/c/layout.tsx": empty,
    };
    await expect(
      readTitleTemplate(
        client(files),
        "a".repeat(40),
        "app/a/b/c/page.tsx",
        "",
      ),
    ).rejects.toMatchObject({
      message:
        "More than 3 layouts wrap this page. Relay cannot verify the final title.",
    });
  });
});
