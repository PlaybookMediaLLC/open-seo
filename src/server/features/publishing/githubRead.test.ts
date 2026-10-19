import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGithubClient } from "./githubClient";

const A = "a".repeat(40);
const B = "b".repeat(40);
const C = "c".repeat(40);
const D = "d".repeat(40);
const fetchMock = vi.fn<typeof fetch>();
const connection = { token: "test-token", owner: "acme", repository: "site" };
const json = (value: unknown) => new Response(JSON.stringify(value));
const commit = () => ({ sha: A, tree: { sha: B }, parents: [] });
const tree = (
  sha: string,
  path: string,
  mode: string,
  type: string,
  entrySha: string,
) => ({ sha, truncated: false, tree: [{ path, mode, type, sha: entrySha }] });
const blob = (source: string) => ({
  sha: D,
  encoding: "base64",
  content: Buffer.from(source).toString("base64"),
  size: Buffer.byteLength(source),
});

beforeEach(() => {
  fetchMock.mockImplementation(async () => {
    throw new Error("Unexpected fetch");
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("GitHub immutable file reading", () => {
  it.each([
    "valid",
    "extra-file",
    "renamed",
    "wrong-blob",
    "extra-commit",
    "unrelated-base",
  ])("verifies single-file compare: %s", async (scenario) => {
    const file = {
      filename: "app/page.tsx",
      status: "modified",
      sha: C,
      patch: "must not return this",
    };
    const value = {
      status: "ahead",
      ahead_by: 1,
      behind_by: 0,
      total_commits: 1,
      base_commit: { sha: A },
      merge_base_commit: { sha: A },
      commits: [{ sha: B }],
      files: [file],
    };
    if (scenario === "extra-file")
      value.files.push({ ...file, filename: "other.ts" });
    if (scenario === "renamed") file.status = "renamed";
    if (scenario === "wrong-blob") file.sha = D;
    if (scenario === "extra-commit") value.total_commits = 2;
    if (scenario === "unrelated-base") value.merge_base_commit.sha = D;
    fetchMock.mockResolvedValueOnce(json(value));
    await expect(
      createGithubClient(connection).verifySingleFileCommit({
        baseSha: A,
        headSha: B,
        path: "app/page.tsx",
        blobSha: C,
      }),
    ).resolves.toBe(scenario === "valid");
  });
  it("walks only the selected trees, reuses immutable reads and returns UTF-8 source", async () => {
    const responses = [
      commit(),
      tree(B, "app", "040000", "tree", C),
      tree(C, "page.tsx", "100644", "blob", D),
      blob("café"),
      blob("café"),
    ];
    fetchMock.mockImplementation(async () => json(responses.shift()));
    const client = createGithubClient(connection);
    await expect(client.readFile("app/page.tsx", A)).resolves.toEqual({
      source: "café",
      blobSha: D,
    });
    await client.readFile("app/page.tsx", A);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `https://api.github.com/repos/acme/site/git/commits/${A}`,
      `https://api.github.com/repos/acme/site/git/trees/${B}`,
      `https://api.github.com/repos/acme/site/git/trees/${C}`,
      `https://api.github.com/repos/acme/site/git/blobs/${D}`,
      `https://api.github.com/repos/acme/site/git/blobs/${D}`,
    ]);
    expect(client.requestCount).toBe(5);
  });

  it.each([
    ["120000", "blob", "package.json"],
    ["160000", "commit", "package.json"],
    ["100755", "blob", "package.json"],
    ["120000", "blob", "package.json/page.tsx"],
    ["160000", "commit", "package.json/page.tsx"],
  ])(
    "rejects mode %s type %s at %s without following it",
    async (mode, type, path) => {
      fetchMock
        .mockResolvedValueOnce(json(commit()))
        .mockResolvedValueOnce(json(tree(B, "package.json", mode, type, D)));
      await expect(
        createGithubClient(connection).readFile(path, A),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );

  it("rejects truncated trees instead of trusting a partial directory", async () => {
    fetchMock.mockResolvedValueOnce(json(commit())).mockResolvedValueOnce(
      json({
        ...tree(B, "package.json", "100644", "blob", D),
        truncated: true,
      }),
    );
    await expect(
      createGithubClient(connection).readFile("package.json", A),
    ).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(["package.json", "page.tsx"])(
    "caps %s decoded file bytes at 32 KiB",
    async (path) => {
      fetchMock
        .mockResolvedValueOnce(json(commit()))
        .mockResolvedValueOnce(json(tree(B, path, "100644", "blob", D)))
        .mockResolvedValueOnce(json(blob("a".repeat(32 * 1024 + 1))));
      await expect(
        createGithubClient(connection).readFile(path, A),
      ).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
    },
  );

  it.each(["commit", "tree", "blob"])(
    "rejects mismatched immutable %s identity",
    async (kind) => {
      const commitValue = commit();
      const treeValue = tree(B, "package.json", "100644", "blob", D);
      const blobValue = blob("{}");
      if (kind === "commit") commitValue.sha = C;
      if (kind === "tree") treeValue.sha = C;
      if (kind === "blob") blobValue.sha = C;
      const responses = [commitValue, treeValue, blobValue];
      fetchMock.mockImplementation(async () => json(responses.shift()));
      await expect(
        createGithubClient(connection).readFile("package.json", A),
      ).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
    },
  );

  it("does not trust a false small blob size", async () => {
    fetchMock
      .mockResolvedValueOnce(json(commit()))
      .mockResolvedValueOnce(json(tree(B, "package.json", "100644", "blob", D)))
      .mockResolvedValueOnce(
        json({ ...blob("a".repeat(32 * 1024 + 1)), size: 1 }),
      );
    await expect(
      createGithubClient(connection).readFile("package.json", A),
    ).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
  });
});

// RFC-0014 5.5: an image header read stops at the cap.
it("reads at most the asked bytes of a raw file", async () => {
  fetchMock
    .mockResolvedValueOnce(json(commit()))
    .mockResolvedValueOnce(json(tree(B, "hero.png", "100644", "blob", D)))
    .mockResolvedValueOnce(new Response(new Uint8Array(100_000).fill(7)));
  const bytes = await createGithubClient(connection).readFileHead(
    "hero.png",
    A,
    65_536,
  );
  expect(bytes).toHaveLength(65_536);
  const [route, init] = fetchMock.mock.calls[2];
  expect(route).toBe(`https://api.github.com/repos/acme/site/git/blobs/${D}`);
  expect(new Headers(init?.headers).get("Accept")).toBe(
    "application/vnd.github.raw",
  );
});
