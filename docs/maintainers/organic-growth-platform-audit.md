# Organic growth platform audit

Read-only source audit performed October 14, 2026. No tests, migrations, deployments, paid provider calls, or live infrastructure checks were performed. The code-review graph was attempted first and returned zero communities and edges, so file inspection was used. Repository status was clean at completion of the inspection. This document was subsequently written at the coordinator's explicit request.

## M1 conclusion

Normalized opportunities, evidence, decisions, and runs fit the existing server-function → service → repository architecture. Reuse authenticated project context, provider-aware schemas, `runBatch`, and the existing GSC service. M1 does not need a new billing system, OAuth implementation, or GitHub integration if it makes no paid API or AI calls.

Decide whether a run needs guaranteed eventual execution or only refresh throttling. The existing refresh claim is not a durable run ledger or outbox. The known paid-path limitations below are not blockers for unrelated no-paid M1 functionality, provided M1 does not invoke those paths.

## Guidance reviewed

- `AGENTS.md`
- `docs/maintainers/review-guidelines.md`
- `docs/maintainers/README.md`
- `docs/maintainers/specs/0001-project-scoping-for-server-functions.md`
- `docs/maintainers/runbooks/d1-to-postgres-simple.md`

## Authentication and tenant/project boundaries

### Existing implementation

- `src/start.ts` installs CSRF middleware for server functions and global function middleware.
- `src/middleware/ensureUser.ts` resolves identity and looks up a supplied project ID using `ProjectRepository.getProjectForOrganization`.
- `src/serverFunctions/middleware.ts` exposes `requireAuthenticatedContext` and `requireProjectContext`. The latter narrows already-authorized context; it is not itself the membership lookup.
- `src/middleware/ensure-user/hosted.ts` checks live organization membership instead of treating the session's active organization as an authorization fact.
- `src/server/auth/repositories/AuthRepository.ts` scopes `getMembership` by user and organization.
- `src/server/features/projects/repositories/ProjectRepository.ts` scopes active project lookup by project ID, organization ID, and non-archived status.
- `src/server/mcp/project-auth.ts` resolves user-scoped credentials against the project's organization membership, then rebinds downstream billing and telemetry identity. Organization-bound credentials remain organization-bound.
- `src/server/mcp/api-key-auth.ts` verifies API keys only on `/mcp`; these keys do not become browser sessions.
- `src/middleware/ensure-user/cloudflareAccess.ts` verifies JWT issuer and audience using JOSE/JWKS.
- `src/lib/auth-mode.ts` defaults invalid/unset modes to Cloudflare Access. `local_noauth` is an intentional trusted-local mode, not evidence of a hosted authentication bypass.

### M1 reuse requirements

Every opportunity, evidence, decision, and run lookup or mutation must include verified project scope, or authorize through a canonical parent first. Do not use a caller-provided organization as the billing or authorization identity. Server functions should validate explicit `projectId` and use `requireProjectContext`. MCP handlers should use `withMcpProjectAuth`.

No cross-tenant exploit was demonstrated by this audit. Representative boundary paths were inspected, not every repository method.

## Billing and budgets

### Existing implementation

- `src/server/lib/dataforseo/client.ts`: `createDataforseoClient` wraps hosted paid calls in reserve → execute → settle. The execution/settlement chain is registered with `waitUntil` when a request context exists.
- `src/server/billing/subscription.ts`: `holdCredits`, `reserveUsageCredits`, `finalizeHold`, and `settleUsageCredits` implement Autumn holds, monthly/top-up pools, actual-cost settlement, refusal handling, and retry behavior. Holds default to a 30-minute TTL. An uncertain admission retry reuses its lock ID.
- `src/server/features/ai-visibility/services/aiVisibilityRuns.ts`: `runCheck` recomputes price and rejects a manual request above its approved `maxCostUsd`.
- `src/lib/auth-config.ts`: self-serve organization creation and deletion are disabled to limit repeated onboarding-credit creation.
- `src/server/billing/autumn-webhook.ts`: verifies the raw payload before parsing and synchronizes current customer state for replay convergence.
- `src/server/billing/svix.ts`: HMAC verification and five-minute timestamp tolerance.

Spend controls are feature-specific. No general project execution-budget engine was identified in the inspected seams.

### Verified limitations

1. **Provider billing metadata can be lost on payload validation.** `src/server/lib/dataforseo/envelope.ts`, `parseTaskItems`, throws a plain `AppError` when an item payload fails validation. A concrete caller is `src/server/lib/dataforseo/backlinks.ts`, where `parseTaskItems` is evaluated before `buildTaskBilling`. The metering wrapper only recovers billing from `DataforseoChargedTaskError`; this failure path can therefore release a hold without accounting for provider-billed work. This is also recorded as known debt in `docs/maintainers/review-guidelines.md`.
2. **Settlement is not a durable reconciliation queue.** `src/server/billing/subscription.ts`, `settleUsageCredits`, logs and returns when finalization still fails after its retry. The hold eventually expires. `src/server/billing/researchSpend.ts` also logs metering failures instead of replaying uncertain non-idempotent charges. No durable retry ledger was present in these paths.
3. **LLM admission is not the same as an atomic DataForSEO reservation.** `src/server/features/ai-visibility/services/aiPromptSuggestions.ts` checks for depleted credits, then calls `generateText` without a hold. Concurrent requests can pass the same balance check. Output is bounded to 2,000 tokens and a 60-second timeout; settlement uses `billResearchSpend`, which permits overdraft for admitted work. This is a code-level concurrency limitation, not a measured abuse incident.

Do not extend these limitations into new paid functionality. They do not require unrelated fixes before a no-paid M1.

## Credential encryption and OAuth

### Existing implementation

- `src/lib/auth-config.ts` sets `account.encryptOAuthTokens=true`.
- `src/server/features/google/googleOAuth.ts` uses Better Auth symmetric encryption with `secretConfig` for stored access and refresh tokens, including refreshed tokens.
- `src/server/features/google/googleOAuthState.ts` uses a random 32-byte nonce, provider-bound identifier, ten-minute expiration, atomic delete-and-return single-use consumption, and HMAC-derived PKCE.
- `src/server/features/audit/services/CrawlerCredentialService.ts` encrypts crawler signature fields before database and Workflow persistence using a separate `CRAWLER_ACCESS_SECRET`. It exposes summaries rather than secret values, resolves credentials by organization/project/host, and decrypts only in memory.

These are reusable integration patterns, not a generic multi-provider credential vault. Crawler key rotation makes old signatures unreadable; the service explicitly falls back to unsigned crawling after decryption failure. No versioned crawler-key rotation mechanism was identified here.

## SSRF and outbound requests

`src/server/lib/audit/url-policy.ts` provides:

- `normalizeAndValidateStartUrl`: scheme, internal-host/private-literal checks and A/AAAA DNS-over-HTTPS screening.
- `resolveStartUrlRedirects`: manual redirects with validation of each new target.
- `isCrawlableUrl`: synchronous screening for discovered crawl URLs. Same-origin and crawl policy remain requirements at the caller.

**Residual limitation:** `hostnameResolvesToBlockedAddress` returns false on empty DNS answers and on exceptions. DNS validation and the later target fetch are separate resolutions, without address pinning in this helper. Consequently this helper alone does not establish DNS-rebinding resistance or private-network isolation. Actual exposure depends on deployment egress controls and runtime networking. This audit did not demonstrate an exploit or test live egress.

M1 should not introduce an arbitrary-URL fetch when the existing fixed-endpoint GSC integration already provides the needed data.

## Database dialects and migrations

### Existing implementation and required reuse

- `src/db/index.ts` and `src/db/schema.ts`: provider-aware database and schema exports.
- `src/db/*.schema.ts` and `src/db/pg/*.schema.ts`: paired dialect definitions.
- `drizzle/sqlite/` and `drizzle/pg/`: paired migrations.
- `src/db/runBatch.ts`: atomic D1 batch or Postgres transaction. Statements must be built using the callback's `tx`, not the outer database handle. `executeInBatches` is only atomic per chunk.
- `src/db/pg/client.ts`: request-scoped `withPgClient` using AsyncLocalStorage; database access outside scope fails explicitly.
- `src/server/workflows/pgStep.ts`: establishes Postgres scope within each persisted Workflow step.
- `src/db/schema-parity.test.ts`: checks structural parity, including foreign keys/delete behavior and unique/partial-index shape.

A new M1 schema module needs both dialects, raw schema barrel exports, migrations, and inclusion in parity coverage. Structural schema comparison is not equivalent to executing all migration SQL or queries on both live engines.

### Verified migration limitation

`scripts/migrate-d1-to-postgres.ts` explicitly does not synchronize deletions in its catch-up pass. Inserts/upserts copy source rows, and final validation compares table row counts rather than row contents. A live cutover can therefore retain a membership or token deleted from D1 after its initial copy. This is a migration procedure risk, not evidence that a current production database contains stale authorization records.

Before reusing this migration, freeze writes or explicitly reconcile deletions and validate sensitive rows. The script notes its original schema coupling and requires review against the current schema. The simple runbook's rollback switches back to untouched D1; it does not copy Postgres-era writes back. No migration was executed during this audit.

`docs/maintainers/runbooks/d1-to-postgres-simple.md` documents the production-specific hosted Postgres deployment, not general self-hosted Postgres support.

## Scheduling and durable work

### Existing implementation

- `wrangler.jsonc`: five-minute scheduling plus daily maintenance.
- `src/server.ts`: scheduled entry points establish Postgres scope.
- `src/server/features/rank-tracking/repositories/RankTrackingRepository.ts`, `claimDueConfig`: conditional update on config ID, project ID, active flag, and observed next-run timestamp.
- `src/server/features/rank-tracking/services/rankCheckRunGuards.ts`: insert-first admission, run ID equal to Workflow ID, startup grace, and stale-run reconciliation.
- `src/db/app.schema.ts` and `src/db/pg/app.schema.ts`: partial unique index enforcing one active rank run per configuration.
- `src/db/ai-visibility.schema.ts` and `src/db/pg/ai-visibility.schema.ts`: analogous active-run constraint.
- `src/server/features/rank-tracking/services/scheduledRankChecks.ts`: task-unit/time admission budgets, plan checks, and CAS restoration when another run is active.
- `src/server/features/ai-visibility/services/scheduledAiVisibility.ts`: answer/time admission budgets.
- `scripts/selfhost-scheduler.mjs`: serial five-minute local triggers, timeout, no immediate retry after an uncertain result.

### Delivery semantics

`scheduledRankChecks.ts` advances the schedule before starting a Workflow and deliberately leaves it advanced on a start error. `scheduledAiVisibility.ts` also advances before starting. A crash between claim and durable run creation has no outbox recovery in these functions. These are existing skip/backpressure choices, not guaranteed eventual delivery for every scheduled slot.

Do not copy this behavior into M1 if the product contract promises eventual execution of each scheduled run.

### Exact refresh-claim seam for M1

`src/server/features/dashboard/repositories/DataRefreshClaimRepository.ts`:

- `claim` inserts or conditionally updates a key for a matching organization when `nextAttemptAt` has expired.
- A successful claim creates a random token and a 180-second lease.
- `finish` updates by key and token, fencing an expired owner.

The key is globally unique. A new use should include project, operation, and the relevant window in its deterministic key. This is refresh throttling, not run/result persistence, a durable outbox, or exactly-once execution. A task exceeding 180 seconds can overlap a replacement owner. Use a suitable run constraint or durable orchestration when that matters.

## GSC reuse

`src/server/features/gsc/services/GscService.ts` already exposes `getConnection`, `getPerformance`, and `inspectUrls`. `setSite` checks the user's grant and verified property access. Reuse it instead of implementing token handling again.

Calling a service is not automatically cache-only. Inspect the selected method's provider/cache behavior before describing M1 as making no external provider calls. A restriction on paid APIs is different from a restriction on all GSC requests.

## GitHub integration

A search of `src` and `package.json` for GitHub/Octokit references found support links, documentation, fixtures, and workflow tests, but no application GitHub App/OAuth integration, installation/repository mapping, webhook handler, Octokit client, or issue/PR mutation service.

Existing repository automation:

- `.github/workflows/ci.yml`
- `.github/workflows/pr-preview.yml`
- `.github/workflows/docker-image.yml`
- `.github/workflows/sourcemaps.yml`

PR preview uses same-repository checks and is gated to `bensenescu/open-seo`. It is deployment automation, not a product integration to reuse for customer repositories.

A future GitHub integration can borrow credential and webhook boundary patterns, but needs provider-specific signature verification, installation permissions, repository mapping, and mutation approval. None is needed for no-GitHub-write M1.

## Deployment and CI

`.github/workflows/ci.yml` installs frozen dependencies and runs checks, Vitest, worker bundle build checks, website protection tests/type checks/build, and a Docker build.

`package.json`:

- `ci:check` includes formatting, Knip, TypeScript, Oxlint, and `sync-plugin-skills`. It is not strictly read-only.
- `deploy` applies remote D1 migrations before build/deploy.
- `deploy:postgres` applies Postgres migrations before hosted-prod Alchemy deployment.

`deploy/alchemy/alchemy.run.ts` owns bindings, cron configuration, and Hyperdrive wiring.

**Preview protection limitation:** `.github/workflows/pr-preview.yml` verifies Access protection after deployment. A failed verification does not automatically destroy the deployed stage; the job prints manual destruction instructions. It detects a missing protection configuration but is not a guarantee that an unprotected stage can never exist. The same-repository gates do prevent public-fork deployment through this workflow.

## Testing evidence and next commands

Tests were inspected, not run. Relevant existing suites include:

- `src/db/schema-parity.test.ts`
- `src/server/mcp/project-auth.test.ts`
- `src/server/auth/repositories/AuthRepository.query.test.ts`
- `src/server/features/gsc/services/GscService.test.ts`
- `src/server/billing/subscription.test.ts`
- `src/server/lib/dataforseo/client.test.ts`
- `src/server/lib/audit/url-policy.test.ts`
- `src/server/features/rank-tracking/services/scheduledRankChecks.test.ts`
- `src/server/features/ai-visibility/services/scheduledAiVisibility.test.ts`
- `src/server/lib/selfhost-scheduler.test.ts`

Suggested focused commands after implementation:

```sh
pnpm exec vitest run src/db/schema-parity.test.ts src/server/mcp/project-auth.test.ts src/server/auth/repositories/AuthRepository.query.test.ts src/server/features/gsc/services/GscService.test.ts
pnpm exec vitest run src/server/billing/subscription.test.ts src/server/lib/dataforseo/client.test.ts src/server/lib/audit/url-policy.test.ts src/server/features/rank-tracking/services/scheduledRankChecks.test.ts src/server/features/ai-visibility/services/scheduledAiVisibility.test.ts src/server/lib/selfhost-scheduler.test.ts
pnpm types:check
pnpm test:ci
```

Append focused M1 tests for cross-project resource IDs, stale claim tokens, concurrent run uniqueness, atomic writes, and dialect-compatible queries. `pnpm ci:check` should only be run when generated plugin synchronization writes are acceptable.

`tests/playwright.config.ts` starts a `local_noauth` fixture server. `pnpm test:e2e` is useful UI coverage, not hosted tenant-auth acceptance. The inspected CI workflow does not run Playwright or provision live Postgres/D1 migration tests. `vite.config.ts` runs unit tests in Node without booting the Cloudflare runtime.

## Audit limits

This is a representative source audit, not an exhaustive security certification. No live exploit, production incident, deployed configuration, provider balance, or migration outcome was verified. Risks above distinguish observed code behavior from deployment-dependent impact. No application source was changed by the audit.
