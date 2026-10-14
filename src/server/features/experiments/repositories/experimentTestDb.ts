import { readFileSync } from "node:fs";
import { createPublishingTestDatabase } from "../../publishing/repositories/publishingTestDb";

export function createExperimentTestDatabase() {
  const database = createPublishingTestDatabase();
  return {
    ...database,
    prepare: async () => {
      await database.prepare();
      if (!database.isPostgres)
        await database.client.executeMultiple(
          readFileSync("drizzle/sqlite/0058_blue_terror.sql", "utf8"),
        );
    },
  };
}
