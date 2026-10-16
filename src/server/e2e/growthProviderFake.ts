import { env as workersEnv } from "cloudflare:workers";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { z } from "zod";
import { gitBlobHash } from "@/server/features/publishing/proposalFingerprint";
import { GSC_OAUTH_SCOPES } from "@/shared/gsc";

// E2E fake for the providers behind the growth workflow (RFC-0001 S4). It
// answers Google OAuth, Search Console and GitHub requests made by the
// worker, so every Relay service runs its real code. Loaded only when the
// build sets VITE_E2E_GROWTH_FIXTURES=1 (see growthFixtures.ts).

const CLIENT_ID = "e2e-client.apps.googleusercontent.com";
const E2E_SITE = "sc-domain:example.com";
const OWNER = "acme";
const REPO = "site";
const REPOSITORY = {
  id: 4242,
  name: REPO,
  full_name: `${OWNER}/${REPO}`,
  owner: { login: OWNER },
};

const FILES: Record<string, string> = {
  "package.json": `{"name":"site","dependencies":{"next":"15.5.0","react":"19.0.0"}}\n`,
  "app/layout.tsx": `export const metadata = {\n  title: { default: "Example", template: "%s | Example" },\n};\n\nexport default function Layout({ children }) {\n  return <html><body>{children}</body></html>;\n}\n`,
  "app/about/page.tsx": `export const metadata = {\n  title: "About",\n  description: "About the example company.",\n};\n\nexport default function Page() {\n  return <h1>About</h1>;\n}\n`,
};

type Commit = {
  sha: string;
  parent: string | null;
  files: Map<string, string>;
};
type Pull = {
  number: number;
  head: string;
  base: string;
  headSha: string;
  baseSha: string;
  body: string;
};

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const randomSha = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(20)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
const base64 = (text: string) =>
  btoa(
    Array.from(new TextEncoder().encode(text), (byte) =>
      String.fromCharCode(byte),
    ).join(""),
  );
const fromBase64 = (text: string) =>
  new TextDecoder().decode(
    Uint8Array.from(atob(text), (char) => char.charCodeAt(0)),
  );

// A tiny git: blobs by sha, trees rebuilt per commit, branch refs.
const blobs = new Map<string, string>();
const trees = new Map<
  string,
  Array<{ path: string; mode: string; type: string; sha: string }>
>();
const commits = new Map<string, Commit & { tree: string }>();
const refs = new Map<string, string>();
const pulls: Pull[] = [];

async function storeTree(
  files: Map<string, string>,
  prefix = "",
): Promise<string> {
  const entries = new Map<
    string,
    { mode: string; type: string; sha: string }
  >();
  const directories = new Set<string>();
  for (const path of files.keys()) {
    if (!path.startsWith(prefix)) continue;
    const rest = path.slice(prefix.length);
    const [name, ...deeper] = rest.split("/");
    if (deeper.length) directories.add(name);
    else
      entries.set(name, {
        mode: "100644",
        type: "blob",
        sha: files.get(path)!,
      });
  }
  for (const name of directories)
    entries.set(name, {
      mode: "040000",
      type: "tree",
      sha: await storeTree(files, `${prefix}${name}/`),
    });
  const tree = [...entries].map(([path, entry]) => ({ path, ...entry }));
  const sha = randomSha();
  trees.set(sha, tree);
  return sha;
}

async function commit(files: Map<string, string>, parent: string | null) {
  const sha = randomSha();
  commits.set(sha, { sha, parent, files, tree: await storeTree(files) });
  return sha;
}

async function seedRepository() {
  const files = new Map<string, string>();
  for (const [path, source] of Object.entries(FILES)) {
    const sha = await gitBlobHash(source);
    blobs.set(sha, source);
    files.set(path, sha);
  }
  refs.set("main", await commit(files, null));
}

function pullJson(pull: Pull) {
  return {
    number: pull.number,
    html_url: `https://github.com/${OWNER}/${REPO}/pull/${pull.number}`,
    state: "open",
    merged: false,
    merged_at: null,
    body: pull.body,
    head: { ref: pull.head, sha: pull.headSha, repo: REPOSITORY },
    base: { ref: pull.base, sha: pull.baseSha, repo: REPOSITORY },
  };
}

async function github(url: URL, method: string, bodyText: string) {
  const prefix = `/repos/${OWNER}/${REPO}`;
  if (!url.pathname.startsWith(prefix))
    return json({ message: "Not Found" }, 404);
  const route = url.pathname.slice(prefix.length);
  const body = bodyText
    ? z.record(z.string(), z.string()).parse(JSON.parse(bodyText))
    : {};
  let match: RegExpMatchArray | null;

  if (route === "")
    return json({
      ...REPOSITORY,
      default_branch: "main",
      private: true,
      archived: false,
      permissions: { push: true },
    });
  if ((match = route.match(/^\/git\/ref\/heads\/(.+)$/))) {
    const sha = refs.get(decodeURIComponent(match[1]));
    return sha
      ? json({
          ref: `refs/heads/${decodeURIComponent(match[1])}`,
          object: { type: "commit", sha },
        })
      : json({ message: "Not Found" }, 404);
  }
  if (route === "/git/refs" && method === "POST") {
    const branch = body.ref.replace("refs/heads/", "");
    refs.set(branch, body.sha);
    return json(
      { ref: body.ref, object: { type: "commit", sha: body.sha } },
      201,
    );
  }
  if ((match = route.match(/^\/git\/commits\/([0-9a-f]{40})$/))) {
    const found = commits.get(match[1]);
    return found
      ? json({
          sha: found.sha,
          tree: { sha: found.tree },
          parents: found.parent ? [{ sha: found.parent }] : [],
        })
      : json({ message: "Not Found" }, 404);
  }
  if ((match = route.match(/^\/git\/trees\/([0-9a-f]{40})$/))) {
    const tree = trees.get(match[1]);
    return tree
      ? json({ sha: match[1], truncated: false, tree })
      : json({ message: "Not Found" }, 404);
  }
  if ((match = route.match(/^\/git\/blobs\/([0-9a-f]{40})$/))) {
    const source = blobs.get(match[1]);
    return source === undefined
      ? json({ message: "Not Found" }, 404)
      : json({
          sha: match[1],
          encoding: "base64",
          content: base64(source),
          size: new TextEncoder().encode(source).byteLength,
        });
  }
  if ((match = route.match(/^\/contents\/(.+)$/)) && method === "PUT") {
    const path = match[1].split("/").map(decodeURIComponent).join("/");
    const head = commits.get(refs.get(body.branch) ?? "")!;
    if (head.files.get(path) !== body.sha)
      return json({ message: "sha does not match" }, 409);
    const source = fromBase64(body.content);
    const blobSha = await gitBlobHash(source);
    blobs.set(blobSha, source);
    const files = new Map(head.files).set(path, blobSha);
    const sha = await commit(files, head.sha);
    refs.set(body.branch, sha);
    return json({
      commit: { sha },
      content: { sha: blobSha, path, type: "file" },
    });
  }
  if (
    (match = route.match(/^\/compare\/([0-9a-f]{40})\.\.\.([0-9a-f]{40})$/))
  ) {
    const [, baseSha, headSha] = match;
    const base = commits.get(baseSha)!;
    const head = commits.get(headSha)!;
    const files = [...head.files]
      .filter(([path, sha]) => base.files.get(path) !== sha)
      .map(([filename, sha]) => ({ filename, status: "modified", sha }));
    return json({
      status: "ahead",
      ahead_by: 1,
      behind_by: 0,
      total_commits: 1,
      base_commit: { sha: baseSha },
      merge_base_commit: { sha: baseSha },
      commits: [{ sha: headSha }],
      files,
    });
  }
  if (route === "/pulls" && method === "POST") {
    const pull: Pull = {
      number: pulls.length + 1,
      head: body.head,
      base: body.base,
      headSha: refs.get(body.head)!,
      baseSha: refs.get(body.base)!,
      body: body.body ?? "",
    };
    pulls.push(pull);
    return json(pullJson(pull), 201);
  }
  if (route === "/pulls") {
    const head = url.searchParams.get("head")?.replace(`${OWNER}:`, "");
    return json(
      pulls
        .filter(
          (pull) =>
            pull.head === head && pull.base === url.searchParams.get("base"),
        )
        .map(pullJson),
    );
  }
  if ((match = route.match(/^\/pulls\/(\d+)$/))) {
    const pull = pulls.find((item) => item.number === Number(match![1]));
    return pull ? json(pullJson(pull)) : json({ message: "Not Found" }, 404);
  }
  if (/^\/commits\/[0-9a-f]{40}\/check-runs$/.test(route))
    return json({
      check_runs: [{ status: "completed", conclusion: "success" }],
    });
  if (/^\/commits\/[0-9a-f]{40}\/status$/.test(route))
    return json({ state: "success", total_count: 1 });
  if (route === "/deployments" || /^\/deployments\/\d+\/statuses$/.test(route))
    return json([]);
  return json({ message: `E2E fake has no route for ${method} ${route}` }, 501);
}

// Rows that make one striking-distance opportunity for /about.
function searchAnalytics(body: { dimensions?: string[] }) {
  const page = "https://example.com/about";
  if (body.dimensions?.join() === "query,page")
    return {
      rows: [
        {
          keys: ["example company about", page],
          clicks: 12,
          impressions: 640,
          ctr: 0.019,
          position: 8.4,
        },
      ],
    };
  return {
    rows: [
      { keys: [page], clicks: 12, impressions: 640, ctr: 0.019, position: 8.4 },
    ],
  };
}

export async function installGrowthProviderFake() {
  // Test-only values, set where both the runtime-env helper (process.env)
  // and src/lib/auth.ts (the Workers env) read them. A real value wins.
  const defaults = {
    GOOGLE_CLIENT_ID: CLIENT_ID,
    GOOGLE_CLIENT_SECRET: "e2e-client-secret",
    BETTER_AUTH_SECRET: "e2e-only-secret-that-is-at-least-32-characters",
  };
  for (const [name, value] of Object.entries(defaults)) {
    process.env[name] ||= value;
    if (!Reflect.get(workersEnv, name)) Reflect.set(workersEnv, name, value);
  }

  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = {
    ...(await exportJWK(publicKey)),
    kid: "e2e",
    alg: "RS256",
    use: "sig",
  };
  await seedRepository();
  const idToken = () =>
    new SignJWT({ email: "e2e@example.com" })
      .setProtectedHeader({ alg: "RS256", kid: "e2e" })
      .setIssuer("https://accounts.google.com")
      .setAudience(process.env.GOOGLE_CLIENT_ID!)
      .setSubject("e2e-google-account")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);

  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method =
      init?.method ?? (input instanceof Request ? input.method : "GET");
    const bodyText =
      typeof init?.body === "string"
        ? init.body
        : input instanceof Request && !init
          ? await input.clone().text()
          : "";
    if (url.host === "oauth2.googleapis.com" && url.pathname === "/token")
      return json({
        access_token: "e2e-access-token",
        expires_in: 3600,
        refresh_token: "e2e-refresh-token",
        scope: GSC_OAUTH_SCOPES.join(" "),
        id_token: await idToken(),
      });
    if (
      url.host === "www.googleapis.com" &&
      url.pathname === "/oauth2/v3/certs"
    )
      return json({ keys: [jwk] });
    if (url.host === "openidconnect.googleapis.com")
      return json({ sub: "e2e-google-account", email: "e2e@example.com" });
    if (
      url.host === "www.googleapis.com" &&
      url.pathname === "/webmasters/v3/sites"
    )
      return json({
        siteEntry: [{ siteUrl: E2E_SITE, permissionLevel: "siteOwner" }],
      });
    if (
      url.host === "www.googleapis.com" &&
      url.pathname.endsWith("/searchAnalytics/query")
    )
      return json(
        searchAnalytics(
          z
            .object({ dimensions: z.array(z.string()).optional() })
            .parse(JSON.parse(bodyText || "{}")),
        ),
      );
    if (url.host === "api.github.com") return github(url, method, bodyText);
    return realFetch(input, init);
  };
}
