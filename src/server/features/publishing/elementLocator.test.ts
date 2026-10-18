import { expect, it } from "vitest";
import { AppError } from "@/server/lib/errors";
import { imageFileName, locateElement, withAttribute } from "./elementLocator";

// RFC-0013 5.4: the one element an accessibility fix changes.
const PAGE = "app/about/page.tsx";
const site = (files: Record<string, string>) => ({
  readFile: async (path: string) => {
    const source = files[path];
    if (source === undefined) throw new AppError("NOT_FOUND");
    return { source, blobSha: `blob-${path}` };
  },
});
const find = (files: Record<string, string>, src: string) =>
  locateElement({
    reader: site(files),
    rootDirectory: "",
    pageFile: PAGE,
    sha: "a".repeat(40),
    target: { kind: "image", src },
  });

it("matches a literal src, an imported image and Next.js image URLs", async () => {
  const literal = await find(
    { [PAGE]: 'export default () => <img src="/team.png" className="a" />;' },
    "https://example.com/team.png",
  );
  expect(literal.found).toHaveLength(1);
  const imported = await find(
    {
      [PAGE]:
        'import Image from "next/image";\nimport hero from "../hero.png";\nexport default () => <Image src={hero} />;',
    },
    "/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fhero.3f2a1b9c.png&w=1080&q=75",
  );
  expect(imported.found.map((item) => item.line)).toEqual([3]);
  expect(imageFileName("/_next/static/media/hero.3f2a1b9c.png")).toBe(
    "hero.png",
  );
});

it("returns every match, so a caller can refuse more than one", async () => {
  const twice = await find(
    {
      [PAGE]:
        'export default () => (<><img src="/a.png" /><img src="/a.png" /></>);',
    },
    "/a.png",
  );
  expect(twice.found).toHaveLength(2);
});

it("adds the attribute last, and refuses one that a later spread overrides", () => {
  const file = (source: string) => ({ path: PAGE, source, blobSha: "x" });
  const tag = '<img {...props} src="/a.png" />';
  expect(
    withAttribute(file(tag), { start: 0, end: tag.length }, "alt", ""),
  ).toBe('<img {...props} src="/a.png" alt="" />');
  const html = '<html lang="en-us">';
  expect(
    withAttribute(file(html), { start: 0, end: html.length }, "lang", "fr"),
  ).toBe('<html lang="fr">');
  const spread = '<img alt="x" {...props} />';
  expect(() =>
    withAttribute(file(spread), { start: 0, end: spread.length }, "alt", "y"),
  ).toThrow("spread");
});
