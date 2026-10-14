import { readFileSync } from "node:fs";
import { createOpportunityTestDatabase } from "../../opportunities/repositories/opportunityRepositoryTestDb";

export function createPublishingTestDatabase() {
  const slugPrefix = `publishing-test-${crypto.randomUUID()}-`;
  const database = createOpportunityTestDatabase(slugPrefix);
  return {
    ...database,
    slugPrefix,
    prepare: async () => {
      await database.prepare();
      if (!database.isPostgres)
        await database.client.executeMultiple(
          readFileSync("drizzle/sqlite/0057_youthful_dragon_lord.sql", "utf8"),
        );
    },
  };
}
