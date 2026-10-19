import { z } from "zod";
import { AppError } from "@/server/lib/errors";
export type GithubRequest = <T>(
  route: string,
  schema: z.ZodType<T>,
  options?: { method: "POST" | "PUT" | "DELETE"; body: unknown },
) => Promise<T>;
/** RFC-0014: the first `maxBytes` of a raw response. */
export type GithubBytesRequest = (
  route: string,
  maxBytes: number,
) => Promise<Uint8Array>;
export const githubShaSchema = z.string().regex(/^[a-f0-9]{40}$/);

export function validateGithubPath(path: string): string[] {
  const parts = path.split("/");
  if (
    parts.length > 10 ||
    !parts.every((part) =>
      /^(?:[A-Za-z0-9_-][A-Za-z0-9._-]*|\([a-z0-9-]+\))$/.test(part),
    )
  )
    throw new AppError("VALIDATION_ERROR", "GitHub path is not supported.");
  return parts;
}
export function validateGithubBranch(branch: string): string {
  if (
    branch.length > 200 ||
    !/^[A-Za-z0-9_-][A-Za-z0-9._/-]*$/.test(branch) ||
    branch.includes("..") ||
    branch
      .split("/")
      .some(
        (part) =>
          !part ||
          part.startsWith(".") ||
          part.endsWith(".") ||
          part.endsWith(".lock"),
      )
  )
    throw new AppError("VALIDATION_ERROR", "GitHub branch is not supported.");
  return branch.split("/").map(encodeURIComponent).join("/");
}
export function validateGithubSha(sha: string): string {
  if (!githubShaSchema.safeParse(sha).success)
    throw new AppError("VALIDATION_ERROR", "GitHub commit is invalid.");
  return sha;
}

export function createGithubReader(
  request: GithubRequest,
  requestBytes?: GithubBytesRequest,
) {
  const commitSchema = z.object({
    sha: githubShaSchema,
    tree: z.object({ sha: githubShaSchema }),
    parents: z.array(z.object({ sha: githubShaSchema })),
  });
  const treeSchema = z.object({
    sha: githubShaSchema,
    truncated: z.boolean(),
    tree: z.array(
      z.object({
        path: z.string(),
        mode: z.string(),
        type: z.string(),
        sha: githubShaSchema,
      }),
    ),
  });
  const refSchema = z.object({
    ref: z.string(),
    object: z.object({ type: z.literal("commit"), sha: githubShaSchema }),
  });

  const trees = new Map<string, z.infer<typeof treeSchema>>();
  const commits = new Map<
    string,
    { sha: string; treeSha: string; parents: string[] }
  >();
  async function getCommit(sha: string) {
    validateGithubSha(sha);
    const cached = commits.get(sha);
    if (cached) return { ...cached, parents: [...cached.parents] };
    const value = await request(`/git/commits/${sha}`, commitSchema);
    if (value.sha !== sha)
      throw new AppError(
        "UPSTREAM_UNAVAILABLE",
        "GitHub commit identity did not match.",
      );
    const result = {
      sha: value.sha,
      treeSha: value.tree.sha,
      parents: value.parents.map((parent) => parent.sha),
    };
    commits.set(sha, result);
    return { ...result, parents: [...result.parents] };
  }
  async function readTree(treeSha: string) {
    let tree = trees.get(treeSha);
    if (!tree) {
      tree = await request(`/git/trees/${treeSha}`, treeSchema);
      if (tree.sha !== treeSha || tree.truncated)
        throw new AppError(
          "UPSTREAM_UNAVAILABLE",
          "GitHub tree cannot be safely read.",
        );
      trees.set(treeSha, tree);
    }
    return tree;
  }
  /** The regular file at a path of a commit, by walking its trees. */
  async function blobEntry(path: string, commitSha: string) {
    const parts = validateGithubPath(path);
    let treeSha = (await getCommit(commitSha)).treeSha;
    for (let index = 0; index < parts.length; index++) {
      const tree = await readTree(treeSha);
      const entries = tree.tree.filter((entry) => entry.path === parts[index]);
      if (entries.length === 0)
        throw new AppError("NOT_FOUND", "GitHub file was not found.");
      if (entries.length !== 1)
        throw new AppError(
          "UPSTREAM_UNAVAILABLE",
          "GitHub tree cannot be safely read.",
        );
      const entry = entries[0];
      if (index < parts.length - 1) {
        if (entry.mode !== "040000" || entry.type !== "tree")
          throw new AppError(
            "VALIDATION_ERROR",
            "GitHub path must contain only regular directories.",
          );
        treeSha = entry.sha;
        continue;
      }
      if (entry.mode !== "100644" || entry.type !== "blob")
        throw new AppError(
          "VALIDATION_ERROR",
          "GitHub file must be a regular non-executable file.",
        );
      return entry;
    }
    throw new AppError("VALIDATION_ERROR", "GitHub path is not supported.");
  }
  return {
    getCommit,
    /** The entries of one directory at a commit. "" is the repository root. */
    async listDirectory(path: string, commitSha: string) {
      let tree = await readTree((await getCommit(commitSha)).treeSha);
      for (const part of path ? validateGithubPath(path) : []) {
        const entries = tree.tree.filter((entry) => entry.path === part);
        if (
          entries.length !== 1 ||
          entries[0].mode !== "040000" ||
          entries[0].type !== "tree"
        )
          throw new AppError("NOT_FOUND", "GitHub directory was not found.");
        tree = await readTree(entries[0].sha);
      }
      return tree.tree.map(({ path: name, mode, type }) => ({
        name,
        mode,
        type,
      }));
    },
    async getRef(branch: string) {
      const route = `/git/ref/heads/${validateGithubBranch(branch)}`;
      try {
        const value = await request(route, refSchema);
        if (value.ref !== `refs/heads/${branch}`)
          throw new AppError(
            "UPSTREAM_UNAVAILABLE",
            "GitHub branch identity did not match.",
          );
        return { sha: value.object.sha };
      } catch (error) {
        if (error instanceof AppError && error.code === "NOT_FOUND")
          return null;
        throw error;
      }
    },
    async readFile(path: string, commitSha: string) {
      const entry = await blobEntry(path, commitSha);
      const blob = await request(
        `/git/blobs/${entry.sha}`,
        z.object({
          sha: githubShaSchema,
          encoding: z.literal("base64"),
          content: z.string(),
          size: z
            .number()
            .int()
            .min(0)
            .max(32 * 1024),
        }),
      );
      if (blob.sha !== entry.sha)
        throw new AppError(
          "UPSTREAM_UNAVAILABLE",
          "GitHub blob identity did not match.",
        );
      try {
        const encoded = blob.content.replace(/[\r\n]/g, "");
        if (
          !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
            encoded,
          )
        )
          throw new Error();
        const binary = atob(encoded);
        if (binary.length !== blob.size || binary.length > 32 * 1024)
          throw new Error();
        const source = new TextDecoder("utf-8", { fatal: true }).decode(
          Uint8Array.from(binary, (char) => char.charCodeAt(0)),
        );
        return { source, blobSha: blob.sha };
      } catch {
        throw new AppError(
          "UPSTREAM_UNAVAILABLE",
          "GitHub file encoding or size is invalid.",
        );
      }
    },
    /**
     * RFC-0014 5.5: the first bytes of a file, such as an image header.
     * The raw read stops at `maxBytes`, whatever the file's size.
     */
    async readFileHead(path: string, commitSha: string, maxBytes: number) {
      const entry = await blobEntry(path, commitSha);
      if (!requestBytes)
        throw new AppError("UPSTREAM_UNAVAILABLE", "GitHub raw reads are off.");
      return requestBytes(`/git/blobs/${entry.sha}`, maxBytes);
    },
    /** RFC-0012: every file path under a directory, from one recursive tree read. */
    async listFiles(path: string, commitSha: string) {
      let treeSha = (await getCommit(commitSha)).treeSha;
      for (const part of path ? validateGithubPath(path) : []) {
        const entry = (await readTree(treeSha)).tree.find(
          (item) => item.path === part && item.type === "tree",
        );
        if (!entry) return { paths: [], truncated: false };
        treeSha = entry.sha;
      }
      const tree = await request(
        `/git/trees/${treeSha}?recursive=1`,
        treeSchema,
      );
      return {
        paths: tree.tree
          .filter((item) => item.type === "blob")
          .map((item) => (path ? `${path}/${item.path}` : item.path)),
        truncated: tree.truncated,
      };
    },
    /** RFC-0012 5.4: one commit on the base that modifies exactly these files. */
    async verifyCommitFiles({
      baseSha,
      headSha,
      files,
    }: {
      baseSha: string;
      headSha: string;
      files: Array<{ path: string; blobSha: string }>;
    }) {
      for (const file of files) {
        validateGithubPath(file.path);
        validateGithubSha(file.blobSha);
      }
      const value = await request(
        `/compare/${validateGithubSha(baseSha)}...${validateGithubSha(headSha)}?per_page=2`,
        z.object({
          status: z.string(),
          ahead_by: z.number().int(),
          behind_by: z.number().int(),
          total_commits: z.number().int(),
          merge_base_commit: z.object({ sha: githubShaSchema }),
          commits: z.array(z.object({ sha: githubShaSchema })),
          files: z.array(
            z.object({
              filename: z.string(),
              status: z.string(),
              sha: githubShaSchema,
              previous_filename: z.string().optional(),
            }),
          ),
        }),
      );
      const expected = new Map(files.map((file) => [file.path, file.blobSha]));
      return (
        value.status === "ahead" &&
        value.ahead_by === 1 &&
        value.behind_by === 0 &&
        value.total_commits === 1 &&
        value.merge_base_commit.sha === baseSha &&
        value.commits.length === 1 &&
        value.commits[0].sha === headSha &&
        value.files.length === expected.size &&
        value.files.every(
          (file) =>
            file.status === "modified" &&
            file.previous_filename === undefined &&
            expected.get(file.filename) === file.sha,
        )
      );
    },
    async verifySingleFileCommit({
      baseSha,
      headSha,
      path,
      blobSha,
    }: {
      baseSha: string;
      headSha: string;
      path: string;
      blobSha: string;
    }) {
      validateGithubPath(path);
      validateGithubSha(blobSha);
      const value = await request(
        `/compare/${validateGithubSha(baseSha)}...${validateGithubSha(headSha)}?per_page=2`,
        z.object({
          status: z.string(),
          ahead_by: z.number().int(),
          behind_by: z.number().int(),
          total_commits: z.number().int(),
          base_commit: z.object({ sha: githubShaSchema }),
          merge_base_commit: z.object({ sha: githubShaSchema }),
          commits: z.array(z.object({ sha: githubShaSchema })),
          files: z.array(
            z.object({
              filename: z.string(),
              status: z.string(),
              sha: githubShaSchema,
              previous_filename: z.string().optional(),
            }),
          ),
        }),
      );
      return (
        value.status === "ahead" &&
        value.ahead_by === 1 &&
        value.behind_by === 0 &&
        value.total_commits === 1 &&
        value.base_commit.sha === baseSha &&
        value.merge_base_commit.sha === baseSha &&
        value.commits.length === 1 &&
        value.commits[0].sha === headSha &&
        value.files.length === 1 &&
        value.files[0].filename === path &&
        value.files[0].status === "modified" &&
        value.files[0].sha === blobSha &&
        value.files[0].previous_filename === undefined
      );
    },
  };
}
