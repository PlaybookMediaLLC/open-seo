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
};
