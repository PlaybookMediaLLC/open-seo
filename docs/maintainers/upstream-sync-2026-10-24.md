# Upstream sync: 2026-10-24

Relay imports 78 commits from `every-app/open-seo/main` on
`sync/upstream-2026-10-24-develop`. `develop` starts at the existing fork
`main` commit, as requested. This integration is prepared for review against
`develop`; it does not deploy or change `main`.

- Fork base: `f1fdba29d679bc722cbdce3fe3d2363d9b33c1bc`.
- Upstream tip: `2d8236a4fd5d799bf5c089187d0131f4dac4f38c`.
- Merge base: `d7ea7852480601af9bc8870942af8311a410e567`.
- Conflict resolution and local verification: 2026-10-24 18:23–18:39 UTC
  (approximately 17 minutes; two-hour sync budget).

## Integration decisions

Keep upstream's core changes, including local rank tracking, MCP widgets,
IndexNow, crawler signatures, consent, Google authorization improvements and
resumed rank checks. Preserve Relay's UI, branding, growth tools, audit
history, spend reservations, workflows and cron jobs. The obsolete paused
rank-check warning is removed. Google property selection keeps Relay's
existing picker and help components.

The agent setup cards and setup prompt lead to Relay's guides and instance,
including the custom ChatGPT connector flow. Upstream marketplace listings
point at upstream's hosted server. Plugin manifests retain Relay identity and
advance together to version `1.0.25`; the twelve shipped skills are synced.
The seam registry records the agent-link adaptation.

Existing SQLite and PostgreSQL migration histories and snapshots remain
byte-for-byte intact. The six incoming migrations in each dialect collide
with already-applied Relay migration numbers, so their schema changes are
appended as `0105_upstream_20261024.sql` (SQLite) and
`0083_upstream_20261024.sql` (PostgreSQL), with new snapshots and journal entries.
The changes add consent/signup fields, IndexNow configuration, local-rank
tables and project-scoped rank configuration indexes.

Regenerate the route tree from both route sets. Adapt the Relay Fumadocs
plugin to Vite 8's JSON transform order while retaining metadata validation.
Update SQL test fixtures for the new columns; the Local SEO integration
suite now migrates a full SQLite database. The website research billing
assertion follows Relay's settlement seam, including Context charges.

Keep the fork's existing PostgreSQL deployment command. `deploy:prod` aliases
that command; omit upstream's GitHub-dispatch `deploy:web` script. Imported
production/website workflows retain their upstream repository guards and are
inert in the fork. No deployment was run.

## Verification

- Application: 393 test files, 3,024 tests passed.
- Website: 32 tests passed, plus the concurrent free-tool spend protection check.
- Application and website production builds passed, including MCP widget assets,
  the audit worker, the eager-worker bundle guard, website prerendering and
  generation of its sitemap and 62 social cards.
- Application, bad-SEO fixture, report-widget and website TypeScript checks passed.
- Type-aware lint and Knip passed. Knip reports two non-blocking stale-ignore hints.
- In-memory SQLite: replay all 105 existing migrations, seed user/project data,
  then compare the appended migration with the six original upstream SQL files.
  Table/index definitions match, fixture data survives and foreign-key checks pass.
- In-memory PostgreSQL (PGlite): replay all 83 existing migrations, seed
  user/project data and compare both upgrade paths. Columns, indexes and
  constraints match, and fixture data survives.
- All existing migration SQL/snapshots and the prior journal entries were checked
  against the fork base; none were rewritten.

These checks ran locally on Node 24 with pnpm 10.30.1. GitHub CI also uses Node 22
and builds the self-host Docker image. Production credentials, remote databases
and deployment behavior were not exercised.

## Maintainer review

Review the imported `.agents/skills/**` and `.github/**` changes as required by
`AGENTS.md`, along with plugin version/instruction changes. In particular, the
setup skill keeps Relay's connection instructions. The technical RFC expansion
is preserved separately on `docs/relay-rfc-technical-design` at `4c9e7fc1` and
is not part of this upstream merge.

## Conflicted files

All 51 original conflicts are resolved:

- `.agents/PAPERCUTS.md`
- `.gitignore`
- `deploy/alchemy/alchemy.run.ts`
- `drizzle/pg/meta/0034_snapshot.json`
- `drizzle/pg/meta/0035_snapshot.json`
- `drizzle/pg/meta/0036_snapshot.json`
- `drizzle/pg/meta/0037_snapshot.json`
- `drizzle/pg/meta/0038_snapshot.json`
- `drizzle/pg/meta/0039_snapshot.json`
- `drizzle/pg/meta/_journal.json`
- `drizzle/sqlite/meta/0056_snapshot.json`
- `drizzle/sqlite/meta/0057_snapshot.json`
- `drizzle/sqlite/meta/0058_snapshot.json`
- `drizzle/sqlite/meta/0059_snapshot.json`
- `drizzle/sqlite/meta/0060_snapshot.json`
- `drizzle/sqlite/meta/0061_snapshot.json`
- `drizzle/sqlite/meta/_journal.json`
- `package.json`
- `plugins/openseo/.claude-plugin/plugin.json`
- `plugins/openseo/.codex-plugin/plugin.json`
- `plugins/openseo/.cursor-plugin/plugin.json`
- `pnpm-lock.yaml`
- `src/client/features/ai-mcp/AgentSetup.tsx`
- `src/client/features/ai-mcp/AgentSetupPanel.tsx`
- `src/client/features/ai-visibility/TrackerTrackingFields.tsx`
- `src/client/features/dashboard/DashboardPage.tsx`
- `src/client/features/integrations/GooglePropertyPicker.tsx`
- `src/client/features/onboarding/WebsiteOnboardingStep.tsx`
- `src/client/features/rank-tracking/RankTrackingDomainDetail.tsx`
- `src/client/features/rank-tracking/RankTrackingDomainList.tsx`
- `src/client/features/rank-tracking/ScheduledChecksPausedAlert.tsx`
- `src/db/d1/schema.ts`
- `src/db/pg/schema.ts`
- `src/db/schema-parity.test.ts`
- `src/db/schema.ts`
- `src/env.d.ts`
- `src/lib/auth-redirect.ts`
- `src/lib/auth.ts`
- `src/routeTree.gen.ts`
- `src/routes/__root.tsx`
- `src/routes/_app/p/$projectId/settings/integrations.tsx`
- `src/routes/_app/route.tsx`
- `src/routes/_auth.sign-up.tsx`
- `src/routes/_authenticated.onboarding.index.tsx`
- `src/server.ts`
- `src/server/features/projects/services/websiteResearch.ts`
- `src/server/lib/gscClient.test.ts`
- `src/server/mcp/server.ts`
- `src/serverFunctions/gsc.ts`
- `vite.config.ts`
- `wrangler.jsonc`
