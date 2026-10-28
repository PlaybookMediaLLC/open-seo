import { and, eq } from "drizzle-orm";
import { sortBy } from "remeda";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { db } from "@/db";
import { auditEvents, member, monitoredPages, user } from "@/db/schema";
import { ProtectionService } from "./ProtectionService";

// RFC-0026 phase A (IRFC-0001) on real SQLite and Postgres.
const database = await vi.hoisted(async () => {
  const { createProtectionTestDatabase } =
    await import("./repositories/protectionTestDb");
  return createProtectionTestDatabase();
});
const env = vi.hoisted(() => {
  const kv = new Map<string, string>();
  return {
    DATABASE_PROVIDER: "d1",
    AUTH_MODE: "hosted",
    KV: {
      get: async (key: string) => kv.get(key) ?? null,
      put: async (key: string, value: string) => void kv.set(key, value),
    },
    EMAIL: { send: vi.fn() },
  };
});
vi.mock("cloudflare:workers", () => ({
  env: Object.assign(env, {
    DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1",
  }),
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
// No DNS in tests: the origin is the project's own domain.
vi.mock("@/server/lib/audit/url-policy", () => ({
  normalizeAndValidateStartUrl: async (url: string) => url,
}));

const userIds: string[] = [];
beforeAll(() => database.prepare());
beforeEach(() => {
  env.AUTH_MODE = "hosted";
});
afterAll(async () => {
  for (const id of userIds) await db.delete(user).where(eq(user.id, id));
  await database.close();
});

type Context = Parameters<typeof ProtectionService.get>[0];

async function site(gscSiteUrl: string | null = "sc-domain:example.com") {
  const organizationId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  await database.client.execute({
    sql: "INSERT INTO organization (id, name, slug, created_at) VALUES (?, 'test', ?, CURRENT_TIMESTAMP)",
    args: [organizationId, `${database.slugPrefix}${organizationId}`],
  });
  await database.client.execute({
    sql: "INSERT INTO projects (id, organization_id, name, domain) VALUES (?, ?, 'Acme', 'example.com')",
    args: [projectId, organizationId],
  });
  if (gscSiteUrl)
    await database.client.execute({
      sql: "INSERT INTO gsc_connections (id, project_id, site_url, organization_id, connected_by_user_id) VALUES (?, ?, ?, ?, 'test')",
      args: [projectId, projectId, gscSiteUrl, organizationId],
    });
  const join = async (role: string | null): Promise<Context> => {
    const userId = crypto.randomUUID();
    userIds.push(userId);
    await db.insert(user).values({
      id: userId,
      name: role ?? "delegated",
      email: `${userId}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    // Delegated modes have no member rows and resolve as owner.
    if (role)
      await db.insert(member).values({
        id: crypto.randomUUID(),
        organizationId,
        userId,
        role,
        createdAt: new Date(),
      });
    return {
      userId,
      organizationId,
      role: role ?? "owner",
      project: { id: projectId, name: "Acme", domain: "example.com" },
    };
  };
  return {
    projectId,
    owner: await join("owner"),
    admin: await join("admin"),
    member: await join("member"),
    join,
  };
}

const settings = {
  productionOrigin: "https://example.com",
  checkHourUtc: 6,
  reviewerUserId: null,
  notes: null,
  allowRepairProposals: false,
  allowPullRequests: false,
};
const pageChange = {
  add: [],
  remove: [],
  exclude: [],
  include: [],
};

async function enrolled(context: Context, overrides = {}) {
  await ProtectionService.saveSettings(context, { ...settings, ...overrides });
  const { enrollment } = await ProtectionService.get(context);
  if (!enrollment) throw new Error("no enrollment");
  return enrollment;
}

async function addPages(context: Context, paths: readonly string[]) {
  const { enrollment } = await ProtectionService.get(context);
  await ProtectionService.savePages(context, {
    ...pageChange,
    expectedScopeVersion: enrollment?.scopeVersion ?? 0,
    add: paths.map((path) => ({ path, selectionReason: "owner" as const })),
  });
}

const events = async (projectId: string) =>
  db
    .select({ action: auditEvents.action })
    .from(auditEvents)
    .where(eq(auditEvents.projectId, projectId));

describe(`ProtectionService (${database.isPostgres ? "Postgres" : "SQLite"})`, () => {
  it("refuses a member without integration:manage before any write", async () => {
    const { projectId, member: viewer } = await site();
    await expect(
      ProtectionService.saveSettings(viewer, settings),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await ProtectionService.get(viewer)).enrollment).toBeNull();
    expect(await events(projectId)).toEqual([]);
  });

  it("writes exactly one audit row per save, and none for a save that changes nothing", async () => {
    const { projectId, owner } = await site();
    await enrolled(owner);
    await ProtectionService.saveSettings(owner, settings);
    await ProtectionService.saveSettings(owner, {
      ...settings,
      checkHourUtc: 7,
    });
    await ProtectionService.verifyOrigin(owner);
    await addPages(owner, ["/"]);
    expect(
      sortBy(await events(projectId), (row) => row.action).map(
        (row) => row.action,
      ),
    ).toEqual([
      "protection.origin_verified",
      "protection.pages_changed",
      "protection.settings_changed",
      "protection.settings_changed",
    ]);
  });

  it("refuses a 21st page, another origin, a query and a fragment", async () => {
    const { owner } = await site();
    await enrolled(owner);
    await addPages(
      owner,
      Array.from({ length: 20 }, (_, index) => `/page-${index}`),
    );
    await expect(addPages(owner, ["/page-20"])).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Protect at most 20 pages.",
    });
    for (const path of [
      "https://other.example/page",
      "/search?q=shoes",
      "/pricing#plans",
    ])
      await expect(addPages(owner, [path])).rejects.toThrow(
        "paths on the production origin",
      );
    expect((await ProtectionService.get(owner)).pages).toHaveLength(20);
  });

  it("re-adds a removed path, but never keeps one path active twice", async () => {
    const { owner } = await site();
    const enrollment = await enrolled(owner);
    await addPages(owner, ["/pricing/"]);
    const [page] = (await ProtectionService.get(owner)).pages;
    await ProtectionService.savePages(owner, {
      ...pageChange,
      expectedScopeVersion: enrollment.scopeVersion + 1,
      remove: [page?.id ?? ""],
    });
    await addPages(owner, ["https://example.com/pricing"]);
    await expect(addPages(owner, ["/pricing"])).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    const rows = await db
      .select({ removedAt: monitoredPages.removedAt })
      .from(monitoredPages)
      .where(
        and(
          eq(monitoredPages.enrollmentId, enrollment.id),
          eq(monitoredPages.path, "/pricing"),
        ),
      );
    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.removedAt === null)).toHaveLength(1);
  });

  it("writes nothing from a stale scope version", async () => {
    const { projectId, owner } = await site();
    const enrollment = await enrolled(owner);
    await addPages(owner, ["/a"]);
    await expect(
      ProtectionService.savePages(owner, {
        ...pageChange,
        expectedScopeVersion: enrollment.scopeVersion,
        add: [{ path: "/b", selectionReason: "owner" }],
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await ProtectionService.get(owner)).pages).toHaveLength(1);
    expect(
      (await events(projectId)).filter(
        (row) => row.action === "protection.pages_changed",
      ),
    ).toHaveLength(1);
  });

  it("lands exactly one of two saves from the same version, with one audit row", async () => {
    const { projectId, owner, admin } = await site();
    const enrollment = await enrolled(owner);
    const save = (context: Context, path: string) =>
      ProtectionService.savePages(context, {
        ...pageChange,
        expectedScopeVersion: enrollment.scopeVersion,
        add: [{ path, selectionReason: "owner" }],
      });
    const results = await Promise.allSettled([
      save(owner, "/a"),
      save(admin, "/b"),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === "rejected"),
    ).toMatchObject({ reason: { code: "CONFLICT" } });
    expect((await ProtectionService.get(owner)).pages).toHaveLength(1);
    expect(
      (await events(projectId)).filter(
        (row) => row.action === "protection.pages_changed",
      ),
    ).toHaveLength(1);
  });

  it("refuses a fourth test alert in a day", async () => {
    const { owner, admin } = await site();
    await enrolled(owner, { reviewerUserId: admin.userId });
    for (let sent = 0; sent < 3; sent++)
      await ProtectionService.sendTestAlert(owner);
    await expect(ProtectionService.sendTestAlert(owner)).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
    expect(env.EMAIL.send).toHaveBeenCalledTimes(3);
    expect(env.EMAIL.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: `${admin.userId}@example.com` }),
    );
  });

  it("lets only the reviewer confirm the alert, and a reviewer change clears it", async () => {
    const { owner, admin } = await site();
    await enrolled(owner, { reviewerUserId: admin.userId });
    await expect(ProtectionService.confirmAlert(admin)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await ProtectionService.sendTestAlert(owner);
    await expect(ProtectionService.confirmAlert(owner)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await ProtectionService.confirmAlert(admin);
    expect(
      (await ProtectionService.get(owner)).enrollment?.alertConfirmedAt,
    ).toBeTruthy();
    await ProtectionService.saveSettings(owner, {
      ...settings,
      reviewerUserId: owner.userId,
    });
    expect((await ProtectionService.get(owner)).enrollment).toMatchObject({
      alertTestedAt: null,
      alertConfirmedAt: null,
    });
  });

  it("refuses activation while a required item fails, and stays in setup", async () => {
    const { owner } = await site();
    await enrolled(owner);
    await expect(
      ProtectionService.setStatus(owner, "active"),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect((await ProtectionService.get(owner)).enrollment?.status).toBe(
      "setup",
    );
  });

  it("changes the origin only in setup or paused, and the change clears verification", async () => {
    const { owner } = await site();
    const enrollment = await enrolled(owner);
    await ProtectionService.verifyOrigin(owner);
    await ProtectionService.saveSettings(owner, {
      ...settings,
      productionOrigin: "https://www.example.com",
    });
    expect((await ProtectionService.get(owner)).enrollment).toMatchObject({
      productionOrigin: "https://www.example.com",
      originVerifiedAt: null,
      scopeVersion: enrollment.scopeVersion + 1,
    });
    await ProtectionService.setStatus(owner, "ended");
    await expect(
      ProtectionService.saveSettings(owner, settings),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it.each([
    ["sc-domain:example.com", "https://www.example.com", true],
    ["https://example.com/", "https://example.com", true],
    ["https://example.com/", "https://www.example.com", false],
    ["http://example.com/", "https://example.com", false],
    ["https://example.com/blog/", "https://example.com", false],
  ])(
    "verifies %s as covering %s: %s",
    async (gscSiteUrl, productionOrigin, verified) => {
      const { owner } = await site(gscSiteUrl);
      await enrolled(owner, { productionOrigin });
      expect(await ProtectionService.verifyOrigin(owner)).toMatchObject({
        verified,
      });
    },
  );

  it("in delegated mode, lets the user be reviewer and reach every item but baseline and schedule", async () => {
    env.AUTH_MODE = "local_noauth";
    const { join } = await site();
    const delegated = await join(null);
    await enrolled(delegated, { reviewerUserId: delegated.userId });
    await ProtectionService.verifyOrigin(delegated);
    await addPages(delegated, ["/"]);
    await ProtectionService.sendTestAlert(delegated);
    await ProtectionService.confirmAlert(delegated);
    const { readiness, reviewerCandidates } =
      await ProtectionService.get(delegated);
    expect(reviewerCandidates.map((row) => row.userId)).toEqual([
      delegated.userId,
    ]);
    expect(
      readiness.items
        .filter((item) => item.required && item.state !== "passed")
        .map((item) => item.id),
    ).toEqual(["baseline", "schedule"]);
  });
});
