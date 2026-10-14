import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle as sqliteDrizzle } from "drizzle-orm/libsql";
import { drizzle as pgDrizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Opt-in against the coordinator's disposable, fully migrated local database.
// Never accept an arbitrary user database for this mutating integration suite.
const logger = {
  logQuery(_query: string, params: unknown[]) {
    if (params.length >= 100)
      throw new Error("Opportunity query exceeds the D1 parameter budget.");
  },
};

export function createOpportunityTestDatabase() {
  const pgUrl = process.env.OPPORTUNITY_TEST_PG_URL;
  if (pgUrl) {
    const url = new URL(pgUrl);
    if (
      url.hostname !== "127.0.0.1" ||
      url.pathname !== "/openseo_growth_test"
    ) {
      throw new Error(
        "Opportunity SQL tests require disposable localhost/openseo_growth_test.",
      );
    }
    const connection = postgres(pgUrl, { max: 4 });
    const execute = async (
      input: string | { sql: string; args: Array<string | number | null> },
    ) => {
      const query = typeof input === "string" ? input : input.sql;
      let parameter = 0;
      const rows = await connection.unsafe<Record<string, unknown>[]>(
        query.replaceAll("?", () => `$${++parameter}`),
        typeof input === "string" ? [] : input.args,
      );
      return { rows };
    };
    return {
      isPostgres: true,
      db: pgDrizzle(connection, { logger }),
      client: {
        execute,
        executeMultiple: async (query: string) => {
          await connection.unsafe(query).simple();
        },
      },
      prepare: async () => {
        await execute(
          "INSERT INTO organization (id,name,slug,created_at) VALUES ('opportunity-test-foreign','test','opportunity-test-foreign',CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING",
        );
      },
      rejectEvidence: async () => {
        await connection.unsafe(
          "CREATE FUNCTION opportunity_test_reject_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'evidence failure'; END $$",
        );
        await execute(
          "CREATE TRIGGER reject_evidence BEFORE INSERT ON opportunity_evidence FOR EACH ROW EXECUTE FUNCTION opportunity_test_reject_evidence()",
        );
        return async () => {
          await execute("DROP TRIGGER reject_evidence ON opportunity_evidence");
          await execute("DROP FUNCTION opportunity_test_reject_evidence()");
        };
      },
      close: async () => {
        await execute(
          "DELETE FROM organization WHERE slug LIKE 'opportunity-test-%'",
        );
        await connection.end();
      },
    };
  }
  const sqlite = createClient({ url: "file::memory:" });
  return {
    isPostgres: false,
    db: sqliteDrizzle(sqlite, { logger }),
    client: sqlite,
    prepare: async () => {
      await sqlite.executeMultiple(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE organization (id TEXT PRIMARY KEY, name TEXT, slug TEXT, created_at TEXT);
        CREATE TABLE projects (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT, archived_at TEXT);
        CREATE TABLE data_refresh_claims (key TEXT PRIMARY KEY, organization_id TEXT NOT NULL, token TEXT NOT NULL, next_attempt_at INTEGER NOT NULL);
        CREATE TABLE gsc_connections (id TEXT PRIMARY KEY, project_id TEXT NOT NULL UNIQUE, site_url TEXT NOT NULL, organization_id TEXT, connected_by_user_id TEXT);
      `);
      await sqlite.executeMultiple(
        readFileSync("drizzle/sqlite/0056_careless_the_watchers.sql", "utf8"),
      );
    },
    rejectEvidence: async () => {
      await sqlite.execute(
        "CREATE TRIGGER reject_evidence BEFORE INSERT ON opportunity_evidence BEGIN SELECT RAISE(ABORT, 'evidence failure'); END",
      );
      return async () => {
        await sqlite.execute("DROP TRIGGER reject_evidence");
      };
    },
    close: () => sqlite.close(),
  };
}
