import { sortBy } from "remeda";
import { z } from "zod";
import type { PublishingConnectionRecord } from "@/types/schemas/publishing";
import type { GithubClient } from "@/server/features/publishing/githubClient";
import { routePatterns } from "@/server/features/seo-checks/urlSelection";
import { AppError } from "@/server/lib/errors";

// RFC-0011 5.2 step 3: every page of a test maps to one route file, a
// dynamic segment such as app/integrations/[slug]/page.tsx. One recursive
// tree read covers the repository.
const PAGE_FILE =
  /^(?:src\/)?(?:app\/(?:.*\/)?page|pages\/(?!api\/|_).+)\.(?:tsx|ts|jsx|js|mdx)$/;
const treeSchema = z.object({
  truncated: z.boolean(),
  tree: z.array(z.object({ path: z.string(), type: z.string() })),
});

/** The route file of each path; the most static match wins. */
export async function routeFiles(
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
  const files = tree.tree
    .filter((entry) => entry.type === "blob" && entry.path.startsWith(root))
    .map((entry) => entry.path.slice(root.length))
    .filter((path) => PAGE_FILE.test(path));
  const routes = routePatterns(files).map(([pattern, file]) => ({
    file: `${root}${file}`,
    regex: new RegExp(
      `^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", "[^/]+")}$`,
    ),
    statics: pattern.split("/").filter((part) => part && part !== "*").length,
  }));
  return new Map(
    paths.map((path) => {
      const [match] = sortBy(
        routes.filter((route) => route.regex.test(path)),
        [(route) => route.statics, "desc"],
      );
      return [path, match?.file ?? null];
    }),
  );
}
