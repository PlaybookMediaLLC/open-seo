import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BrandTermService } from "./BrandTermService";

const database = await vi.hoisted(async () => {
  const { createOpportunityTestDatabase } =
    await import("../repositories/opportunityRepositoryTestDb");
  // Its own cleanup prefix, so parallel Postgres test files keep their rows.
  return createOpportunityTestDatabase("brand-term-test-");
});
const { client } = database;
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
beforeAll(async () => {
  await database.prepare();
  // The minimal SQLite projects table has no domain. Postgres is fully migrated.
  if (!database.isPostgres)
    await client.execute("ALTER TABLE projects ADD COLUMN domain TEXT");
});
afterAll(() => database.close());

async function project(domain: string | null) {
  const id = crypto.randomUUID();
  await client.execute({
    sql: "INSERT INTO organization (id, name, slug, created_at) VALUES (?, 'test', ?, CURRENT_TIMESTAMP)",
    args: [id, `brand-term-test-${id}`],
  });
  await client.execute({
    sql: "INSERT INTO projects (id, organization_id, name, domain) VALUES (?, ?, 'test', ?)",
    args: [id, id, domain],
  });
  return id;
}

describe(`BrandTermService real ${database.isPostgres ? "Postgres" : "SQLite"}`, () => {
  it("seeds one term from the domain until terms are saved", async () => {
    const id = await project("eigenn.io");
    expect(await BrandTermService.get(id)).toEqual({
      terms: ["eigenn"],
      source: "domain",
    });
    await BrandTermService.save(id, ["eigenn", "acme"], "user");
    expect(await BrandTermService.get(id)).toEqual({
      terms: ["acme", "eigenn"],
      source: "saved",
    });
    await BrandTermService.save(id, [], "user");
    expect((await BrandTermService.get(id)).source).toBe("domain");
    expect(await BrandTermService.get(await project(null))).toEqual({
      terms: [],
      source: "none",
    });
  });

  it("keeps terms per project and the first author of a kept term", async () => {
    const own = await project("own.com");
    const other = await project("other.com");
    await BrandTermService.save(own, ["acme"], "user");
    await BrandTermService.save(other, ["beta"], "sam");
    await BrandTermService.save(own, ["acme", "rocket"], "mcp");
    expect((await BrandTermService.get(own)).terms).toEqual(["acme", "rocket"]);
    expect((await BrandTermService.get(other)).terms).toEqual(["beta"]);
    const authors = await client.execute({
      sql: "SELECT term, created_by FROM project_brand_terms WHERE project_id = ? ORDER BY term",
      args: [own],
    });
    expect(authors.rows.map((row) => [row.term, row.created_by])).toEqual([
      ["acme", "user"],
      ["rocket", "mcp"],
    ]);
  });
});
