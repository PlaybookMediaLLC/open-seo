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

export function createOpportunityTestDatabase(
  cleanupPrefix = "opportunity-test-",
) {
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
        await execute({
          sql: "DELETE FROM organization WHERE slug LIKE ?",
          args: [`${cleanupPrefix}%`],
        });
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
        CREATE TABLE projects (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT, archived_at TEXT, indexnow_key TEXT);
        CREATE TABLE data_refresh_claims (key TEXT PRIMARY KEY, organization_id TEXT NOT NULL, token TEXT NOT NULL, next_attempt_at INTEGER NOT NULL);
        CREATE TABLE gsc_connections (id TEXT PRIMARY KEY, project_id TEXT NOT NULL UNIQUE, site_url TEXT NOT NULL, organization_id TEXT, connected_by_user_id TEXT);
        CREATE TABLE audits (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, started_by_user_id TEXT NOT NULL, start_url TEXT NOT NULL, status TEXT NOT NULL, completed_at TEXT);
        CREATE TABLE audit_pages (id TEXT PRIMARY KEY, audit_id TEXT NOT NULL REFERENCES audits(id) ON DELETE CASCADE, url TEXT NOT NULL, status_code INTEGER, is_indexable INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE audit_issues (id TEXT PRIMARY KEY, audit_id TEXT NOT NULL REFERENCES audits(id) ON DELETE CASCADE, page_url TEXT NOT NULL, issue_type TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'info');
        CREATE TABLE rank_tracking_configs (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, domain TEXT NOT NULL, serp_depth INTEGER NOT NULL);
        CREATE TABLE rank_check_runs (id TEXT PRIMARY KEY, config_id TEXT NOT NULL, project_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending');
        CREATE TABLE ai_trackers (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE ai_prompts (id TEXT PRIMARY KEY, tracker_id TEXT NOT NULL, topic TEXT NOT NULL, text TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE ai_runs (id TEXT PRIMARY KEY, tracker_id TEXT NOT NULL, project_id TEXT NOT NULL, trigger TEXT NOT NULL, status TEXT NOT NULL, location_code INTEGER NOT NULL, language_code TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE ai_observations (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, prompt_id TEXT NOT NULL, engine TEXT NOT NULL, branded INTEGER NOT NULL, status TEXT NOT NULL);
        CREATE TABLE ai_sources (id TEXT PRIMARY KEY, observation_id TEXT NOT NULL, url TEXT NOT NULL, domain TEXT NOT NULL, position INTEGER NOT NULL);
        CREATE TABLE rank_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, tracking_keyword_id TEXT NOT NULL, keyword TEXT NOT NULL, device TEXT NOT NULL, position INTEGER, checked_at TEXT NOT NULL);
      `);
      for (const migration of [
        "0056_careless_the_watchers.sql",
        "0068_unusual_princess_powerful.sql",
        "0069_colossal_blue_shield.sql",
        "0070_past_the_phantom.sql",
        "0072_previous_bushwacker.sql",
        "0073_overconfident_tattoo.sql",
        "0078_unknown_hammerhead.sql",
        "0080_nice_katie_power.sql",
        "0081_wandering_shinobi_shaw.sql",
        "0089_pale_lord_tyger.sql",
        "0090_charming_champions.sql",
        "0093_lowly_sentinel.sql",
        "0094_acoustic_ma_gnuci.sql",
        "0096_nebulous_korvac.sql",
        "0097_glossy_bug.sql",
        "0098_cultured_bruce_banner.sql",
        "0099_serious_rage.sql",
        "0100_overconfident_vector.sql",
        "0101_nosy_smasher.sql",
        "0102_flimsy_magik.sql",
        "0103_nervous_gabe_jones.sql",
      ])
        await sqlite.executeMultiple(
          readFileSync(`drizzle/sqlite/${migration}`, "utf8"),
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
