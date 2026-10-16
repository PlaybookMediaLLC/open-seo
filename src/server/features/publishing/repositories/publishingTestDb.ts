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
        for (const migration of [
          "0057_youthful_dragon_lord.sql",
          "0059_fat_stephen_strange.sql",
          "0060_bright_sinister_six.sql",
          "0061_modern_iron_monger.sql",
        ])
          await database.client.executeMultiple(
            readFileSync(`drizzle/sqlite/${migration}`, "utf8"),
          );
    },
  };
}
