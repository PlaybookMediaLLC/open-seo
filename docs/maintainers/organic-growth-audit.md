# Organic growth platform: repository audit and delivery record

Audit date: October 14, 2026. Baseline: `d7ea7852`, app `0.1.13`.

## Decision

Build a separately branded, upstream-tracking product fork. Do not rewrite the research platform or sever Git history. The differentiated product is an evidence-backed execution and measurement workflow, not another keyword database. A hard fork becomes justified only when upstream changes repeatedly conflict with validated customer workflows or security maintenance can be owned independently.

This checkout's `origin` is `every-app/open-seo`, despite its local directory name. No organization fork has been created and no remote has been changed. Work stays on a local feature branch. Creating a public or private organization repository, choosing its visibility, installing a GitHub App, and publishing require the owner's authorization. Preserve `LICENSE`, including Ben Senescu's copyright notice. Use “Growth Operations” as the working feature name, not as a claim of trademark clearance or a finalized commercial brand. Production branding must replace upstream logos, domains, support destinations, billing products, telemetry destinations and deployment accounts deliberately, without renaming persisted resource identifiers.

## Architecture already present

```text
React 19 / Base UI / TanStack Router + Query
  -> TanStack server functions + global user/organization/project middleware
  -> feature services
  -> repositories
  -> provider-aware Drizzle schema + runBatch
  -> D1/SQLite (default) or Postgres/Hyperdrive

MCP tools and SAM chat -> the same feature services
Cloudflare cron -> rank checks, reconciliation and existing Workflows
Google OAuth -> encrypted GSC / GA4 grants -> project connection records
DataForSEO clients -> request context, metering, cache and billing guards
```

Evidence: `package.json`, `vite.config.ts`, `src/server.ts`, `src/serverFunctions/middleware.ts`, `src/db/{index,schema,runBatch}.ts`, `src/db/{d1,pg}/`, `wrangler*.jsonc` and `deploy/alchemy/`.

The locked package manager is pnpm 10.30.1. The manifest declares React 19, TypeScript 5.9, Drizzle 0.45, TanStack Start 1.168, Query 5.103, Zod 4, Better Auth 1.6, Vite 7, Vitest 4, and Cloudflare Workflows/Agents. Lockfile resolution, not a new stack, controls installation.

## Inventory status meanings

1. **Fully implemented and functioning**: existing code and observed local behavior or relevant passing tests. This does not imply a live credentialed provider was exercised.
2. **Partially implemented**: usable pieces exist but the requested end-to-end product workflow does not.
3. **Missing**: no implementation found in the audited surfaces.
4. **Implemented but requires improvement**: a functioning subsystem needs a specific extension or production safeguard for this mission.

No live Google, DataForSEO, paid AI, GitHub write, or deployment operation is included in this audit.

## Initial feature inventory

| Capability                                    | Baseline status                                            | Source evidence                                                                                                                                             | Required change                                                                                                                                                                                                                                               |
| --------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project-scoped application architecture       | Fully implemented and functioning in local tests           | `src/serverFunctions/middleware.ts`, `src/middleware/ensure-user/`, `src/server/features/projects/`                                                         | Reuse explicit project inputs and authenticated context for every new endpoint.                                                                                                                                                                               |
| SQLite/D1 and Postgres persistence            | Fully implemented and functioning in parity tests          | `src/db/index.ts`, `src/db/schema.ts`, `src/db/runBatch.ts`, `src/db/schema-parity.test.ts`, `drizzle/`                                                     | Add matching normalized tables and migrations in both dialects. Never call D1-only batch from new services.                                                                                                                                                   |
| Search Console connection and performance     | Fully implemented and functioning in mocked provider tests | `src/server/features/gsc/services/GscService.ts`, `src/server/lib/gscClient.ts`, `src/serverFunctions/gsc.ts`, `src/serverFunctions/searchPerformance.ts`   | Reuse connection and read-only grants. Persist bounded analytical evidence instead of issuing repeated reads on page visits. Live Google verification remains credential-dependent.                                                                           |
| Striking-distance analysis                    | Partially implemented relative to mission                  | `src/server/features/gsc/searchPerformanceReport.ts`                                                                                                        | Existing helper selects the best observed page per query at positions 5 through 20. Add materiality, business-context scoring, durable identity, evidence and review history. Do not rebuild this rule.                                                       |
| Search-performance comparisons                | Partially implemented relative to mission                  | `src/serverFunctions/searchPerformance.ts`, `src/server/features/gsc/searchPerformanceReport.ts`                                                            | Reuse `previousPeriod`; compare actual page aggregates, never treat absent top-N rows as zero traffic.                                                                                                                                                        |
| Business context, competitors and money pages | Fully implemented and functioning in local tests           | `src/db/project-context.schema.ts`, `src/server/features/project-context/`                                                                                  | Use explicit key-page roles as commercial relevance evidence. Unknown relevance must remain unknown, not AI-invented.                                                                                                                                         |
| Request refresh claims                        | Fully implemented and functioning in local tests           | `src/server/features/dashboard/repositories/DataRefreshClaimRepository.ts`                                                                                  | Reuse claims with bounded GSC work and cached run outcomes. Preserve fencing against expired owners.                                                                                                                                                          |
| Combined GSC + GA4 opportunity analysis       | Partially implemented                                      | `src/server/features/ga4/services/SearchOpportunityService.ts`, `src/server/mcp/tools/google-analytics-tools.ts`, `src/server/features/sam/samChatTools.ts` | Retain the existing `get_search_opportunities` tool. It requires both connections and scores joined rows from capped reports. New durable GSC-only workflow must not replace or silently change its scoring contract. Reuse it for optional later enrichment. |
| Persistent opportunity queue                  | Missing                                                    | No persisted queue/schema in baseline; the existing combined opportunity tool and search page return ephemeral analysis                                     | Add project-specific runs, opportunities, evidence, decisions, list/detail UI, stable identities and guarded transitions.                                                                                                                                     |
| Verified proposals and publishing approvals   | Missing                                                    | Existing project research and report artifacts are not executable proposals                                                                                 | Milestone 2 needs an immutable proposal revision, exact diff/base commit and separate authorization. Queue approval alone must never publish.                                                                                                                 |
| GitHub publishing                             | Missing                                                    | No project repository connection or PR execution lifecycle found in baseline                                                                                | GitHub App with selected repositories, short-lived scoped tokens, explicit branch and PR approval, static Next.js metadata adapter first.                                                                                                                     |
| Deployment-confirmed experiments              | Missing                                                    | Existing rankings and analytics are observations, not attributed experiments                                                                                | Separate merge from deploy confirmation. Save baseline, affected URLs, deployment time, observation window and documented inconclusive/negative/encouraging rules.                                                                                            |
| Project API budgets for autonomous jobs       | Partially implemented                                      | Existing billing/refresh primitives are not a per-project autonomous research budget                                                                        | No paid calls in Milestone 1. Add reservations, hard limits and reconciliation before paid recurring analysis.                                                                                                                                                |

Detailed supporting inventories: `organic-growth-seo-audit.md`, `organic-growth-platform-audit.md`, and `organic-growth-ui-agent-audit.md` in this directory. These distinguish code inspection from runtime verification.

## First deliverable specification

Milestone 1 is a deliberately bounded vertical slice: use the connected project's finalized Search Console data to detect striking-distance queries and material page declines, persist actual evidence, and let people review opportunities. Do not force five opportunities when evidence does not support five. Low CTR, content gaps, cannibalization, technical fixes and links stay out until their additional evidence is available.

- Reuse `GscService.getPerformance`, `buildStrikingDistanceRows`, `previousPeriod`, normalized key pages and the existing auth/DB/UI layers.
- Use equal 28-day windows with a three-day safety lag and `dataState: final`. Three bounded GSC queries: current query/page rows, current page rows, previous page rows. Maximum 1,000 rows each and 50 opportunities per run. Declare top-row and anonymized-query limitations.
- Striking distance: existing best-page rule, at least 100 impressions. Declines: both periods must contain the page, prior clicks at least 30, loss at least 20 clicks and 30 percent. Missing current rows are unknown, not zero. These are investigation candidates, not causal findings.
- Explain every score component. Commercial relevance comes from curated money/hub pages, not fabricated intent. Impressions are observed demand, not total keyword volume. Existing rank is a difficulty proxy, not a measured SEO difficulty metric. Confidence is capped when seasonality, brand or SERP composition is unverified.
- Persist runs, opportunities, evidence and review decisions as separate records. Property, detector type, exact URL and query define identity. Preserve user decisions on rediscovery. Record who reviewed which evidence revision. Defer with a date rather than a fake execution state.
- Support the full lifecycle vocabulary, but only permit real Milestone 1 transitions: discovered, reviewed, approved for proposal preparation, rejected, and deferral. Do not expose “implemented” or “measuring” controls without real execution.
- No paid API, AI model, GitHub account or publishing permission is required. Failed provider calls must leave a failed run, not an empty success. Existing saved results remain readable offline.
- UI: Opportunities navigation, project-specific priority queue, type/status/priority filters, details with evidence/score explanation, review controls, history and clear connection/error/empty states.

This work crosses more than eight files and adds one feature service. It does not introduce another orchestration or agent framework.

### Expected implementation surface

- `src/types/schemas/opportunities.ts`
- `src/db/opportunities.schema.ts`, `src/db/pg/opportunities.schema.ts`
- `src/db/schema.ts`, `src/db/{d1,pg}/schema.ts`, `src/db/schema-parity.test.ts`
- `drizzle/{sqlite,pg}/` generated migrations and metadata
- `src/server/features/opportunities/{services,repositories}/`
- `src/serverFunctions/opportunities.ts`
- `src/client/features/opportunities/`
- `src/routes/_app/p/$projectId/opportunities*` and the existing project navigation
- Focused service, real-SQL persistence and authorization tests

### Verification and rollback

Before changes: dependency installation succeeded, 229 test files / 1,596 tests passed, TypeScript passed, lint passed with zero warnings. Provider boundaries in those tests are mocked where specified in source. Browser and SQL verification are separate from these checks.

Run focused feature tests, full `pnpm test:ci`, `pnpm types:check`, `pnpm lint`, changed-file formatting, `pnpm knip`, `pnpm build`, both migration sets, and local browser flows. Existing live data or credentials are never needed for test fixtures. Clearly label synthetic fixtures. Removing feature navigation/endpoints rolls back code without destroying persisted evidence. Do not drop production tables as rollback.

## Next milestones and release gates

**Milestone 2:** selected-repository GitHub App installation, one static Next.js metadata change, immutable before/after diff tied to base SHA, framework validation, authorized PR creation with idempotency, failure record. No auto-merge and no deployment. User must authorize the actual repository installation and external write.

**Milestone 3:** authenticated PR/merge/deployment signals with deduplication, verified deployment baseline timing, GSC/GA4 measurement snapshots, outcome rules and caveats. A merge alone is not verified deployment. Harm can recommend a revert, never execute one without a fresh approval.

**Milestone 4 backlog:** CMS adapters after the GitHub contract proves stable, editorial workflow, recurring budgeted analysis, monitoring/alerts, portfolio reporting, delegated permissions, packaging and white-labeling. Do not ship these before the defining workflow works.

Commercial positioning is a product hypothesis, not proof of willingness to pay. Validate with founder-led SaaS design partners who already have meaningful GSC history and Git-based publishing. The initial success metric is approved useful improvements reaching production with traceable outcomes, not generated reports or guaranteed ranking gains.
