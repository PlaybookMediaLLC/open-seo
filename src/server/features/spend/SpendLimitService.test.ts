import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { db } from "@/db";
import { spendLedger } from "@/db/schema";
import { setupRun } from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { SpendLimitService } from "./SpendLimitService";

const database = await vi.hoisted(async () => {
  const { createExperimentTestDatabase } =
    await import("@/server/features/experiments/repositories/experimentTestDb");
  return createExperimentTestDatabase();
});
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
beforeAll(async () => {
  await database.prepare();
  if (!database.isPostgres)
    // The real project lookup selects every column of the full table.
    await database.client.executeMultiple(`
      ALTER TABLE projects ADD COLUMN domain TEXT;
      ALTER TABLE projects ADD COLUMN location_code INTEGER DEFAULT 2840;
      ALTER TABLE projects ADD COLUMN language_code TEXT DEFAULT 'en';
      ALTER TABLE projects ADD COLUMN created_at TEXT;
      ALTER TABLE projects ADD COLUMN ai_research_keywords TEXT;
    `);
});
afterAll(() => database.close());

async function organization() {
  const { run } = await setupRun(database.client, database.slugPrefix);
  const as = (role: string) => ({
    organizationId: run.projectId,
    userId: role,
    role,
  });
  return { projectId: run.projectId, owner: as("owner"), admin: as("admin") };
}

it("lets only owners change a limit, and removes it with null", async () => {
  const { projectId, owner, admin } = await organization();
  await expect(
    SpendLimitService.save(admin, { projectId, monthlyLimitCredits: 10 }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await SpendLimitService.save(owner, { projectId, monthlyLimitCredits: 500 });
  await SpendLimitService.save(owner, { projectId, monthlyLimitCredits: 300 });
  expect((await SpendLimitService.project(admin, projectId)).limit).toBe(300);
  await SpendLimitService.save(owner, { projectId, monthlyLimitCredits: null });
  expect((await SpendLimitService.project(admin, projectId)).limit).toBeNull();
});

it("counts this month's real cost, or the estimate until it settles", async () => {
  const { projectId, owner } = await organization();
  const thisMonth = new Date().toISOString().slice(0, 7);
  const row = (
    status: "admitted" | "settled" | "refused",
    feature: string,
    periodMonth = thisMonth,
  ) => ({
    id: crypto.randomUUID(),
    organizationId: owner.organizationId,
    projectId,
    feature,
    provider: "dataforseo" as const,
    actor: "owner",
    periodMonth,
    estimatedCredits: 40,
    actualCredits: status === "settled" ? 25 : null,
    status,
    idempotencyKey: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });
  await db
    .insert(spendLedger)
    .values([
      row("admitted", "backlinks"),
      row("settled", "keyword_research"),
      row("refused", "keyword_research"),
      row("settled", "keyword_research", "2000-01"),
    ]);
  const spend = await SpendLimitService.organization(owner);
  expect(spend.committed).toBe(65);
  expect(spend.projects).toEqual([
    { id: projectId, name: "test", committed: 65, limit: null },
  ]);
  expect(spend.features).toEqual(
    expect.arrayContaining([
      { feature: "backlinks", committed: 40 },
      { feature: "keyword_research", committed: 25 },
    ]),
  );
});
