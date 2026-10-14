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

**Milestone 2:** selected-repository connection, one static Next.js description change, immutable before/after diff tied to base SHA, static framework validation, authorized PR creation with idempotency and failure recovery. The initial implementation uses an encrypted fine-grained token, with GitHub App transport deferred. See `specs/approved-github-metadata.md` for that decision. No auto-merge or deployment. Users must authorize repository access and each exact external write.

**Milestone 3:** authenticated PR/merge/deployment signals with deduplication, verified deployment baseline timing, GSC/GA4 measurement snapshots, outcome rules and caveats. A merge alone is not verified deployment. Harm can recommend a revert, never execute one without a fresh approval.

**Milestone 4 backlog:** CMS adapters after the GitHub contract proves stable, editorial workflow, recurring budgeted analysis, monitoring/alerts, portfolio reporting, delegated permissions, packaging and white-labeling. Do not ship these before the defining workflow works.

Commercial positioning is a product hypothesis, not proof of willingness to pay. Validate with founder-led SaaS design partners who already have meaningful GSC history and Git-based publishing. The initial success metric is approved useful improvements reaching production with traceable outcomes, not generated reports or guaranteed ranking gains.

## Milestone 1 checkpoint: October 14, 2026

### 1. Verified before implementation

The initial inventory above and the three supporting audits describe the actual baseline, not assumptions from the project description. Existing keyword research, audits, ranking, backlinks, AI visibility, GSC, GA4, SAM, MCP, project context, authentication and billing were retained. The existing combined GSC/GA4 opportunity report remains unchanged. Baseline installation, 1,596 tests, type checking and lint succeeded. No baseline provider test used live customer credentials.

### 2. Implemented

Work is on local branch `feat/organic-growth-opportunities`, with separate audit, cancellation, schema, backend and UI commits. Nothing was pushed to upstream or an organization repository.

- Bounded GSC-only detection, stable deduplication and the two documented opportunity types.
- Explicit commercial, demand, visibility, difficulty, effort and confidence score factors, with honest evidence limitations.
- Four normalized tables, matching SQLite and Postgres schemas, generated migrations and parity checks.
- Project-scoped server functions, service authorization, role-gated reviews, atomic version checks and evidence-linked decision history.
- Run records, cached success, project-level claims, a deadline, failure cooldowns and atomic publication of a complete detection result.
- Database fences against expired/replaced claims, changed source properties and concurrent review decisions. Approval now locks and checks the current source property inside its transaction rather than relying only on a service precheck.
- A real Opportunities navigation entry, filtered queue, detail evidence, review/approval/rejection/deferral and run history using the existing design system.
- Retry access after an abandoned run, read-only detection for members, and explicit language that approval does not publish or verify a code change.
- User documentation in `docs/OPPORTUNITIES.md`. The existing setup notice no longer implies that a DataForSEO key is required for GSC opportunities.

No new MCP tool or shipped skill was added, so no plugin version bump is required. No new external service, provider, orchestration platform or application dependency was introduced.

### 3. Verification results

| Check                              | Observed result                                                                                                                                            |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dependency installation            | `pnpm install --frozen-lockfile` passed.                                                                                                                   |
| Full unit/service/repository suite | `pnpm test --reporter=default`: 232 files, 1,668 tests passed. Same Vitest suite as `test:ci`, with a more readable reporter.                              |
| Production build                   | `pnpm build` passed, including TypeScript. Dependency annotation/chunk warnings remain non-fatal.                                                          |
| Type checking                      | `pnpm types:check` passed.                                                                                                                                 |
| Type-aware lint                    | `pnpm lint` passed with zero warnings and errors after fixes.                                                                                              |
| Unused-code analysis               | `pnpm knip` passed.                                                                                                                                        |
| Formatting                         | New feature files, paired schemas, user documentation and changed UI files passed Prettier checks.                                                         |
| SQLite/D1 migration                | The full local D1 migration chain, including `0056_careless_the_watchers`, applied successfully.                                                           |
| Postgres migration                 | The full migration chain, including `0034_glossy_meltdown`, applied to a disposable local Postgres 14 database. The user's existing database was not used. |
| Real SQL behavior                  | The same 16 repository tests passed on both SQLite and Postgres. These exercise real SQL, not ORM-chain mocks.                                             |
| Independent review                 | Three verified findings were fixed: abandoned-run retry, UI/API detection permissions, and concurrent source-property changes during approval.             |
| Browser workflow                   | Actual local application routes and D1 passed the workflow described below using clearly labeled synthetic fixtures.                                       |
| Existing browser regressions       | `pnpm test:e2e`: all 11 existing browser tests passed after fixing asynchronous setup-modal handling and two stale filter-copy locators.                   |

Intermediate failures were corrected rather than omitted: type-aware lint found mock typing and callback issues, additional tests exceeded the repository's file-length rule until duplicated fixture types were removed, and browser helpers queried the accessibility tree before a late setup modal had been dismissed. The two browser-harness issues are recorded in `.agents/PAPERCUTS.md`; the modal fix uses Playwright's scoped overlay handler instead of fixed sleeps or bypassing the application. Existing keyword navigation tests still log a handled missing-DataForSEO-key error for their separate SERP panel, which is not covered by the existing keyword fixtures. The navigation assertions pass, but this is not live SERP verification.

The temporary loopback dev server and disposable Postgres cluster were stopped after verification. The local-noauth `.env.local` created for this audit was removed. No customer credentials or production databases were changed.

### 4. What works end to end locally

Browser verification used isolated headless Chrome against the actual app and local D1. No server route was mocked. A uniquely named synthetic project, a connection mapping with no OAuth account or tokens, a fresh cached run, and five explicitly synthetic opportunities were seeded only for this check.

The browser verified: list five records; inspect evidence and score; mark reviewed; approve proposal preparation; verify the exact actor, evidence revision and incremented version in SQLite; reject another record; defer one for seven days; hide it from the default queue and reveal it with Include deferred; deny an opportunity ID under another existing project; and leave an expired running record retryable. Cached detection created no new run, claim or provider-request reservation. The browser recorded no external requests or page errors. All synthetic projects and dependent records were removed and cleanup was verified.

Separate browser checks covered disconnected and missing-record states, filters and URL state, integrations navigation, and desktop/mobile layouts, including a 390-pixel viewport without horizontal overflow. Screenshots and the detailed synthetic acceptance report are local artifacts under `$JCODE_SCRATCH_DIR/opportunity-browser-verification/`, plus `opportunities-*.png` in the scratch directory. They are not customer data and are not presented as live SEO results.

Detection itself is tested through the real service and detector with mocked Google responses, and persistence through real SQL. The browser's five seeded records do **not** prove that a real connected site currently has five qualifying opportunities.

### 5. Credentials and authorization still required

- A real GSC connection and sufficient finalized data are required to finish the live Milestone 1 acceptance check. Self-hosted Google OAuth uses the existing setup in `docs/SELF_HOSTING_GOOGLE_SEARCH_CONSOLE.md`; this feature adds no new secret.
- Creating the organization repository requires the intended owner, name and visibility. The current `origin` still targets upstream. No remote changes or public publication were made.
- Live Milestone 2 verification needs an authorized selected-repository fine-grained token and permission to create an explicitly approved pull request. A GitHub App is a later credential transport. No private repository was read and no GitHub write was attempted during verification.
- Deployment credentials and a trustworthy deployment signal are required for Milestone 3. GA4 is optional enrichment, not a requirement for this first detection workflow.

### 6. Unresolved production and security boundaries

This is a locally validated first milestone, not a commercially launched autonomous platform. The defining connect → proposal → PR → deploy → measured outcome acceptance test is not complete.

1. GSC OAuth, live Google responses, GitHub writes and production deployment were not live-tested. Do not describe them as verified by synthetic fixtures.
2. Paid autonomous analysis still needs project/account budget reservations, hard limits and durable reconciliation. The new GSC-only workflow avoids paid providers but does not repair all existing accounting limitations described in the platform audit.
3. Existing crawler SSRF/egress behavior and provider error/accounting gaps need separate production hardening before expanding autonomous access. This milestone adds no arbitrary-URL fetching or crawled-document agent instructions.
4. Detection remains bounded to top-row reports and conservative thresholds. It does not model seasonality, establish causation, verify SERPs or promise a traffic/revenue lift. An absent URL is not treated as zero performance.
5. Evidence and history retention are not yet a long-term archival policy. A production rollout needs operating limits and a retention decision based on actual customer volume.
6. “Growth Operations” is a working feature label. Distinct production branding, upstream attribution review, service destinations, billing products and production telemetry/deployment ownership remain release gates. `LICENSE` and upstream notices were preserved.
7. Existing member/reviewer roles are reused. Delegated execution permissions, agency administration and portfolio-wide approval authority have not been implemented.

### 7. Exact next milestone

At the M1 checkpoint, the next implementation was **Milestone 2: one approved static Next.js metadata pull request**. Work subsequently continued on that milestone without waiting for credentials. Missing credentials block live provider verification, not implementation. The M2 delivery update below supersedes this checkpoint's implementation status.

At the M1 checkpoint, Milestone 3 was planned to follow once that path was verified. It must distinguish a merged PR from a confirmed deployment, persist the pre-change baseline and observation window, and present measured differences with explicit attribution limits. Milestone 4 remains backlog, not hidden unfinished UI.

## Milestone 2 delivery update: October 14, 2026

Milestone 2 is implemented and locally verified. See `specs/approved-github-metadata.md` for the design and `docs/GITHUB_PUBLISHING.md` for user guidance.

- **Scope:** one encrypted fine-grained token per project, restricted by the application to a selected repository and base branch. The only supported change is a human-written replacement for a direct static Next.js App Router `metadata.description` string. GitHub App transport, dynamic metadata, title templates and AI-written copy are not implemented.
- **Safety:** immutable proposals bound to base commit, file and blob hashes. A separate exact-proposal approval authorizes branch, commit and pull request creation. Fenced durable executions and checkpoints, exact existing-PR reconciliation, explicit failed-to-reviewed recovery. No auto-merge, deployment or revert. A successful pull request leaves the opportunity in progress.
- **Verification at checkpoint `6a4b05e8`:** full Vitest suite 243 files and 1,945 tests, lint, Knip, type checking and build passed. Publishing repositories were tested against real SQLite and disposable Postgres 14. An integrated connect, prepare and execute test used real services, repositories, encryption and parser with only GitHub HTTP and the GSC connection read mocked. A real-browser check covered missing-configuration, revoked-connection, history and mobile states with synthetic records and exact cleanup. The existing Playwright suite passed 11/11.
- **Not verified live:** no private repository read, GitHub write, or real customer pull request.

One intermediate run of an existing filter-performance Playwright test timed out and passed on the unchanged rerun. Its root cause was not established.

## Milestone 3 delivery update: October 14, 2026

Milestone 3 is implemented and locally verified with mocked providers. See `specs/search-outcome-measurement.md` for the design and `docs/EXPERIMENTS.md` for user guidance.

### Implemented

- **Persistence:** three normalized tables, `growth_experiments`, `measurement_runs` and `measurement_days`, with a real foreign key from an experiment to its pinned baseline run. SQLite migration `0058_blue_terror` and Postgres migration `0036_clear_white_tiger`. Both were applied, to local D1 and to the disposable Postgres 14 cluster respectively.
- **Repository:** `ExperimentRepository` covers list, get, execution lookup, registration, pull request status, deployment attestation, run admission, completion, failure and overlap detection. Every write runs in one D1 batch or Postgres transaction fenced by the existing project publishing claim, project organization and current Search Console property.
- **Services:** idempotent registration from a succeeded execution with no provider call. A read-only GitHub refresh verifies repository, pull request number, head commit, branches and the merged blob. An immutable human deployment attestation must be at or after the verified merge, not in the future, and within 90 days, and it fixes Pacific windows D-28..D-1 and D+7..D+34. Measurement makes one exact-page, daily, finalized Search Analytics request and validates the returned property and dates. The first success pins the baseline, later runs append observations, and missing days stay unknown.
- **Budget:** the run is reserved before provider work. The 24-hour success cache, five-minute failure cooldown, five-attempt project budget per rolling 24 hours (including failures) and replacement of expired running claims are enforced inside the admission statement.
- **UI:** `/p/$projectId/experiments` list and detail, the "Experiments & Results" navigation entry, **Track results** on successful executions, deployment attestation, measurement refresh, run history and daily trends. The free-workflow AppShell check now excludes experiments from the DataForSEO prompt.

### Corrections made while integrating the draft

- Detail and list now report the newest **completed** run as `latestRun`, so a later failed attempt never pairs failure metadata with older metrics. `runs` still lists the newest 20 attempts of every status.
- The successful-execution list badge no longer shows "Refresh failed" in place of a valid saved assessment.

### Verification

- Full Vitest suite passed after the review fixes: 248 files and 2,012 tests.
- Real-SQL experiment suites (repository lifecycle, measurement runs and integrated workflow, 41 tests) passed against both in-memory SQLite with the generated migration and disposable Postgres 14 with the generated migration. Covered: idempotent registration, cross-project and stale-claim rejection, immutable verified merge, revoked connection, deployment rejected before merge, in the future, after a stale check, or twice. Also baseline pinning and rebaseline refusal, observation appending, latest-completed reads, error redaction, cache, cooldown, the five-attempt cap, expired-claim abandonment with late-write rejection, property change rollback and same-page overlap.
- The integrated workflow test uses real services, repositories, claims, encryption and the GitHub client with mocked GitHub HTTP and a mocked GSC service. It runs register, then open and merged status, rejected and accepted attestation, GitHub disconnect, a single measurement, and a cached refresh with no further provider calls. It also checks a tampered merged blob, member denial and cross-organization denial, and the no-request refusals.
- Type checking, lint, Knip, Prettier and production build passed. The existing Playwright suite passed 11/11 after recreating the local-noauth `.env.local` it needs (logged as a papercut).
- A real-browser check against the local app and D1 used three explicitly synthetic experiments with no GitHub token or GSC OAuth grant. It covered the list, awaiting-deployment with disabled GitHub actions, complete encouraging results with non-causal wording, partial and confounded results with Unknown days and a failed run, a wrong project, and a 390-pixel layout with no overflow. Page loads created no runs or claims, made no external requests and raised no page errors, and cleanup was exact. Artifacts are under `$JCODE_SCRATCH_DIR/experiment-browser-verification/`.

### Independent review

A separate reviewer agent read the M3 diff against `review-guidelines.md` and the measurement spec without editing code. It reported no high-severity findings. These were fixed with tests where they change behavior:

- **Medium:** deployment attestation and measurement completion overwrote the opportunity status with no prior-state guard, so they could silently undo a later human rejection. They now advance only `in_progress` to `implemented`, and `implemented`/`measuring`/`completed` onward. Real-SQL test added.
- **Low:** overlap detection compared UTC deployment dates with Pacific windows. It now compares the exact Pacific date. A boundary test fails on the old code.
- **Low:** a failed-run write was dropped when the Search Console property changed mid-run, leaving a stale running row. Failing a run no longer requires the current property.
- **Low:** the service-level cache check used the run start time while admission used the finish time. Both now use the finish time.
- **Low:** the pinned pull request link now also passes the shared `safeHttpUrl` sanitizer.

Accepted without change: Search Console rows are not cross-checked for clicks ≤ impressions. The reviewer confirmed project scoping, authorization, claim fencing, budget admission, immutability, merged-blob verification and secret handling.

### Not verified live

No live Search Console measurement, GitHub merge read, or production deployment was performed. The thresholds and labels were verified only on synthetic data. A real 28-day observation window cannot be completed until about 38 days after a real deployment.

### Remaining work

Live acceptance with an authorized GSC property and repository: prepare one supported change, approve its pull request, then let the user merge and deploy. After that, record the actual deployment and collect real observations as dates allow. Then Milestone 4: scheduled measurement, GitHub App and deployment adapters, optional GA4 outcomes, and additional bounded change types.
