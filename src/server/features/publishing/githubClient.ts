import { z } from "zod";
import { AppError } from "@/server/lib/errors";
import { readTextUpTo } from "@/server/lib/audit/html-response";
import {
  createGithubReader,
  validateGithubBranch,
  type GithubBytesRequest,
  type GithubRequest,
} from "./githubRead";
import { createGithubIssues } from "./githubIssues";
import { createGithubSignals } from "./githubSignals";
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
  assumePush = false,
}: {
  token: string;
  owner: string;
  repository: string;
  signal?: AbortSignal;
  maxRequests?: number;
  assumePush?: boolean;
}) {
  if (
    !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(owner) ||
    !/^[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$/.test(repository) ||
    !/^[\x21-\x7e]+$/.test(token) ||
    !Number.isInteger(maxRequests) ||
    maxRequests < 1 ||
    maxRequests > 256
  ) {
    throw new AppError("VALIDATION_ERROR", "GitHub connection is invalid.");
  }
  let requestCount = 0;
  let repositoryId: string | undefined;
  /** One budgeted, authorized request; throws on a non-2xx status. */
  const send = async (
    route: string,
    accept: string,
    options?: Parameters<GithubRequest>[2],
  ) => {
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
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repository}${route}`,
      {
        method: options?.method ?? "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: accept,
          "X-GitHub-Api-Version": "2026-03-10",
          "Content-Type": "application/json",
          "User-Agent": "OpenSEO",
        },
        body: options ? JSON.stringify(options.body) : undefined,
        signal: requestSignal,
        // Workers rejects "error". A 3xx response is not ok, so it fails below.
        redirect: "manual",
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
    return response;
  };
  const request: GithubRequest = async (route, schema, options) => {
    try {
      const response = await send(
        route,
        "application/vnd.github+json",
        options,
      );
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
  // RFC-0014 5.5: raw bytes, read only up to the cap.
  const requestBytes: GithubBytesRequest = async (route, maxBytes) => {
    try {
      const response = await send(route, "application/vnd.github.raw");
      const bytes = new Uint8Array(maxBytes);
      const reader = response.body?.getReader();
      if (!reader) return bytes.subarray(0, 0);
      let length = 0;
      while (length < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        const part = value.subarray(0, maxBytes - length);
        bytes.set(part, length);
        length += part.length;
      }
      await reader.cancel();
      return bytes.subarray(0, length);
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
    // The file locator spends its own smaller budget through this.
    request,
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
        // GitHub reports push: false for App installation tokens. The
        // installation's permissions decide for them instead.
        canPush: assumePush || (value.permissions?.push ?? false),
        archived: value.archived,
      };
    },
    ...createGithubReader(request, requestBytes),
    ...createGithubSignals(request),
    ...createGithubIssues(request),
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
