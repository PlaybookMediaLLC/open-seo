import { z } from "zod";
import { AppError } from "@/server/lib/errors";
import { readTextUpTo } from "@/server/lib/audit/html-response";
import {
  createGithubReader,
  validateGithubBranch,
  type GithubRequest,
} from "./githubRead";
import { createGithubWriter } from "./githubWrite";

export type GithubRepository = {
  id: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  canPush: boolean;
  archived: boolean;
};
export type { GithubPullRequest } from "./githubWrite";
const githubIdSchema = z.union([
  z.number().int().positive().max(Number.MAX_SAFE_INTEGER).transform(String),
  z.string().regex(/^[1-9][0-9]*$/),
]);

export function createGithubClient({
  token,
  owner,
  repository,
  signal,
  maxRequests = 32,
}: {
  token: string;
  owner: string;
  repository: string;
  signal?: AbortSignal;
  maxRequests?: number;
}) {
  if (
    !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(owner) ||
    !/^[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$/.test(repository) ||
    !/^[\x21-\x7e]+$/.test(token) ||
    !Number.isInteger(maxRequests) ||
    maxRequests < 1 ||
    maxRequests > 32
  ) {
    throw new AppError("VALIDATION_ERROR", "GitHub connection is invalid.");
  }
  let requestCount = 0;
  let repositoryId: string | undefined;
  const request: GithubRequest = async (route, schema, options) => {
    if (requestCount >= maxRequests)
      throw new AppError("RATE_LIMITED", "GitHub request budget exceeded.");
    if (signal?.aborted)
      throw new AppError(
        "UPSTREAM_UNAVAILABLE",
        "GitHub request was cancelled.",
      );
    requestCount++;
    const timeout = AbortSignal.timeout(10_000);
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repository}${route}`,
        {
          method: options?.method ?? "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2026-03-10",
            "Content-Type": "application/json",
            "User-Agent": "OpenSEO",
          },
          body: options ? JSON.stringify(options.body) : undefined,
          signal: requestSignal,
          redirect: "error",
        },
      );
      if (!response.ok) {
        await response.body?.cancel();
        const code =
          response.status === 404
            ? "NOT_FOUND"
            : response.status === 401 || response.status === 403
              ? "FORBIDDEN"
              : response.status === 409 || response.status === 422
                ? "CONFLICT"
                : response.status === 429
                  ? "RATE_LIMITED"
                  : "UPSTREAM_UNAVAILABLE";
        throw new AppError(code, "GitHub request failed.");
      }
      // The shared reader truncates. Reject a saturated read rather than parsing a partial body.
      const text = await readTextUpTo(response, 512 * 1024);
      if (new TextEncoder().encode(text).byteLength >= 512 * 1024)
        throw new AppError(
          "UPSTREAM_UNAVAILABLE",
          "GitHub response exceeds the size limit.",
        );
      const result = schema.safeParse(JSON.parse(text));
      if (!result.success)
        throw new AppError(
          "UPSTREAM_UNAVAILABLE",
          "GitHub returned an invalid response.",
        );
      return result.data;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("UPSTREAM_UNAVAILABLE", "GitHub request failed.");
    }
  };
  const identitySchema = z.object({
    id: githubIdSchema,
    name: z.string(),
    full_name: z.string(),
    owner: z.object({ login: z.string() }),
  });
  const validateRepository = (value: z.infer<typeof identitySchema>) => {
    if (
      value.name.toLowerCase() !== repository.toLowerCase() ||
      value.owner.login.toLowerCase() !== owner.toLowerCase() ||
      value.full_name.toLowerCase() !==
        `${owner}/${repository}`.toLowerCase() ||
      (repositoryId !== undefined && value.id !== repositoryId)
    ) {
      throw new AppError(
        "UPSTREAM_UNAVAILABLE",
        "GitHub repository identity did not match.",
      );
    }
    repositoryId = value.id;
  };
  return {
    get requestCount() {
      return requestCount;
    },
    async getRepository(): Promise<GithubRepository> {
      const value = await request(
        "",
        identitySchema.extend({
          default_branch: z.string(),
          private: z.boolean(),
          archived: z.boolean(),
          permissions: z.object({ push: z.boolean() }).optional(),
        }),
      );
      validateRepository(value);
      validateGithubBranch(value.default_branch);
      return {
        id: value.id,
        fullName: value.full_name,
        defaultBranch: value.default_branch,
        private: value.private,
        canPush: value.permissions?.push ?? false,
        archived: value.archived,
      };
    },
    ...createGithubReader(request),
    ...createGithubWriter(
      request,
      owner,
      repository,
      identitySchema,
      validateRepository,
    ),
  };
}

export type GithubClient = ReturnType<typeof createGithubClient>;
