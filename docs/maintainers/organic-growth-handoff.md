# Organic Growth Platform: handoff to the next coding agent

Updated October 14, 2026, approximately 1:25 PM America/New_York.

## Current status (supersedes the sections below)

M0 through M3 are implemented, committed and locally verified with mocked providers. The M3 integration described as unfinished in sections 6 and 7 below is complete. See the "Milestone 3 delivery update" in `organic-growth-audit.md` for results, and `docs/EXPERIMENTS.md` for user guidance.

M3 commits, oldest first: `165f4549` schema and fenced repository, `8fb838c9` services and real-SQL tests, `ae8d99ef` experiments UI and Track results, `f8a5a701` list shows latest completed assessment, `9d17f2ab` docs, `e96623c8`/`160f2b5f` Pacific-date overlap, `dbddda5e` independent-review fixes. The independent security review required by section 7C is done and recorded in the audit. Final full suite: 248 files, 2,012 tests.

The only remaining milestone work is **section 7F, live acceptance**. It needs user authorization for a real GSC property and selected repository. The user merges and deploys, and real observations take about 38 days after deployment. Do not claim live acceptance from the mocked or synthetic evidence. No PR, push, deployment or paid request has been made.

The disposable Postgres 14 cluster (port 55483, data under `/Users/dyomba/.jcode/scratch/openseo-pg.IwbEYc`) has all migrations through `0036` applied and was stopped. Restart it as described in section 8 before running Postgres tests with `OPPORTUNITY_TEST_PG_URL`. Local D1 has migration `0058` applied. No `.env.local` remains. The existing Playwright suite requires a temporary `.env.local` containing `AUTH_MODE=local_noauth` (see the papercut).

---

## Historical handoff (M3 in progress)

## Copy-paste instruction

Continue the existing implementation in this checkout. Read this handoff, `AGENTS.md`, the audit, and the two feature specifications before editing. Do not restart the project or replace working OpenSEO research, authentication, Google integrations, billing, or MCP infrastructure. M0, M1, and M2 are committed and locally verified. M3 has intentionally unfinished, uncommitted work because the user requested a handoff at a context limit. Preserve that work, finish its missing integration and tests, then verify the complete workflow. Never claim live provider acceptance from mocks or synthetic browser fixtures. Do not create a real PR, deploy, spend paid credits, or change repository remotes without authorization.

## 1. Exact checkout and checkpoint

- Working directory: `/Users/dyomba/go/src/github.com/PlaybookMediaLLC/open-seo`.
- Branch: `feat/organic-growth-opportunities`.
- Original upstream baseline: `d7ea7852`.
- Last locally verified implementation checkpoint: **`6a4b05e8`**.
- `origin` still points to `ssh://git@github.com/every-app/open-seo.git`. No organization fork, push, PR, or deployment was performed.
- **The current worktree is not the validated checkpoint. It contains incomplete M3 code and documentation. Do not reset, clean, or discard it.**
- Recommendation remains a separately branded, upstream-tracking fork, not a hard break. Preserve MIT notices. Final commercial branding and remote ownership are still undecided.

Recent coherent commits, newest first:

```text
6a4b05e8 feat(growth): add reviewed GitHub connection proposal and execution UI
60d84c8b feat(growth): execute explicitly approved metadata pull requests with recovery
b9986cff feat(growth): add bounded GitHub transport with immutable tree verification
8b0fa5e8 feat(growth): persist fenced publishing proposals approvals and executions
46abb9e6 feat(growth): define approved publishing and static metadata proposals
223e61ee build(growth): declare existing Babel parser for safe metadata edits
f1d8cdc7 docs(growth): document opportunity workflow and verified delivery
89aa9bdd test(e2e): handle deferred setup dialogs and current filter labels
bc968f14 feat(growth): add project opportunity queue and evidence review
5a77de9b feat(growth): detect and review bounded GSC opportunities
328113d9 test(gsc): keep cancellation fixture type-aware lint clean
bc81e58d feat(growth): persist normalized opportunity evidence and decisions
c846501c test(gsc): prevent late queries after analysis cancellation
f86d3576 feat(gsc): support cancellation for bounded analysis requests
d4c94198 docs(growth): audit reuse boundaries and define the first milestone
```

## 2. Read these first

1. `AGENTS.md` and inherited repository instructions. Use graph tools first. The graph was empty during this session, so file search was used after checking it.
2. `docs/maintainers/organic-growth-audit.md`: baseline architecture, inventory, gaps, M1 evidence. **Its final paragraph refers to an M2 delivery update that has not yet been appended. This handoff is the current status authority.**
3. Supporting audits: `organic-growth-platform-audit.md`, `organic-growth-seo-audit.md`, `organic-growth-ui-agent-audit.md`, all under `docs/maintainers/`.
4. `docs/maintainers/specs/approved-github-metadata.md`: implemented M2 design.
5. `docs/maintainers/specs/search-outcome-measurement.md`: newly written, uncommitted M3 design.
6. User guides `docs/OPPORTUNITIES.md` and new `docs/GITHUB_PUBLISHING.md`. README and these docs have uncommitted M2 updates.

Reuse TanStack server functions -> services -> repositories, Drizzle dual dialects, Zod boundaries, Base UI components, existing organization permissions and refresh claims. No new orchestration service or agent framework. No plugin bump is required so far because no new MCP tool or shipped skill was added.

## 3. What M1 already does

Paths: `src/server/features/opportunities/`, `src/client/features/opportunities/`, `src/serverFunctions/opportunities.ts`, `src/types/schemas/opportunities.ts`, and `/p/$projectId/opportunities` routes.

- GSC-only detection, without GA4 or DataForSEO credentials.
- At most three Search Analytics queries, 1,000 rows each, 24-hour successful cache, project claim, cancellation and failure cooldown.
- Equal 28-day finalized periods ending three Pacific dates before today.
- Reuses existing striking-distance helper. Detects best observed page/query at positions 5 through 20 and conservative exact-URL page declines.
- Missing top-N rows are unknown, not zero. Truncation and uncertainty are persisted.
- Transparent heuristic priority, normalized evidence and decisions, stable identity, deduplication, filters and pagination.
- Members can research/read. Existing owner/admin integration-management permission controls review.
- Current-evidence review and approval, CAS version guards, property-change transaction fences, and expired-run retry.
- Approval here authorizes proposal preparation only, never publication.
- SQLite migration `0056_careless_the_watchers`, PG `0034_glossy_meltdown`.

## 4. What M2 already does

Paths: `src/server/features/publishing/`, its `repositories/`, `src/client/features/publishing/`, `src/serverFunctions/publishing.ts`, `src/types/schemas/publishing.ts`, paired publishing schemas.

- Explicit fine-grained GitHub PAT connection restricted by application to one selected repository/base branch. GitHub App transport is future work, not implemented.
- Requires an explicit stable `BETTER_AUTH_SECRET` of at least 32 characters. Uses Better Auth encryption and clears revoked credential ciphertext. Does not use a weak local fallback for publishing.
- Initial action is deliberately narrow: a human-written replacement for a direct static Next.js App Router `metadata.description` string. No AI-generated claims, arbitrary editing, title templates, dynamic metadata, or universal CMS layer.
- Parses with the already-installed Babel parser, now a declared direct dependency. Checks supported Next manifest and exact URL/file mapping. Reads immutable Git trees and blobs, rejects symlinks/submodules, bounds file size, verifies hashes and surrounding source preservation.
- Immutable proposal with before/after snippet, target, base commit, content hashes, reason, risk and verification plan. Static validation is explicitly not repository build/CI verification.
- Separate checkbox and confirmation for the exact proposal authorizes branch/commit/PR creation. Never auto-merges or deploys.
- Durable approvals, executions and checkpoints. Fenced claims, current evidence/source checks, latest-execution retry guard, exact existing-PR reconciliation, safe failure handling and explicit failed-to-reviewed recovery.
- Request limits, fixed GitHub API origin, bounded responses/deadlines, sanitized errors, no arbitrary private-repository browsing or source upload to an AI provider.
- Successful PR creation keeps the opportunity `in_progress`, not `implemented`.
- SQLite `0057_youthful_dragon_lord`, PG `0035_left_lady_bullseye`.
- Free opportunity and integrations routes no longer prompt for an unrelated DataForSEO key. Paid keyword research still does.

## 5. Verified evidence at the M2 checkpoint

These results were obtained before the incomplete M3 edits. They do not assert that the current dirty worktree builds.

- Full Vitest suite: **243 files, 1,945 tests passed**.
- `pnpm lint`: zero warnings/errors. `pnpm exec knip`: passed.
- `pnpm exec tsc --noEmit`: passed. `pnpm build`: passed.
- Existing Playwright suite: **11/11 passed**.
- Publishing repository suite: **35 tests passed against real SQLite and real disposable Postgres 14**. Schema parity: 279 tests passed at that point.
- `PublishingWorkflow.test.ts` passed against both real SQLite and Postgres after lint fixes. It exercises real connection/preparation/execution services, repositories, claims, encryption, parser, client and hashes. Only GitHub HTTP transport and the existing GSC connection-read boundary are mocked.
- M1 repository suite: 16 cases passed in both SQL dialects.
- Actual-browser M1 workflow: five explicitly synthetic persisted opportunities, evidence, review/approval, rejection, defer, wrong-project denial, cached detection with zero provider work, and expired-run retry. Exact fixture cleanup verified.
- Actual-browser M2: configuration-missing and revoked-connection states, immutable diff and execution history, desktop/mobile layout, no external requests/page errors, exact cleanup. Final run used no modal-dismiss handler and proved free routes have no DataForSEO prompt while the paid keyword route retains it.
- One intermediate existing filter-performance test timed out amid canonical navigation and a late setup dialog. Unchanged focused rerun and subsequent full 11-test run passed. Root cause was **not proven**. Do not call this fixed by an invented explanation or weaken performance assertions. Preserve failing trace/video before any future rerun.

Artifacts in `/Users/dyomba/.jcode/scratch/`:

```text
growth-m2-tests-final.log
growth-m2-lint-final.log
growth-m2-knip-final.log
growth-m2-build-final.log
growth-e2e-final.log
growth-e2e.log                  # earlier failed browser run
growth-perf-retry.log
opportunity-browser-verification/
publishing-browser-verification/report.json
publishing-browser-verification/01-config-missing-disconnected-desktop.png
publishing-browser-verification/02-revoked-proposal-history-desktop.png
publishing-browser-verification/03-revoked-proposal-history-mobile.png
publishing-browser-verification/04-failed-execution-mobile.png
publishing-browser-verification/05-paid-keyword-setup-preserved.png
```

**No live GSC opportunity detection, paid DataForSEO/AI request, private customer repository read, GitHub write, production deployment, or measured live SEO outcome was performed.**

## 6. M3 design already agreed and partially written

Read the full specification and `src/types/schemas/experiments.ts`; do not redesign from scratch.

- Register an experiment idempotently from a successful recorded PR execution.
- Read-only GitHub status refresh verifies repository, PR number, approved head commit and branches. A merged file must match the approved resulting blob at the merge commit.
- A merged PR is **not** a deployment. An administrator explicitly attests to production deployment, with timestamp, note, known other changes and seasonal-risk flags. Label this human-attested, not independently verified.
- Deployment timestamp cannot be future, older than 90 days at confirmation, or before verified merge. Confirmation and measurement windows are immutable.
- Pacific-calendar baseline: D-28 through D-1. Exclude D through D+6. Observe D+7 through D+34. Final-data allowance: today minus three Pacific dates.
- One exact-page, daily, finalized web Search Analytics request over at most 63 dates, row limit 100. OAuth refresh may additionally occur. Validate returned property and request dates; never silently accept GSC historical clamping.
- First successful refresh pins an immutable historical baseline. Its collection time is separate from the dates described. Do not claim it was collected before deployment.
- Later runs append observations, not replace the baseline. Missing dates are unreported, never zero-filled.
- Sum clicks/impressions, derive CTR from totals, weight average position by impressions.
- Directional outcome requires complete 28-day coverage each, baseline clicks >=100, impressions >=1,000 each, and click delta >=20 absolute AND >=20% relative. Known other changes, seasonal risk or overlapping tracked deployments force inconclusive. Labels are descriptive, not significance or causal claims.
- Negative results recommend investigation and potentially an authorized revert. No automatic revert.
- One existing project publishing lease serializes mutations. Reserve a measurement run before provider work. At most five attempts per project in rolling 24 hours, including failures. Successful cache 24 hours, failure cooldown five minutes, expired running claims retryable.
- Initial measurement trigger is manual. Scheduling, GA4 conversions/revenue and independently verified deployment adapters remain future work.

### M3 files currently present, uncommitted and not integration-verified

- `src/types/schemas/experiments.ts`: shared inputs/entities/results.
- `src/server/features/experiments/ExperimentService.ts`: list/get/register/status/deployment methods.
- `src/server/features/experiments/experimentPullStatus.ts`: read-only merge and blob verification.
- `src/server/features/experiments/MeasurementService.ts`: budget-admitted exact-page measurement.
- `measurementAnalysis.ts` and `measurementAnalysis.test.ts`: parser/aggregation/classification draft. Recheck worker evidence and run tests before trusting.
- Paired `src/db/experiments.schema.ts`, `src/db/pg/experiments.schema.ts`, barrel/parity edits.
- Generated, **not applied or validated**, migrations: SQLite `0058_blue_terror.sql`, PG `0036_clear_white_tiger.sql`, snapshots and journals.
- Repository helper drafts: `experimentSql.ts`, `experimentReads.ts`, `experimentRegistration.ts`, `confirmDeployment.ts`, `measurementRuns.ts`, `completeMeasurement.ts`.
- Six frontend drafts under `src/client/features/experiments/`: `queries.ts`, `ExperimentsPage.tsx`, `ExperimentDetailPage.tsx`, `ExperimentActions.tsx`, `DeploymentAttestation.tsx`, `MeasurementResults.tsx`.
- GitHub transport extension in `githubWrite.ts` plus fixture edit and new `githubMerge.test.ts`: required `mergedAt: string | null`, `mergeCommitSha: string | null`, strict timestamp/SHA parsing and contradictory merge-field rejection. Recheck validation before committing.

### Known missing or incorrect pieces at handoff

1. **`src/server/features/experiments/repositories/ExperimentRepository.ts` does not exist yet.** Services import it. Create the public repository object by reviewing and wiring the helper drafts, not by inventing a second persistence layer.
2. **`src/serverFunctions/experiments.ts` does not exist yet.** Frontend queries import its planned functions.
3. New experiment routes, navigation, route-tree generation, successful-PR “Track results” mount and AppShell free-route exemption were not completed. Inspect actual files before assuming any is mounted.
4. **`experimentReads.get` currently selects latest run of any status. Fix `ExperimentDetail.latestRun` to latest COMPLETED snapshot, matching `observationDays`.** `runs` must still contain newest 20 attempts of all statuses. Review list behavior too, so failure metadata is not paired with old metrics.
5. All M3 real-SQL tests/helpers are missing. Lifecycle and measurement service tests had only been assigned, not delivered. No M3 integrated/browser acceptance exists.
6. New coordinator service files still need formatting, type/lint review and independent correctness review. Do not treat generated schemas or helper drafts as migration proof.

## 7. Exact next implementation sequence

### A. Preserve and integrate the M3 draft

Run `git status --short`, read this handoff and the contracts, then inspect each unfinished helper. Do not delete the dirty worktree. Finish the repository API expected by the service files:

```text
list, get, getForExecution, getExecutionHistory
register, recordPullStatus, confirmDeployment
startRun, completeRun, failRun, hasOverlappingChanges
```

Use real transaction/claim fencing from `publishing/repositories/publishingSql.ts`. Preserve project/org and GSC-property locks, unique execution identity, immutable deployment/baseline, active repository identity and atomic row/run writes. Check the five-attempt cap under concurrent admissions, expired claim replacement, rollback, source changes, CAS losses, and cross-project IDs. Three normalized tables are drafted: experiments, runs, daily observations. The baseline run relationship uses a real FK.

### B. Wire server functions and routes

Follow `src/serverFunctions/publishing.ts` with existing project middleware and Zod validators:

```text
listExperiments -> ExperimentService.list
getExperiment -> ExperimentService.get
registerExperiment -> ExperimentService.register
refreshExperimentPullRequest -> ExperimentService.refreshPull
confirmExperimentDeployment -> ExperimentService.confirmDeployment
refreshExperimentMeasurements -> MeasurementService.refresh
```

Expected read contracts are already inferred by services/types. `connected` means matching GSC property. `githubConnected` is separate. Post-deployment measurement must keep working after GitHub disconnect; it must not require GitHub credentials or encryption configuration.

Add `/p/$projectId/experiments/` and `/$experimentId`, navigation label “Experiments & Results”, and a successful-execution “Track results” button that registers then navigates. Generate the route tree using the existing local generator. Extend only the relevant AppShell free-route check to include experiments.

### C. Add meaningful tests and review

- Pure analysis: correct windows, unknown missing dates, weighted metrics, threshold boundaries, confounders, non-causal language.
- Lifecycle: real project/member gates, idempotent registration, no provider call on registration, exact approved commit/repo/branch/PR/merged blob, missing/contradictory merge data, future/old/premerge deployment rejection, immutable confirmation, Pacific dates, lost claims and no remote writes.
- Measurement: no provider work for cache, unavailable property, missing deployment, too-early baseline, history outside retention, busy lease or failed budget admission. Assert reservation before exactly one final daily page-filter query, pinned baseline on subsequent runs, sanitized failure, response mismatch rejection, failed commit fence and release failure behavior.
- Real SQLite AND disposable Postgres repository tests, applying generated migrations. Reuse existing publishing SQL harness with unique fixture prefixes, never mock ORM chains.
- Integrated register -> verified merge -> deployment attestation -> baseline/observation -> cached refresh using real SQL and mocked provider HTTP. Distinguish this from live acceptance.
- Independent security review before calling M3 ready.

### D. Verify UI and full regressions

Run the real local app with clearly labeled synthetic fixtures and no provider writes. Verify list/detail, empty and disconnected states, immutable deployment confirmation, waiting/partial/full observations, negative/inconclusive results, source mismatch, permissions and mobile layout. Clean up only exact synthetic records. Preserve traces if a browser test fails.

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm exec knip
pnpm test
pnpm build
pnpm exec playwright test -c tests/playwright.config.ts
```

Run relevant formatting checks and both migration chains. Do not run overlapping Playwright servers on port 3101. Use the normal CI scripts where they differ; inspect `package.json` rather than guessing.

### E. Commit and document honestly

Commit focused schema/repository, service/test, UI and documentation slices once validated. Update the main audit with an M2 delivery update and then actual M3 results. Remove stale documentation saying M3 is absent only when it is truly functional. Record mocked vs live boundaries. Do not mark all milestones complete merely because UI compiles.

### F. Finish live acceptance with user authorization

Connect a real GSC property and verify real qualifying opportunities without fabricating five results. Configure stable encryption and an authorized selected-repository fine-grained token, prepare one supported description change, and use the UI's separate exact-PR approval. The user merges/deploys. Confirm actual deployment and collect actual historical/future observations as dates permit. A 28-day observation cannot be honestly completed immediately for a new deployment.

Only then prioritize M4: reliable recurring monitoring, GitHub App/deployment adapters, optional GA4 business outcomes, additional bounded changes, CMS adapters and portfolio workflows. Do not jump to a universal CMS, mass-content system or enterprise administration.

## 8. Environment cleanup and restart notes

- Temporary dev server on port 3001 was stopped at handoff.
- Temporary `.env.local` with `AUTH_MODE=local_noauth` and telemetry/devtools flags was deleted. Do not accidentally deploy local-noauth configuration.
- Disposable PG14 on port 55483 was stopped. Its data remains at `/Users/dyomba/.jcode/scratch/openseo-pg.IwbEYc/data`; the user's existing database on port 5432 was not touched.
- Disposable test URL, for tests only: `postgres://openseo_test@127.0.0.1:55483/openseo_growth_test`. Existing test harness uses `OPPORTUNITY_TEST_PG_URL` and guards the localhost test database name.
- Restart this specific disposable cluster only if needed, with PostgreSQL14 `pg_ctl`, port 55483 and socket directory `/Users/dyomba/.jcode/scratch/openseo-pg.IwbEYc`. Apply M3 migration before its PG tests. M2 migrations are already applied.
- Local D1 under `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/` has M1/M2 migrations. M3 migration has not been applied. Use repository migration scripts.
- Browser bridge was unavailable. Installed Playwright headless Chrome was used. Reusable scratch scripts: `opportunity-browser-verification.mjs` and `publishing-browser-verification.mjs` in the scratch directory.
- Prior workers were told to stop, preserve files and go idle. Do not assume their tasks are still running or resume overlapping ownership blindly.

## 9. Production gaps that still matter

The full product promise is not yet live-verified. Keep these explicit:

- MIT preserved, but final brand, domains, support destinations, telemetry ownership and commercial billing products still need deliberate setup.
- GSC/GA4/DataForSEO/MCP capabilities were reused, not rebuilt. The bounded new workflows do not establish universal account/project paid-API or AI budgets.
- Existing crawler SSRF/egress and accounting risks remain in the baseline audit. No arbitrary-URL crawler was added by these milestones.
- PAT transport is narrower than an autonomous agent but the product cannot prove a user did not overscope their token. GitHub App remains a future improvement.
- Static metadata validation is not a customer repository build. Approved PRs may trigger the customer's CI.
- No automatic publication, merge, deployment or revert. No causal SEO/revenue guarantees.
- No GA4 conversion/revenue measurement, autonomous agent workflow or recurring experiment scheduler is implemented by the M3 draft.
- The exact next milestone is **finish and verify M3**, not rebuild M1/M2 or claim the incomplete draft is done.
