import { sortBy } from "remeda";
import { z } from "zod";
import type { PublishingConnectionRecord } from "@/types/schemas/publishing";
import type { GithubClient } from "@/server/features/publishing/githubClient";
import { metadataHelperCandidates } from "@/server/features/publishing/metadataHelper";
import { metadataHelperImport } from "@/server/features/publishing/nextMetadata";
import { routePatterns } from "@/server/features/seo-checks/urlSelection";
import { AppError } from "@/server/lib/errors";

// RFC-0011 5.2 step 3: every page of a test maps to one route file, a
// dynamic segment such as app/integrations/[slug]/page.tsx. One recursive
// tree read covers the repository.
const PAGE_FILE =
  /^(?:src\/)?(?:app\/(?:.*\/)?page|pages\/(?!api\/|_).+)\.(?:tsx|ts|jsx|js|mdx)$/;
const treeSchema = z.object({
  truncated: z.boolean(),
  tree: z.array(
    z.object({ path: z.string(), type: z.string(), sha: z.string() }),
  ),
});
const blobSchema = z.object({
  content: z.string(),
  encoding: z.literal("base64"),
});
// The template check's client allows 210 requests (SplitTestService); the
// tree read uses 3 and tsconfig.json 1, so one test reads at most 200 files.
const MAX_HELPER_FILES = 200;

/** The route file of each path; the most static match wins. */
async function routeFiles(
  client: GithubClient,
  connection: Pick<PublishingConnectionRecord, "baseBranch" | "rootDirectory">,
  paths: string[],
) {
  const ref = await client.getRef(connection.baseBranch);
  if (!ref) throw new AppError("NOT_FOUND", "The base branch was not found.");
  const commit = await client.getCommit(ref.sha);
  const tree = await client.request(
    `/git/trees/${commit.treeSha}?recursive=1`,
    treeSchema,
  );
  if (tree.truncated)
    throw new AppError(
      "VALIDATION_ERROR",
      "The repository is too large to read in one request.",
    );
  const root = connection.rootDirectory
    ? `${connection.rootDirectory.replace(/\/+$/, "")}/`
    : "";
  const pageFiles = tree.tree
    .filter((entry) => entry.type === "blob" && entry.path.startsWith(root))
    .map((entry) => entry.path.slice(root.length))
    .filter((path) => PAGE_FILE.test(path));
  const routes = routePatterns(pageFiles).map(([pattern, file]) => ({
    file: `${root}${file}`,
    regex: new RegExp(
      `^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", "[^/]+")}$`,
    ),
    statics: pattern.split("/").filter((part) => part && part !== "*").length,
  }));
  const files = new Map(
    paths.map((path) => {
      const [match] = sortBy(
        routes.filter((route) => route.regex.test(path)),
        [(route) => route.statics, "desc"],
      );
      return [path, match?.file ?? null];
    }),
  );
  const blobs = new Map(
    tree.tree
      .filter((entry) => entry.type === "blob")
      .map((entry) => [entry.path, entry.sha]),
  );
  return { files, blobs };
}

async function readBlob(client: GithubClient, sha: string) {
  const blob = await client.request(`/git/blobs/${sha}`, blobSchema);
  const binary = atob(blob.content.replace(/\s/g, ""));
  return new TextDecoder().decode(
    Uint8Array.from(binary, (char) => char.charCodeAt(0)),
  );
}

/**
 * RFC-0005 phase 1a pages: separate static files that all set metadata
 * through one helper, such as pageMetadata(title, description, path). The
 * helper is then the test's template. Null when they do not share one.
 */
async function sharedHelper(
  client: GithubClient,
  blobs: Map<string, string>,
  rootDirectory: string,
  pageFiles: string[],
) {
  if (pageFiles.length > MAX_HELPER_FILES) return null;
  const root = rootDirectory.replace(/\/+$/, "");
  const tsconfigSha = blobs.get(
    [root, "tsconfig.json"].filter(Boolean).join("/"),
  );
  const tsconfig = tsconfigSha
    ? await readBlob(client, tsconfigSha)
    : undefined;
  const found = new Set<string>();
  for (const file of pageFiles) {
    const sha = blobs.get(file);
    if (!sha) return null;
    try {
      const helper = metadataHelperImport(await readBlob(client, sha), file);
      if (!helper) return null;
      const path = metadataHelperCandidates({
        specifier: helper.specifier,
        pagePath: file,
        rootDirectory: root,
        tsconfig,
      }).find((candidate) => blobs.has(candidate));
      if (!path) return null;
      found.add(`${path}#${helper.name}`);
    } catch {
      return null;
    }
  }
  const [only] = found;
  if (found.size !== 1 || !only) return null;
  const [path = "", name = ""] = only.split("#");
  return { path, name };
}

const NONE = "no route file";

/**
 * The test's template: the one route file of all pages, or the metadata
 * helper that their separate files share; otherwise the reason to refuse.
 */
export async function testTemplate(
  client: GithubClient,
  connection: Pick<PublishingConnectionRecord, "baseBranch" | "rootDirectory">,
  paths: string[],
): Promise<{ path: string; helper: string | null } | { problem: string }> {
  const { files, blobs } = await routeFiles(client, connection, paths);
  const counts = new Map<string, number>();
  for (const file of files.values())
    counts.set(file ?? NONE, (counts.get(file ?? NONE) ?? 0) + 1);
  const [first] = counts.keys();
  if (counts.size === 1 && first && first !== NONE)
    return { path: first, helper: null };
  const helper = counts.has(NONE)
    ? null
    : await sharedHelper(client, blobs, connection.rootDirectory, [
        ...counts.keys(),
      ]);
  if (helper) return { path: helper.path, helper: helper.name };
  return {
    problem: `The pages use ${counts.size} templates: ${[...counts]
      .slice(0, 5)
      .map(([file, count]) => `${file} (${count} pages)`)
      .join(
        ", ",
      )}. A test needs pages that share one route file or one metadata helper.`,
  };
}
