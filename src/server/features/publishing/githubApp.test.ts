import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { installationToken } from "./githubApp";

const env = vi.hoisted(() => ({ values: {} as Record<string, string> }));
vi.mock("@/server/lib/runtime-env", () => ({
  getOptionalEnvValue: async (name: string) => env.values[name],
}));

beforeEach(async () => {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const pkcs8 = new Uint8Array(
    await crypto.subtle.exportKey("pkcs8", pair.privateKey),
  );
  env.values = {
    GITHUB_APP_ID: "12345",
    GITHUB_APP_SLUG: "relay-seo",
    GITHUB_APP_CLIENT_ID: "client",
    GITHUB_APP_CLIENT_SECRET: "secret",
    GITHUB_APP_PRIVATE_KEY: `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...pkcs8))}\n-----END PRIVATE KEY-----`,
  };
});
afterEach(() => {
  vi.unstubAllGlobals();
});

it("asks for one repository and only the operation's permissions", async () => {
  const fetchMock = vi.fn(
    async (
      _url: string,
      _init: { body: string; headers: Record<string, string> },
    ) => Response.json({ token: "ghs_installation" }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const token = await installationToken({
    installationId: 77,
    repositoryId: "123",
    permissions: { metadata: "read", issues: "write" },
  });
  expect(token).toBe("ghs_installation");
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("https://api.github.com/app/installations/77/access_tokens");
  expect(JSON.parse(init.body)).toEqual({
    repository_ids: [123],
    permissions: { metadata: "read", issues: "write" },
  });
  // The app JWT is signed with RS256.
  const [header] = init.headers.Authorization.slice(7).split(".");
  expect(
    JSON.parse(atob(header.replaceAll("-", "+").replaceAll("_", "/"))),
  ).toEqual({
    alg: "RS256",
    typ: "JWT",
  });
});
