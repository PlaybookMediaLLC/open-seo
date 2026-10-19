import * as Cloudflare from "alchemy/Cloudflare";
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
  // SEO checks in App mode (RFC-0010 5.12). Empty turns the webhook off.
  GITHUB_APP_WEBHOOK_SECRET: optionalSecret("GITHUB_APP_WEBHOOK_SECRET"),
  // Scheduled growth jobs on Trigger.dev (RFC-0008 5.2). Without a secret
  // the internal endpoints answer 404.
  GROWTH_JOBS_MODE: optionalVar("GROWTH_JOBS_MODE"),
  GROWTH_JOBS_SECRET: optionalSecret("GROWTH_JOBS_SECRET"),
  GROWTH_JOBS_SECRET_PREVIOUS: optionalSecret("GROWTH_JOBS_SECRET_PREVIOUS"),
  TRIGGER_SECRET_KEY: optionalSecret("TRIGGER_SECRET_KEY"),
  // Repository token encryption (RFC-0009 5.7). Empty keeps BETTER_AUTH_SECRET.
  PUBLISHING_TOKEN_KEY: optionalSecret("PUBLISHING_TOKEN_KEY"),
  PUBLISHING_TOKEN_KEY_VERSION: optionalVar("PUBLISHING_TOKEN_KEY_VERSION"),
  PUBLISHING_TOKEN_KEY_PREVIOUS: optionalSecret(
    "PUBLISHING_TOKEN_KEY_PREVIOUS",
  ),
  // Chrome UX Report field data (RFC-0014 5.2). Empty turns it off.
  CRUX_API_KEY: optionalSecret("CRUX_API_KEY"),
};

// Fork bindings of the app worker, created in the stack's own scope.
export const relayBindings = () => ({
  // RFC-0009 5.8: 30 paid actions a minute per user and feature
  // (src/server/billing/spendAdmission.ts). Other surfaces skip the check.
  PAID_ACTION_RATE_LIMIT: Cloudflare.RateLimit("PAID_ACTION_RATE_LIMIT", {
    namespaceId: 1002,
    simple: { limit: 30, period: 60 },
  }),
  // RFC-0010 5.10: 10 check requests a minute per CI token
  // (src/server/features/seo-checks/CheckApi.ts).
  CI_CHECK_RATE_LIMIT: Cloudflare.RateLimit("CI_CHECK_RATE_LIMIT", {
    namespaceId: 1003,
    simple: { limit: 10, period: 60 },
  }),
  // RFC-0010 5.13: rendered mode renders flagged pages in the SEO check
  // Workflow (src/server/features/seo-checks/seoCheckRender.ts).
  BROWSER: Cloudflare.Browser(),
});
