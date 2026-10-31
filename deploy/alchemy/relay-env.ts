import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import { Redacted } from "effect";
import { z } from "zod";

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
  // Support topics from GitHub Issues (RFC-0017 5.4). Off unless "on".
  RELAY_SUPPORT_TOPICS: optionalVar("RELAY_SUPPORT_TOPICS"),
};

const flag = z.enum(["", "true", "false"]);
const otelSchema = z.object({
  OTEL_ENABLED: flag,
  // Traces and logs. Empty keeps 1%. Cloudflare samples per request.
  OTEL_SAMPLING_RATE: z
    .string()
    .transform((value) => (value ? Number(value) : 0.01))
    .pipe(z.number().min(0).max(1)),
  OTEL_LOGS_ENABLED: flag,
});

// Axiom APM (docs/maintainers/runbooks/axiom-apm.md). Cloudflare exports over
// OTLP to the "axiom-traces" and "axiom-logs" destinations of the account.
// Each switch is off by default, so other stages keep the upstream settings.
// A bad value stops the deploy.
export const relayObservability = <T extends object>(base: T) =>
  Effect.gen(function* () {
    const parsed = otelSchema.safeParse({
      OTEL_ENABLED: yield* optionalVar("OTEL_ENABLED"),
      OTEL_SAMPLING_RATE: yield* optionalVar("OTEL_SAMPLING_RATE"),
      OTEL_LOGS_ENABLED: yield* optionalVar("OTEL_LOGS_ENABLED"),
    });
    if (!parsed.success) {
      return yield* Effect.die(new Error(z.prettifyError(parsed.error)));
    }
    const otel = parsed.data;
    return {
      ...base,
      ...(otel.OTEL_ENABLED === "true" && {
        traces: {
          enabled: true,
          headSamplingRate: otel.OTEL_SAMPLING_RATE,
          destinations: ["axiom-traces"],
        },
      }),
      // Logs carry console messages, which can quote customer content (see
      // withoutMessage in src/server/lib/posthog.ts), so they have their own
      // switch. The rate also samples the logs that Cloudflare keeps.
      ...(otel.OTEL_LOGS_ENABLED === "true" && {
        logs: {
          enabled: true,
          invocationLogs: true,
          headSamplingRate: otel.OTEL_SAMPLING_RATE,
          destinations: ["axiom-logs"],
        },
      }),
    };
  });

// Fork bindings of the app worker, created in the stack's own scope.
export const relayBindings = () => ({
  // RFC-0009 5.8: 30 paid actions a minute per user and feature
  // (src/server/billing/spendAdmission.ts). Other surfaces skip the check.
  // Namespace ids must not repeat on this Worker: upstream's alchemy.run.ts
  // holds 1001 (MCP_RATE_LIMIT) and 1002 (AUTH_RATE_LIMIT).
  PAID_ACTION_RATE_LIMIT: Cloudflare.RateLimit("PAID_ACTION_RATE_LIMIT", {
    namespaceId: 1004,
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
