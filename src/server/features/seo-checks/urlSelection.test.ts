import { expect, it } from "vitest";
import { selectUrls } from "./urlSelection";

const sitemap = [
  "https://example.com/",
  "https://example.com/pricing",
  ...Array.from(
    { length: 8 },
    (_, index) => `https://example.com/blog/post-${index}`,
  ),
  ...Array.from(
    { length: 150 },
    (_, index) => `https://example.com/docs/page-${index}`,
  ),
];
const input = {
  changedFiles: [] as string[],
  keyPages: [] as Array<{ url: string; role: string }>,
  topPages: [] as Array<{ url: string; clicks: number }>,
  sitemapUrls: sitemap,
  headSha: "a".repeat(40),
};

it("maps changed route files to paths, with up to 5 sitemap matches per dynamic segment", async () => {
  const selected = await selectUrls({
    ...input,
    sitemapUrls: [],
    changedFiles: [
      "app/(site)/pricing/page.tsx",
      "src/app/@modal/about/layout.tsx",
      "pages/index.tsx",
      "pages/api/hello.ts",
      "pages/_app.tsx",
      "app/components/Button.tsx",
      "README.md",
    ],
  });
  expect(selected).toEqual([
    {
      path: "/pricing",
      reason: "changed_file",
      file: "app/(site)/pricing/page.tsx",
    },
    {
      path: "/about",
      reason: "changed_file",
      file: "src/app/@modal/about/layout.tsx",
    },
    { path: "/", reason: "changed_file", file: "pages/index.tsx" },
  ]);
  const dynamic = await selectUrls({
    ...input,
    changedFiles: ["app/blog/[slug]/page.tsx"],
  });
  expect(
    dynamic
      .filter((url) => url.reason === "changed_file")
      .map((url) => url.path),
  ).toEqual([
    "/blog/post-0",
    "/blog/post-1",
    "/blog/post-2",
    "/blog/post-3",
    "/blog/post-4",
  ]);
});

it("adds key pages money first, the top 30 traffic pages, and a stable sample, up to 100", async () => {
  const selected = await selectUrls({
    ...input,
    keyPages: [
      { url: "https://example.com/about", role: "support" },
      { url: "https://example.com/pricing", role: "money" },
    ],
    topPages: Array.from({ length: 120 }, (_, index) => ({
      url: `https://example.com/docs/page-${index}`,
      clicks: index,
    })),
  });
  expect(selected.slice(0, 2)).toEqual([
    { path: "/pricing", reason: "key_page" },
    { path: "/about", reason: "key_page" },
  ]);
  const top = selected.filter((url) => url.reason === "top_traffic");
  expect(top).toHaveLength(30);
  expect(top[0]?.path).toBe("/docs/page-119");
  const sample = selected.filter((url) => url.reason === "sitemap_sample");
  expect(sample).toHaveLength(10);
  expect(await selectUrls({ ...input, keyPages: [], topPages: [] })).toEqual(
    await selectUrls({ ...input, keyPages: [], topPages: [] }),
  );
  const crowded = await selectUrls({
    ...input,
    keyPages: sitemap.map((url) => ({ url, role: "support" })),
  });
  expect(crowded).toHaveLength(100);
});
