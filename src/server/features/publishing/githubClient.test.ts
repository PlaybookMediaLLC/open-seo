import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGithubClient } from "./githubClient";

const A = "a".repeat(40);
const B = "b".repeat(40);
const C = "c".repeat(40);
const fetchMock = vi.fn<typeof fetch>();
const connection = {
  token: "private-token",
  owner: "acme",
  repository: "site",
};
const identity = {
  id: 123,
  name: "site",
  full_name: "acme/site",
  owner: { login: "acme" },
};
const repository = () => ({
  ...identity,
  default_branch: "main",
  private: true,
  archived: false,
  permissions: { push: true },
});
const pull = () => ({
  number: 7,
  html_url: "https://github.com/acme/site/pull/7",
  state: "open",
  merged_at: null,
  body: "Review description",
  head: { ref: "seo/change", sha: B, repo: identity },
  base: { ref: "main", sha: A, repo: identity },
});
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });

beforeEach(() => {
  fetchMock.mockImplementation(async () => {
    throw new Error("Unexpected fetch");
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GitHub transport", () => {
  it("pins host/version, refuses redirects, composes cancellation and enforces its request budget", async () => {
    fetchMock.mockImplementation(async () => json(repository()));
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const client = createGithubClient({
      ...connection,
      signal: controller.signal,
      maxRequests: 1,
    });
    await expect(client.getRepository()).resolves.toEqual({
      id: "123",
      fullName: "acme/site",
      defaultBranch: "main",
      private: true,
      canPush: true,
      archived: false,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/acme/site");
    expect(init).toMatchObject({
      redirect: "error",
      method: "GET",
      headers: {
        Authorization: "Bearer private-token",
        "X-GitHub-Api-Version": "2026-03-10",
      },
    });
    expect(timeout).toHaveBeenCalledWith(10_000);
    controller.abort();
    expect(init?.signal?.aborted).toBe(true);
    await expect(client.getRepository()).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
    expect(client.requestCount).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not send an already cancelled request", async () => {
    const client = createGithubClient({
      ...connection,
      signal: AbortSignal.abort("secret"),
    });
    await expect(client.getRepository()).rejects.toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
    });
    expect(client.requestCount).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["provider", "network", "redirect"])(
    "sanitizes %s errors without write retries",
    async (kind) => {
      fetchMock.mockImplementation(async () => {
        if (kind === "network")
          throw new Error("private-token secret provider details");
        return new Response("private-token secret provider details", {
          status: kind === "redirect" ? 302 : 500,
          headers: { Location: "https://evil.test" },
        });
      });
      await expect(
        createGithubClient(connection).createRef("seo/change", A),
      ).rejects.toMatchObject({
        name: "AppError",
        code: "UPSTREAM_UNAVAILABLE",
        message: "GitHub request failed.",
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("cancels oversized streamed responses even when JSON would otherwise be valid", async () => {
    const cancel = vi.fn();
    fetchMock.mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                JSON.stringify(repository()) + " ".repeat(512 * 1024),
              ),
            );
          },
          cancel,
        }),
      ),
    );
    await expect(
      createGithubClient(connection).getRepository(),
    ).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it.each([
    { owner: "evil/../acme" },
    { repository: "site?secret" },
    { token: "secret\r\nInjected: yes" },
  ])("rejects unsafe connection input %j", (override) => {
    expect(() => createGithubClient({ ...connection, ...override })).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["../main", "main?x=y", "main%2fsecret", "a//b", "a.lock"])(
    "rejects unsafe ref %s before fetching",
    async (branch) => {
      await expect(
        createGithubClient(connection).getRef(branch),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    "../page.tsx",
    "/page.tsx",
    "app/%2e/page.tsx",
    "app\\page.tsx",
    Array(11).fill("app").join("/"),
  ])("rejects unsafe or overdeep path %s", async (path) => {
    await expect(
      createGithubClient(connection).readFile(path, A),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null for a missing ref but never for a forbidden ref", async () => {
    fetchMock
      .mockResolvedValueOnce(json({}, 404))
      .mockResolvedValueOnce(json({}, 403));
    const client = createGithubClient(connection);
    await expect(client.getRef("main")).resolves.toBeNull();
    await expect(client.getRef("main")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects repository identity drift across responses", async () => {
    fetchMock
      .mockResolvedValueOnce(json(repository()))
      .mockResolvedValueOnce(json({ ...repository(), id: 124 }));
    const client = createGithubClient(connection);
    await client.getRepository();
    await expect(client.getRepository()).rejects.toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
    });
  });
});

describe("GitHub scoped writes and pull requests", () => {
  it("sends the exact expected blob SHA, branch and UTF-8 content for a file update", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        commit: { sha: B },
        content: { sha: C, path: "app/page.tsx", type: "file" },
      }),
    );
    await expect(
      createGithubClient(connection).updateFile({
        branch: "seo/change",
        path: "app/page.tsx",
        source: "café",
        blobSha: A,
        message: "Update description",
      }),
    ).resolves.toEqual({ commitSha: B, blobSha: C });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://api.github.com/repos/acme/site/contents/app/page.tsx",
    );
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(typeof init?.body === "string" ? init.body : "")).toEqual(
      {
        branch: "seo/change",
        message: "Update description",
        sha: A,
        content: "Y2Fmw6k=",
      },
    );
  });

  it("creates a ref from the exact base and a PR with the exact selected refs", async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({
          ref: "refs/heads/seo/change",
          object: { type: "commit", sha: A },
        }),
      )
      .mockResolvedValueOnce(json(pull()));
    const client = createGithubClient(connection);
    await expect(client.createRef("seo/change", A)).resolves.toEqual({
      sha: A,
    });
    await expect(
      client.createPullRequest({
        headBranch: "seo/change",
        baseBranch: "main",
        title: "Update metadata",
        body: "Review description",
      }),
    ).resolves.toMatchObject({
      number: 7,
      merged: false,
      repositoryId: "123",
      headRef: "seo/change",
      baseRef: "main",
    });
    expect(
      fetchMock.mock.calls.map(([, init]): unknown =>
        JSON.parse(typeof init?.body === "string" ? init.body : ""),
      ),
    ).toEqual([
      { ref: "refs/heads/seo/change", sha: A },
      {
        head: "seo/change",
        base: "main",
        title: "Update metadata",
        body: "Review description",
      },
    ]);
  });

  it("bounds PR discovery to ten with all states and exact head/base", async () => {
    fetchMock.mockResolvedValueOnce(
      json([{ ...pull(), state: "closed", merged_at: "2026-10-14T00:00:00Z" }]),
    );
    await expect(
      createGithubClient(connection).findPullRequest({
        headBranch: "seo/change",
        baseBranch: "main",
      }),
    ).resolves.toMatchObject({ number: 7, merged: true });
    const input = fetchMock.mock.calls[0][0];
    if (typeof input !== "string") throw new Error("Expected URL string");
    const url = new URL(input);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      state: "all",
      head: "acme:seo/change",
      base: "main",
      per_page: "10",
    });
  });

  it("accepts canonical repository casing in a verified PR URL", async () => {
    const canonical = {
      ...identity,
      name: "Site",
      full_name: "Acme/Site",
      owner: { login: "Acme" },
    };
    const value = pull();
    value.html_url = "https://github.com/Acme/Site/pull/7";
    value.head.repo = canonical;
    value.base.repo = canonical;
    fetchMock
      .mockResolvedValueOnce(json({ ...repository(), ...canonical }))
      .mockResolvedValueOnce(json(value));
    const client = createGithubClient(connection);
    await client.getRepository();
    await expect(client.getPullRequest(7)).resolves.toMatchObject({
      url: value.html_url,
      repositoryId: "123",
    });
  });

  it.each(["url", "owner", "repo", "id", "number"])(
    "rejects mismatched PR %s identity",
    async (field) => {
      const value = pull();
      if (field === "url")
        value.html_url = "https://evil.test/acme/site/pull/7";
      if (field === "owner")
        value.head = {
          ...value.head,
          repo: { ...identity, owner: { login: "evil" } },
        };
      if (field === "repo")
        value.base = { ...value.base, repo: { ...identity, name: "other" } };
      if (field === "id")
        value.head = { ...value.head, repo: { ...identity, id: 124 } };
      if (field === "number") {
        value.number = 8;
        value.html_url = "https://github.com/acme/site/pull/8";
      }
      fetchMock.mockResolvedValueOnce(json(value));
      await expect(
        createGithubClient(connection).getPullRequest(7),
      ).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    "https://github.com:443/acme/site/pull/7",
    "https://user@github.com/acme/site/pull/7",
    "https://github.com/acme/site/pull/7?x=1",
    "https://github.com/acme/site/pull/7#diff",
    "https://github.com/acme/site/PULL/7",
    "not a URL",
  ])("rejects noncanonical PR URL %s", async (url) => {
    fetchMock.mockResolvedValueOnce(json({ ...pull(), html_url: url }));
    await expect(
      createGithubClient(connection).getPullRequest(7),
    ).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
  });

  it("rejects multiple PRs for the same selected refs", async () => {
    fetchMock.mockResolvedValueOnce(
      json([
        pull(),
        {
          ...pull(),
          number: 8,
          html_url: "https://github.com/acme/site/pull/8",
        },
      ]),
    );
    await expect(
      createGithubClient(connection).findPullRequest({
        headBranch: "seo/change",
        baseBranch: "main",
      }),
    ).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
  });

  it("rejects PR search results for a different branch", async () => {
    const value = pull();
    value.head.ref = "another";
    fetchMock.mockResolvedValueOnce(json([value]));
    await expect(
      createGithubClient(connection).findPullRequest({
        headBranch: "seo/change",
        baseBranch: "main",
      }),
    ).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
  });
});
