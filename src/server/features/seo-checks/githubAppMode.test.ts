import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db";
import {
  ciCheckFindings,
  ciCheckRuns,
  ciCheckUrls,
  githubAppInstallations,
  publishingConnections,
} from "@/db/schema";
import { setupRun } from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import {
  handleDeploymentStatus,
  reportCheckRun,
  verifyWebhook,
} from "./githubAppMode";

// RFC-0010 5.12: GitHub App mode, from the signed webhook to the Check Run.
const database = await vi.hoisted(async () => {
  const { createExperimentTestDatabase } =
    await import("@/server/features/experiments/repositories/experimentTestDb");
  return createExperimentTestDatabase();
});
const mocks = vi.hoisted(() => ({
  secret: vi.fn(),
  fetch: vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(),
}));
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
vi.mock("@/server/lib/runtime-env", () => ({
  getOptionalEnvValue: mocks.secret,
  isHostedServerAuthMode: async () => false,
}));
vi.mock("@/server/lib/audit/url-policy", () => ({
  normalizeAndValidateStartUrl: async (url: string) => url,
}));
vi.mock("@/server/features/publishing/githubApp", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  installationToken: async () => "installation-token",
}));
const SECRET = "webhook-secret";
const SHA = "a".repeat(40);
const FILE = "app/pricing/page.tsx";

beforeAll(async () => {
  await database.prepare();
  if (!database.isPostgres)
    await database.client.execute(
      "ALTER TABLE projects ADD COLUMN domain TEXT",
    );
  vi.stubGlobal("fetch", mocks.fetch);
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await database.close();
});
beforeEach(() => {
  mocks.secret.mockResolvedValue(SECRET);
  mocks.fetch.mockImplementation(async (url: string) =>
    // The repository has no relay-gate.json.
    url.includes("/contents/relay-gate.json")
      ? new Response("{}", { status: 404 })
      : Response.json(
          url.endsWith(`/commits/${SHA}/pulls`)
            ? [{ number: 7, state: "open", labels: [] }]
            : url.includes("/pulls/7/files")
              ? [{ filename: FILE }]
              : {},
        ),
  );
});

async function signed(body: string, delivery: string, secret = SECRET) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)),
  );
  return new Request("https://relay.test/api/github/app/webhook", {
    method: "POST",
    body,
    headers: {
      "x-hub-signature-256": `sha256=${Buffer.from(mac).toString("hex")}`,
      "x-github-delivery": delivery,
      "x-github-event": "deployment_status",
    },
  });
}

/** A project connected to repository 99 through installation 5. */
async function connect() {
  const { run } = await setupRun(database.client, database.slugPrefix);
  const projectId = run.projectId;
  await database.client.execute({
    sql: "UPDATE projects SET domain = 'example.com' WHERE id = ?",
    args: [projectId],
  });
  const installationRef = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(githubAppInstallations).values({
    id: installationRef,
    organizationId: projectId,
    installationId: 5,
    accountLogin: "acme",
    accountType: "Organization",
    createdBy: "owner",
    createdAt: now,
  });
  await db.insert(publishingConnections).values({
    id: crypto.randomUUID(),
    projectId,
    repositoryId: "99",
    owner: "acme",
    repository: "site",
    baseBranch: "main",
    rootDirectory: "",
    transport: "github_app",
    installationRef,
    createdBy: "owner",
    createdAt: now,
  });
  return projectId;
}
const deployment = (environment: string) => ({
  deployment_status: {
    state: "success",
    environment_url: "https://site-git-pr-7.vercel.app",
  },
  deployment: { sha: SHA, environment },
  repository: { id: 99, full_name: "acme/site" },
  installation: { id: 5 },
});

it("accepts only signed deliveries, once each", async () => {
  const body = JSON.stringify({ zen: "hi" });
  const delivery = crypto.randomUUID();
  const first = await verifyWebhook(await signed(body, delivery));
  expect(first).toMatchObject({ ok: true, duplicate: false });
  expect(await verifyWebhook(await signed(body, delivery))).toMatchObject({
    ok: true,
    duplicate: true,
  });
  expect(
    await verifyWebhook(await signed(body, crypto.randomUUID(), "wrong")),
  ).toEqual({ ok: false, status: 401 });
  mocks.secret.mockResolvedValue(undefined);
  expect(await verifyWebhook(await signed(body, crypto.randomUUID()))).toEqual({
    ok: false,
    status: 404,
  });
});

it("bounds webhook bytes before verifying or claiming a delivery", async () => {
  const body = JSON.stringify({ value: "é".repeat(1024 * 1024) });
  expect(await verifyWebhook(await signed(body, crypto.randomUUID()))).toEqual({
    ok: false,
    status: 413,
  });
});

it("starts an App run for a preview of an open pull request", async () => {
  const projectId = await connect();
  // A production deployment of the same commit starts nothing.
  expect(await handleDeploymentStatus(deployment("Production"))).toBe(
    "ignored",
  );
  expect(await handleDeploymentStatus(deployment("Preview"))).toEqual([
    "queued",
  ]);
  const [run] = await db
    .select()
    .from(ciCheckRuns)
    .where(eq(ciCheckRuns.projectId, projectId));
  expect(run).toMatchObject({
    source: "app",
    installationId: 5,
    pullRequest: 7,
    changedFiles: FILE,
    previewOrigin: "https://site-git-pr-7.vercel.app",
  });
});

it("reports the run as a Check Run with annotations on the mapped files", async () => {
  const projectId = await connect();
  await handleDeploymentStatus(deployment("Preview"));
  const [run] = await db
    .update(ciCheckRuns)
    .set({ status: "succeeded", blockingCount: 1 })
    .where(eq(ciCheckRuns.projectId, projectId))
    .returning({ id: ciCheckRuns.id });
  if (!run) throw new Error("no run");
  const page = { runId: run.id, projectId, path: "/pricing" };
  await db.insert(ciCheckUrls).values({
    ...page,
    id: crypto.randomUUID(),
    reason: "changed_file",
    sourceFile: FILE,
  });
  await db.insert(ciCheckFindings).values({
    ...page,
    id: crypto.randomUUID(),
    rule: "newly-noindex",
    severity: "blocking",
    message: "The page is now noindex.",
  });
  await reportCheckRun(run.id);
  const [url, init] = mocks.fetch.mock.lastCall ?? [];
  expect(url).toBe("https://api.github.com/repos/acme/site/check-runs");
  const sent = typeof init?.body === "string" ? init.body : "{}";
  expect(JSON.parse(sent)).toMatchObject({
    head_sha: SHA,
    conclusion: "failure",
    output: {
      // RFC-0015: findings grouped by rule pack.
      summary: "### SEO\n\n- **blocking** /pricing: newly-noindex",
      annotations: [
        {
          path: FILE,
          annotation_level: "failure",
          title: "newly-noindex on /pricing",
        },
      ],
    },
  });
});
