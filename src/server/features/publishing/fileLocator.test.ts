import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { GithubRequest } from "./githubRead";
import { locateMetadataFile } from "./fileLocator";

const COMMIT = "c".repeat(40);
const sha = (path: string) => createHash("sha1").update(path).digest("hex");

/** A GitHub API stand-in that serves trees for the given file paths. */
function repository(files: string[]) {
  const directories = new Map<string, Map<string, "tree" | "blob">>([
    ["", new Map()],
  ]);
  for (const file of files) {
    const parts = file.split("/");
    parts.forEach((part, index) => {
      const parent = parts.slice(0, index).join("/");
      const path = parts.slice(0, index + 1).join("/");
      const isFile = index === parts.length - 1;
      directories.get(parent)!.set(part, isFile ? "blob" : "tree");
      if (!isFile && !directories.has(path)) directories.set(path, new Map());
    });
  }
  const byTreeSha = new Map(
    [...directories.keys()].map((path) => [sha(`tree:${path}`), path]),
  );
  const routes: string[] = [];
  const request: GithubRequest = async (route, schema) => {
    routes.push(route);
    let value: unknown;
    if (route.startsWith("/git/ref/heads/"))
      value = {
        ref: "refs/heads/main",
        object: { type: "commit", sha: COMMIT },
      };
    else if (route === `/git/commits/${COMMIT}`)
      value = { sha: COMMIT, tree: { sha: sha("tree:") }, parents: [] };
    else {
      const treeSha = route.replace("/git/trees/", "");
      const path = byTreeSha.get(treeSha)!;
      value = {
        sha: treeSha,
        truncated: false,
        tree: [...directories.get(path)!].map(([name, type]) => {
          const child = path ? `${path}/${name}` : name;
          return {
            path: name,
            type,
            mode: type === "tree" ? "040000" : "100644",
            sha: type === "tree" ? sha(`tree:${child}`) : sha(child),
          };
        }),
      };
    }
    return schema.parse(value);
  };
  return { request, routes };
}

const locate = (files: string[], url: string, rootDirectory = "") => {
  const repo = repository(files);
  return locateMetadataFile(
    repo.request,
    { rootDirectory, baseBranch: "main" },
    url,
  ).then((result) => ({ result, requests: repo.routes.length }));
};

describe("locateMetadataFile", () => {
  it.each([
    [
      "/",
      ["app/page.tsx", "app/about/page.tsx"],
      "https://a.com/",
      "app/page.tsx",
    ],
    [
      "a nested path",
      ["app/page.tsx", "app/docs/setup/page.ts"],
      "https://a.com/docs/setup",
      "app/docs/setup/page.ts",
    ],
    [
      "src/app",
      ["src/app/pricing/page.jsx", "src/lib/x.ts"],
      "https://a.com/pricing/",
      "src/app/pricing/page.jsx",
    ],
    [
      "a route group",
      ["app/(site)/approach/page.tsx", "app/(site)/page.tsx"],
      "https://a.com/approach",
      "app/(site)/approach/page.tsx",
    ],
  ])("finds the page file for %s", async (_name, files, url, filePath) => {
    expect((await locate(files, url)).result).toEqual({
      status: "found",
      filePath,
    });
  });

  it("finds the S1 page inside the root directory within the request budget", async () => {
    const { result, requests } = await locate(
      [
        "apps/www/package.json",
        "apps/www/app/(site)/approach/page.tsx",
        "apps/www/app/(site)/company/page.tsx",
        "apps/www/app/(marketing)/pricing/page.tsx",
        "apps/admin/app/page.tsx",
      ],
      "https://playbookmedia.io/approach",
      "apps/www",
    );
    expect(result).toEqual({
      status: "found",
      filePath: "apps/www/app/(site)/approach/page.tsx",
    });
    expect(requests).toBeLessThanOrEqual(12);
  });

  it("reports two groups with the same path as ambiguous", async () => {
    expect(
      (
        await locate(
          ["app/(a)/blog/page.tsx", "app/(b)/blog/page.tsx"],
          "https://a.com/blog",
        )
      ).result,
    ).toMatchObject({ status: "ambiguous" });
  });

  it("reports no match, and both app directories, without guessing", async () => {
    expect(
      (await locate(["app/page.tsx"], "https://a.com/missing")).result,
    ).toMatchObject({ status: "not_found" });
    expect(
      (await locate(["app/page.tsx", "src/app/page.tsx"], "https://a.com/"))
        .result,
    ).toMatchObject({ status: "ambiguous" });
  });

  it("names the dynamic segment that it does not support", async () => {
    const { result } = await locate(
      ["app/(site)/blog/[slug]/page.tsx", "app/(site)/blog/page.tsx"],
      "https://a.com/blog/first-post",
    );
    expect(result.status).toBe("unsupported");
    expect("message" in result && result.message).toContain(
      "dynamic segment [slug]",
    );
  });

  it("stops at 12 GitHub requests", async () => {
    // The ref, the commit and 11 nested trees: the 13th request is refused.
    const repo = repository(["app/deep/a/b/c/d/e/f/g/h/page.tsx"]);
    await expect(
      locateMetadataFile(
        repo.request,
        { rootDirectory: "", baseBranch: "main" },
        "https://a.com/deep/a/b/c/d/e/f/g/h",
      ),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(repo.routes).toHaveLength(12);
  });
});
