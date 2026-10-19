import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db";
import { auditEvents, ciCheckRuns, ciPreviewHosts } from "@/db/schema";
import type * as UrlPolicy from "@/server/lib/audit/url-policy";
import { setupRun } from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { createCheck, getCheck } from "./CheckApi";
import { createCiToken, revokeCiToken, verifyCiToken } from "./ciTokens";
import { deleteCheckRunsBefore } from "./SeoCheckSettingsService";

const database = await vi.hoisted(async () => {
  const { createExperimentTestDatabase } =
    await import("@/server/features/experiments/repositories/experimentTestDb");
  return createExperimentTestDatabase();
});
const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  paid: vi.fn(),
  validate: vi.fn(),
}));
vi.mock("cloudflare:workers", () => ({
  env: {
    DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1",
    CI_CHECK_RATE_LIMIT: { limit: mocks.limit },
  },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
vi.mock("@/server/lib/runtime-env", () => ({
  isHostedServerAuthMode: async () => true,
}));
vi.mock("@/server/billing/subscription", () => ({
  customerHasPaidPlan: mocks.paid,
}));
vi.mock("@/server/lib/audit/url-policy", () => ({
  normalizeAndValidateStartUrl: mocks.validate,
}));
const urlPolicy = await vi.importActual<typeof UrlPolicy>(
  "@/server/lib/audit/url-policy",
);
beforeAll(async () => {
  await database.prepare();
  if (!database.isPostgres)
    await database.client.executeMultiple(`
      ALTER TABLE projects ADD COLUMN domain TEXT;
    `);
});
afterAll(() => database.close());
beforeEach(() => {
  mocks.limit.mockResolvedValue({ success: true });
  mocks.paid.mockResolvedValue(false);
  mocks.validate.mockImplementation(async (url: string) => url);
});

async function project() {
  const { run } = await setupRun(database.client, database.slugPrefix);
  await database.client.execute({
    sql: "UPDATE projects SET domain = 'example.com' WHERE id = ?",
    args: [run.projectId],
  });
  const { token } = await createCiToken({
    projectId: run.projectId,
    name: "GitHub",
    createdBy: "owner",
  });
  const context = await verifyCiToken(`Bearer ${token}`);
  if (!context) throw new Error("token did not verify");
  return { projectId: run.projectId, token, context };
}
const body = (headSha: string, previewUrl = "https://pr-7.example.com") => ({
  previewUrl,
  repository: "acme/site",
  pullRequest: 7,
  headSha,
  changedFiles: ["app/pricing/page.tsx"],
  override: false,
});
const sha = (digit: string) => digit.repeat(40);

it("verifies a token for its project until it is revoked", async () => {
  const { projectId, token, context } = await project();
  expect(context.projectId).toBe(projectId);
  expect(await verifyCiToken(`Bearer ${token}x`)).toBeNull();
  expect(await verifyCiToken(token)).toBeNull();
  await revokeCiToken(projectId, context.tokenId);
  expect(await verifyCiToken(`Bearer ${token}`)).toBeNull();
});

it("refuses a preview host outside the allowlist before any fetch", async () => {
  const { context } = await project();
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  const result = await createCheck(
    context,
    body(sha("1"), "https://attacker.example.net"),
  );
  expect(result.status).toBe(400);
  expect(result.body.error).toBe("preview_host_not_allowed");
  expect(mocks.validate).not.toHaveBeenCalled();
  expect(fetchSpy).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
});

it("refuses 20 disallowed hosts, private addresses included, before any fetch", async () => {
  const { projectId, context } = await project();
  // Owner-added private addresses pass the allowlist; the URL policy stops them.
  const owner = ["127.0.0.1", "10.0.0.8", "169.254.169.254", "192.168.1.1"];
  await db.insert(ciPreviewHosts).values(
    owner.map((host) => ({
      id: crypto.randomUUID(),
      projectId,
      host,
      createdBy: "owner",
      createdAt: new Date().toISOString(),
    })),
  );
  mocks.validate.mockImplementation(urlPolicy.normalizeAndValidateStartUrl);
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  const hosts = [
    ...owner,
    "attacker.example.net",
    "example.com.evil.net",
    "evilexample.com",
    "example.co",
    "vercel.app.evil.net",
    "pages.dev",
    "netlify.app",
    "localhost",
    "172.16.0.1",
    "0.0.0.0",
    "[::1]",
    "metadata.google.internal",
    "github.com",
    "relay.playbookmedia.io",
    "pr-7.example.com.attacker.dev",
    "xn--exmple-cua.com",
  ];
  expect(hosts).toHaveLength(20);
  for (const host of hosts)
    expect(
      (await createCheck(context, body(sha("9"), `https://${host}`))).status,
    ).toBe(400);
  expect(fetchSpy).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
});

it("queues one run per commit and preview, inside the project", async () => {
  const mine = await project();
  const other = await project();
  const first = await createCheck(mine.context, body(sha("2")));
  const again = await createCheck(mine.context, body(sha("2")));
  expect(first.status).toBe(202);
  expect(again).toEqual({ status: 200, body: first.body });
  const runId = String(first.body.id);
  expect((await getCheck(mine.context, runId)).body.status).toBe("queued");
  // Another project's token cannot read the run.
  expect((await getCheck(other.context, runId)).status).toBe(404);
});

it("stops at the monthly quota and at the rate limit", async () => {
  const { context } = await project();
  for (let index = 0; index < 30; index++)
    expect(
      (await createCheck(context, body(index.toString(16).padStart(40, "a"))))
        .status,
    ).toBe(202);
  const quota = await createCheck(context, body(sha("b")));
  expect(quota).toMatchObject({
    status: 429,
    body: { error: "quota_reached" },
  });
  mocks.limit.mockResolvedValueOnce({ success: false });
  expect((await createCheck(context, body(sha("c")))).body.error).toBe(
    "rate_limited",
  );
});

it("records the override label in the audit log", async () => {
  const { projectId, context } = await project();
  await createCheck(context, { ...body(sha("d")), override: true });
  expect(
    await db
      .select({ action: auditEvents.action, targetId: auditEvents.targetId })
      .from(auditEvents)
      .where(eq(auditEvents.projectId, projectId)),
  ).toEqual([{ action: "seo_check.overridden", targetId: "acme/site#7" }]);
});

it("deletes runs older than the retention cutoff", async () => {
  const { projectId, context } = await project();
  await createCheck(context, body(sha("e")), new Date("2026-01-01T00:00:00Z"));
  await deleteCheckRunsBefore("2026-04-01T00:00:00.000Z");
  expect(
    await db
      .select({ id: ciCheckRuns.id })
      .from(ciCheckRuns)
      .where(eq(ciCheckRuns.projectId, projectId)),
  ).toEqual([]);
});

// RFC-0015 5.4: relay-gate.json from the repository switches packs, and a
// mistake in it fails the request with the exact reason.
it("takes the packs from relay-gate.json, and refuses an invalid file", async () => {
  const { context } = await project();
  const invalid = await createCheck(context, {
    ...body(sha("f")),
    gateConfig: '{"packs":{"links":"on"}}',
  });
  expect(invalid).toMatchObject({
    status: 400,
    body: { error: "invalid_gate_config" },
  });
  expect(String(invalid.body.message)).toContain("packs.links");
  const queued = await createCheck(context, {
    ...body(sha("f")),
    gateConfig:
      '{"packs":{"links":true},"ignore":[{"rule":"title-changed","path":"^/legacy/"}]}',
  });
  const run = await getCheck(context, String(queued.body.id));
  expect(run.body).toMatchObject({
    packs: ["seo", "links"],
    fileIgnores: [{ rule: "title-changed", path: "^/legacy/" }],
  });
  expect(String(run.body.configHash)).toMatch(/^[0-9a-f]{64}$/);
});
