import * as Config from "effect/Config";
import { Redacted } from "effect";

// Playbook fork: worker settings that upstream does not have. alchemy.run.ts
// spreads this object into the app worker env with one seam line.
const optionalVar = (name: string) =>
  Config.string(name).pipe(
    Config.withDefault(""),
    Config.map((value) => value.trim()),
  );
const optionalSecret = (name: string) =>
  Config.redacted(name).pipe(Config.withDefault(Redacted.make("")));

export const relayDataEnv = {
  // GitHub App transport for publishing (RFC-0005 5.7).
  GITHUB_APP_ID: optionalVar("GITHUB_APP_ID"),
  GITHUB_APP_SLUG: optionalVar("GITHUB_APP_SLUG"),
  GITHUB_APP_CLIENT_ID: optionalVar("GITHUB_APP_CLIENT_ID"),
  GITHUB_APP_CLIENT_SECRET: optionalSecret("GITHUB_APP_CLIENT_SECRET"),
  GITHUB_APP_PRIVATE_KEY: optionalSecret("GITHUB_APP_PRIVATE_KEY"),
  // Scheduled growth jobs on Trigger.dev (RFC-0008 5.2). Without a secret
  // the internal endpoints answer 404.
  GROWTH_JOBS_MODE: optionalVar("GROWTH_JOBS_MODE"),
  GROWTH_JOBS_SECRET: optionalSecret("GROWTH_JOBS_SECRET"),
  GROWTH_JOBS_SECRET_PREVIOUS: optionalSecret("GROWTH_JOBS_SECRET_PREVIOUS"),
  TRIGGER_SECRET_KEY: optionalSecret("TRIGGER_SECRET_KEY"),
};
