import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGithubClient } from "./githubClient";

const fetchMock = vi.fn<typeof fetch>();
const headSha = "a".repeat(40);
const mergeSha = "b".repeat(40);
const mergedAt = "2026-10-14T16:00:00Z";
const repository = {
  id: 123,
  name: "site",
  full_name: "acme/site",
  owner: { login: "acme" },
};
function pull(overrides: Record<string, unknown> = {}) {
  return {
    number: 7,
    html_url: "https://github.com/acme/site/pull/7",
    state: "closed",
    merged: true,
    merged_at: mergedAt,
    merge_commit_sha: mergeSha,
    body: null,
    head: { ref: "seo/change", sha: headSha, repo: repository },
    base: { ref: "main", sha: headSha, repo: repository },
    ...overrides,
  };
}
function client() {
  return createGithubClient({
    token: "test-token",
    owner: "acme",
    repository: "site",
  });
}
beforeEach(() => {
  fetchMock.mockImplementation(async () => {
    throw new Error("Unexpected fetch");
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("GitHub pull request merge metadata", () => {
  it("returns the verified merge timestamp and actual merge SHA separately from the head", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(pull()));
    await expect(client().getPullRequest(7)).resolves.toMatchObject({
      merged: true,
      mergedAt,
      mergeCommitSha: mergeSha,
      headSha,
    });
  });

  it("reads the merge SHA from the merged event when the API version omits it", async () => {
    const { merge_commit_sha: _omitted, ...current } = pull();
    fetchMock
      .mockResolvedValueOnce(Response.json(current))
      .mockResolvedValueOnce(
        Response.json([
          { event: "closed", commit_id: null },
          { event: "merged", commit_id: mergeSha },
        ]),
      );
    await expect(client().getPullRequest(7)).resolves.toMatchObject({
      mergeCommitSha: mergeSha,
      headSha,
    });
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://api.github.com/repos/acme/site/issues/7/events?per_page=100",
    );
  });

  it.each([null, undefined])(
    "preserves unknown merge details without substituting the head SHA (%s)",
    async (sha) => {
      fetchMock.mockResolvedValueOnce(
        Response.json(pull({ merged_at: null, merge_commit_sha: sha })),
      );
      await expect(client().getPullRequest(7)).resolves.toMatchObject({
        merged: true,
        mergedAt: null,
        mergeCommitSha: null,
        headSha,
      });
    },
  );

  it("maps older unmerged list responses with no merge SHA to explicit null fields", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json([
        pull({
          state: "open",
          merged: undefined,
          merged_at: null,
          merge_commit_sha: undefined,
        }),
      ]),
    );
    await expect(
      client().findPullRequest({
        headBranch: "seo/change",
        baseBranch: "main",
      }),
    ).resolves.toMatchObject({
      merged: false,
      mergedAt: null,
      mergeCommitSha: null,
    });
  });

  it.each([
    { merged_at: "yesterday" },
    { merged_at: "2026-02-30T16:00:00Z" },
    { merged_at: "2026-10-14T16:00:00" },
    { merge_commit_sha: "not-a-commit" },
    { merge_commit_sha: "a".repeat(39) },
  ])("rejects invalid provider merge details %j", async (overrides) => {
    fetchMock.mockResolvedValueOnce(Response.json(pull(overrides)));
    await expect(client().getPullRequest(7)).rejects.toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
      message: "GitHub returned an invalid response.",
    });
  });

  it("rejects an explicitly unmerged PR that carries a merged timestamp", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(pull({ merged: false })));
    await expect(client().getPullRequest(7)).rejects.toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
    });
  });
});
