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
          "0063_tense_garia.sql",
          "0064_overrated_jack_murdock.sql",
          "0065_cuddly_hitman.sql",
          "0066_tearful_caretaker.sql",
          "0067_conscious_steve_rogers.sql",
        ])
          await database.client.executeMultiple(
            readFileSync(`drizzle/sqlite/${migration}`, "utf8"),
          );
    },
  };
}
