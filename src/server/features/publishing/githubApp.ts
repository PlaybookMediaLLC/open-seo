import { z } from "zod";
import { AppError } from "@/server/lib/errors";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";

// GitHub App transport (RFC-0005 5.7). Relay signs a 9-minute app JWT with
// WebCrypto, then asks for an installation token limited to one repository
// and the permissions of one operation. Tokens are kept in memory only.
export type AppPermissions = Partial<
  Record<
    | "metadata"
    | "contents"
    | "pull_requests"
    | "deployments"
    | "checks"
    | "statuses"
    | "issues",
    "read" | "write"
  >
>;

export const PUBLISH_PERMISSIONS: AppPermissions = {
  metadata: "read",
  contents: "write",
  pull_requests: "write",
};

const API = "https://api.github.com";

export async function githubAppConfig() {
  const [appId, slug, clientId, clientSecret, privateKey] = await Promise.all(
    [
      "GITHUB_APP_ID",
      "GITHUB_APP_SLUG",
      "GITHUB_APP_CLIENT_ID",
      "GITHUB_APP_CLIENT_SECRET",
      "GITHUB_APP_PRIVATE_KEY",
    ].map(async (name) => (await getOptionalEnvValue(name))?.trim() ?? ""),
  );
  return appId && slug && clientId && clientSecret && privateKey
    ? { appId, slug, clientId, clientSecret, privateKey }
    : null;
}

function base64Url(bytes: Uint8Array | string) {
  const binary =
    typeof bytes === "string"
      ? bytes
      : Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

// GitHub issues a PKCS#1 key. WebCrypto needs PKCS#8: convert it once with
// `openssl pkcs8 -topk8 -nocrypt` (docs/maintainers/playbook-deployment.md).
async function appJwt(appId: string, pem: string) {
  const body = pem
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "pkcs8",
      Uint8Array.from(atob(body), (character) => character.charCodeAt(0)),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
  } catch {
    throw new AppError(
      "AUTH_CONFIG_MISSING",
      "GITHUB_APP_PRIVATE_KEY must be a PKCS#8 PEM key.",
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(
    JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: appId }),
  )}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

async function githubJson<T>(
  url: string,
  schema: z.ZodType<T>,
  init: { token: string; method?: "GET" | "POST"; body?: unknown },
): Promise<T> {
  const response = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${init.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2026-03-10",
      "Content-Type": "application/json",
      "User-Agent": "Relay",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(10_000),
    // Workers rejects "error". A 3xx response is not ok, so it fails below.
    redirect: "manual",
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new AppError(
      response.status === 404
        ? "NOT_FOUND"
        : response.status === 401 || response.status === 403
          ? "FORBIDDEN"
          : "UPSTREAM_UNAVAILABLE",
      "GitHub request failed.",
    );
  }
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success)
    throw new AppError(
      "UPSTREAM_UNAVAILABLE",
      "GitHub returned an invalid response.",
    );
  return parsed.data;
}

/** A token for one installation, one repository and one operation's permissions. */
export async function installationToken(input: {
  installationId: number;
  repositoryId?: string;
  permissions: AppPermissions;
}) {
  const config = await githubAppConfig();
  if (!config) throw new AppError("AUTH_CONFIG_MISSING");
  const value = await githubJson(
    `${API}/app/installations/${input.installationId}/access_tokens`,
    z.object({ token: z.string().min(1) }),
    {
      token: await appJwt(config.appId, config.privateKey),
      method: "POST",
      body: {
        ...(input.repositoryId
          ? { repository_ids: [Number(input.repositoryId)] }
          : {}),
        permissions: input.permissions,
      },
    },
  );
  return value.token;
}

/** Exchanges the setup callback's code for a user token, used once. */
export async function exchangeUserCode(code: string) {
  const config = await githubAppConfig();
  if (!config) throw new AppError("AUTH_CONFIG_MISSING");
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
    }),
    signal: AbortSignal.timeout(10_000),
    // Workers rejects "error". A 3xx response is not ok, so it fails below.
    redirect: "manual",
  });
  const parsed = z
    .object({ access_token: z.string().min(1) })
    .safeParse(await response.json().catch(() => null));
  if (!response.ok || !parsed.success) throw new AppError("FORBIDDEN");
  return parsed.data.access_token;
}

/** The installations that the signed-in GitHub user can access. */
export async function userInstallations(userToken: string) {
  const value = await githubJson(
    `${API}/user/installations?per_page=100`,
    z.object({
      installations: z.array(
        z.object({
          id: z.number().int().positive(),
          account: z.object({ login: z.string(), type: z.string() }),
        }),
      ),
    }),
    { token: userToken },
  );
  return value.installations;
}

/** The repositories that an installation can reach. */
export async function installationRepositories(installationId: number) {
  const token = await installationToken({
    installationId,
    permissions: { metadata: "read" },
  });
  const value = await githubJson(
    `${API}/installation/repositories?per_page=100`,
    z.object({
      repositories: z.array(
        z.object({
          id: z.number().int().positive(),
          name: z.string(),
          owner: z.object({ login: z.string() }),
          default_branch: z.string(),
        }),
      ),
    }),
    { token },
  );
  return value.repositories.map((repository) => ({
    id: String(repository.id),
    owner: repository.owner.login,
    name: repository.name,
    defaultBranch: repository.default_branch,
  }));
}
