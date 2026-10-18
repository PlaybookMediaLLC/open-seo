import { z } from "zod";
import { AppError } from "@/server/lib/errors";
import {
  githubShaSchema,
  validateGithubBranch,
  validateGithubPath,
  validateGithubSha,
  type GithubRequest,
} from "./githubRead";

export type GithubPullRequest = {
  number: number;
  url: string;
  state: "open" | "closed";
  merged: boolean;
  mergedAt: string | null;
  mergeCommitSha: string | null;
  headSha: string;
  body: string;
  baseRef: string;
  headRef: string;
  repositoryId: string;
};

type Identity = {
  id: string;
  name: string;
  full_name: string;
  owner: { login: string };
};

export function createGithubWriter(
  request: GithubRequest,
  owner: string,
  repository: string,
  identitySchema: z.ZodType<Identity>,
  validateRepository: (value: Identity) => void,
) {
  const side = z.object({
    ref: z.string(),
    sha: githubShaSchema,
    repo: identitySchema,
  });
  const pullSchema = z.object({
    number: z.number().int().positive(),
    html_url: z.string(),
    state: z.enum(["open", "closed"]),
    merged: z.boolean().optional(),
    merged_at: z.string().datetime({ offset: true }).nullable(),
    merge_commit_sha: githubShaSchema.nullish(),
    body: z.string().nullable(),
    head: side,
    base: side,
  });
  function toPull(value: z.infer<typeof pullSchema>): GithubPullRequest {
    validateRepository(value.base.repo);
    validateRepository(value.head.repo);
    if (value.merged === false && value.merged_at !== null)
      throw new AppError(
        "UPSTREAM_UNAVAILABLE",
        "GitHub pull request merge state is inconsistent.",
      );
    const url = URL.parse(value.html_url);
    const path = url?.pathname.split("/");
    if (
      value.head.repo.id !== value.base.repo.id ||
      !url ||
      url.origin !== "https://github.com" ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      !value.html_url.startsWith("https://github.com/") ||
      path?.length !== 5 ||
      path[1].toLowerCase() !== owner.toLowerCase() ||
      path[2].toLowerCase() !== repository.toLowerCase() ||
      path[3] !== "pull" ||
      path[4] !== String(value.number)
    )
      throw new AppError(
        "UPSTREAM_UNAVAILABLE",
        "GitHub pull request identity did not match.",
      );
    validateGithubBranch(value.head.ref);
    validateGithubBranch(value.base.ref);
    return {
      number: value.number,
      url: url.href,
      state: value.state,
      merged: value.merged ?? value.merged_at !== null,
      mergedAt: value.merged_at,
      mergeCommitSha: value.merge_commit_sha ?? null,
      headSha: value.head.sha,
      body: value.body ?? "",
      baseRef: value.base.ref,
      headRef: value.head.ref,
      repositoryId: value.base.repo.id,
    };
  }
  return {
    async createRef(branch: string, baseSha: string) {
      validateGithubBranch(branch);
      validateGithubSha(baseSha);
      const value = await request(
        "/git/refs",
        z.object({
          ref: z.string(),
          object: z.object({ type: z.literal("commit"), sha: githubShaSchema }),
        }),
        { method: "POST", body: { ref: `refs/heads/${branch}`, sha: baseSha } },
      );
      if (value.ref !== `refs/heads/${branch}` || value.object.sha !== baseSha)
        throw new AppError(
          "UPSTREAM_UNAVAILABLE",
          "GitHub branch identity did not match.",
        );
      return { sha: value.object.sha };
    },
    async updateFile({
      branch,
      path,
      source,
      blobSha,
      message,
    }: {
      branch: string;
      path: string;
      source: string;
      /** The current blob; omitted to create a new file. */
      blobSha?: string;
      message: string;
    }) {
      validateGithubBranch(branch);
      const parts = validateGithubPath(path);
      if (blobSha !== undefined) validateGithubSha(blobSha);
      const bytes = new TextEncoder().encode(source);
      if (bytes.length > 32 * 1024 || !message || message.length > 1000)
        throw new AppError(
          "VALIDATION_ERROR",
          "GitHub file update exceeds the size limit.",
        );
      const content = btoa(
        Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""),
      );
      const value = await request(
        `/contents/${parts.map(encodeURIComponent).join("/")}`,
        z.object({
          commit: z.object({ sha: githubShaSchema }),
          content: z.object({
            sha: githubShaSchema,
            path: z.string(),
            type: z.literal("file"),
          }),
        }),
        { method: "PUT", body: { branch, message, sha: blobSha, content } },
      );
      if (value.content.path !== path)
        throw new AppError(
          "UPSTREAM_UNAVAILABLE",
          "GitHub file identity did not match.",
        );
      return { commitSha: value.commit.sha, blobSha: value.content.sha };
    },
    async findPullRequest({
      headBranch,
      baseBranch,
    }: {
      headBranch: string;
      baseBranch: string;
    }): Promise<GithubPullRequest | null> {
      validateGithubBranch(headBranch);
      validateGithubBranch(baseBranch);
      const query = new URLSearchParams({
        state: "all",
        head: `${owner}:${headBranch}`,
        base: baseBranch,
        per_page: "10",
      });
      const values = await request(
        `/pulls?${query}`,
        z.array(pullSchema).max(10),
      );
      // Fail closed rather than silently accept a response outside the requested repository or refs.
      const pulls = values.map(toPull);
      if (pulls.length > 1)
        throw new AppError(
          "UPSTREAM_UNAVAILABLE",
          "GitHub pull request lookup is ambiguous.",
        );
      if (
        pulls.some(
          (pull) => pull.headRef !== headBranch || pull.baseRef !== baseBranch,
        )
      )
        throw new AppError(
          "UPSTREAM_UNAVAILABLE",
          "GitHub pull request refs did not match.",
        );
      return pulls[0] ?? null;
    },
    async getPullRequest(number: number) {
      if (!Number.isSafeInteger(number) || number < 1)
        throw new AppError(
          "VALIDATION_ERROR",
          "GitHub pull request number is invalid.",
        );
      const result = toPull(await request(`/pulls/${number}`, pullSchema));
      if (result.number !== number)
        throw new AppError(
          "UPSTREAM_UNAVAILABLE",
          "GitHub pull request number did not match.",
        );
      // API version 2026-03-10 removed merge_commit_sha. The "merged" issue
      // event names the merge commit instead.
      // ponytail: first page only; a PR with over 100 events stays unverified.
      if (result.merged && result.mergedAt && !result.mergeCommitSha) {
        const events = await request(
          `/issues/${number}/events?per_page=100`,
          z.array(
            z.object({
              event: z.string(),
              commit_id: githubShaSchema.nullish(),
            }),
          ),
        );
        result.mergeCommitSha =
          events.find((event) => event.event === "merged")?.commit_id ?? null;
      }
      return result;
    },
    async createPullRequest({
      headBranch,
      baseBranch,
      title,
      body,
    }: {
      headBranch: string;
      baseBranch: string;
      title: string;
      body: string;
    }) {
      validateGithubBranch(headBranch);
      validateGithubBranch(baseBranch);
      if (!title || title.length > 256 || body.length > 32 * 1024)
        throw new AppError(
          "VALIDATION_ERROR",
          "GitHub pull request text exceeds the size limit.",
        );
      const result = toPull(
        await request("/pulls", pullSchema, {
          method: "POST",
          body: { head: headBranch, base: baseBranch, title, body },
        }),
      );
      if (result.headRef !== headBranch || result.baseRef !== baseBranch)
        throw new AppError(
          "UPSTREAM_UNAVAILABLE",
          "GitHub pull request refs did not match.",
        );
      return result;
    },
  };
}
