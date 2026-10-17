import { readFileSync } from "node:fs";
import { createPublishingTestDatabase } from "../../publishing/repositories/publishingTestDb";

export function createExperimentTestDatabase() {
  const database = createPublishingTestDatabase();
  return {
    ...database,
    prepare: async () => {
      await database.prepare();
      if (!database.isPostgres)
        for (const migration of [
          "0058_blue_terror.sql",
          "0062_cooing_triathlon.sql",
          "0074_nasty_lilandra.sql",
          "0075_freezing_menace.sql",
          "0076_messy_the_fury.sql",
        ])
          await database.client.executeMultiple(
            readFileSync(`drizzle/sqlite/${migration}`, "utf8"),
          );
    },
  };
}
