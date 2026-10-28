import { readFileSync } from "node:fs";
import { createPublishingTestDatabase } from "../../publishing/repositories/publishingTestDb";

// RFC-0026 phase A: the publishing test database plus the protection tables.
// The SQLite base tables leave out columns the project lookup and readiness
// read, so they are added here; Postgres is fully migrated already.
export function createProtectionTestDatabase() {
  const database = createPublishingTestDatabase();
  return {
    ...database,
    prepare: async () => {
      await database.prepare();
      if (database.isPostgres) return;
      await database.client.executeMultiple(`
        ALTER TABLE projects ADD COLUMN domain TEXT;
        ALTER TABLE projects ADD COLUMN location_code INTEGER DEFAULT 2840;
        ALTER TABLE projects ADD COLUMN language_code TEXT DEFAULT 'en';
        ALTER TABLE projects ADD COLUMN created_at TEXT;
        ALTER TABLE projects ADD COLUMN ai_research_keywords TEXT;
        ALTER TABLE gsc_connections ADD COLUMN gsc_account_id TEXT;
        ALTER TABLE gsc_connections ADD COLUMN connected_account_email TEXT;
        ALTER TABLE gsc_connections ADD COLUMN created_at TEXT;
        ALTER TABLE gsc_connections ADD COLUMN updated_at TEXT;
      `);
      // Its first statement creates the table; the rest alter tables the
      // base set does not have.
      const [ga4Connections = ""] = readFileSync(
        "drizzle/sqlite/0039_ga4_connections.sql",
        "utf8",
      ).split("--> statement-breakpoint");
      await database.client.executeMultiple(ga4Connections);
      await database.client.executeMultiple(
        readFileSync("drizzle/sqlite/0109_tiny_loners.sql", "utf8"),
      );
    },
  };
}
