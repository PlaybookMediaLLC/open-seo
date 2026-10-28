# IRFC-0002: Establish protected pages and known-good production baselines

**Status:** Ready to build; specified against `develop` on 2026-10-28  
**Priority:** Required to reach the next core milestone  
**Prerequisites:** IRFC-0001  
**Canonical technical specification:** [RFC-0019](../0019-release-monitoring-and-regression-repair.md) phase 1a  
**Implementation order:** 0002 of 0032

## Implement this slice

Check each protected page on production every day and on request. Store bounded snapshots of what production served, let the owner accept a known-good baseline, and show coverage: every protected URL, its baseline, the last successful check, the next scheduled check, and any degraded or unknown state. This slice compares nothing and sends no regression alerts; IRFC-0003 does that.

Read RFC-0019 sections 4–6 in full. Inspect `develop` before writing code: reuse what is listed here, and update this file if the code has moved.

## What exists to reuse

| Need                      | Existing code                                                                                                                                                                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page fetch and facts      | `fetchSnapshot(url, access)` in `src/server/features/seo-checks/pageSnapshot.ts`: 10 s timeout, 2 MiB cap, redirects not followed, failure returns status `null`. `Snapshot` and `PageFacts` types in `seoRules.ts`                                        |
| URL policy                | `isCrawlableUrl` and `normalizeAndValidateStartUrl` (`src/server/lib/audit/url-policy.ts`)                                                                                                                                                                 |
| robots.txt and sitemap    | `discoverUrls(origin, maxPages, access?)` and `parseRobotsTxt` (`src/server/lib/audit/discovery.ts`)                                                                                                                                                       |
| Comparison (for matching) | `comparePage(base, preview, context)` in `seoRules.ts`. It reads only status, redirect flag, robots header, title, description, canonical, robots meta, first H1, H1 count, link count, hreflang set, valid JSON-LD count and types, og presence and words |
| Concurrency pool          | private `inPool` in `seo-checks/seoCheckRun.ts`                                                                                                                                                                                                            |
| Cron entry                | `scheduled()` in `src/server.ts`, which runs rank checks, AI visibility, growth jobs and first-audit emails side by side on every five-minute tick                                                                                                         |
| Notifications             | `GrowthJobRepository.notify(row)`: one row per (`project_id`, `kind`, `dedupe_key`), never re-sent; kinds are inline literals in `src/db/growth-jobs.schema.ts` and its pg twin                                                                            |
| Enrollment and pages      | IRFC-0001 tables and `ProtectionService`                                                                                                                                                                                                                   |

Growth schedules are not reused for checks. They allow one window per kind per day and run only when `growthJobsMode()` is `cron`, while confirmations in IRFC-0003 need five-minute due times in every mode.

## Data model

Extend `src/db/protection.schema.ts` and the pg twin; generate both migrations. Add enum arrays to `src/shared/protection.ts`.

**`monitor_runs`**

| Column                                                        | Type and rule                                                                                                                        |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `id`, `project_id` (FK cascade), `enrollment_id` (FK cascade) | text                                                                                                                                 |
| `scope_version`                                               | integer, not null                                                                                                                    |
| `trigger`                                                     | `MONITOR_TRIGGERS` = `schedule`, `manual`, `baseline`. IRFC-0003 adds `deployment` and `confirmation`; IRFC-0006 adds `verification` |
| `status`                                                      | `MONITOR_RUN_STATUSES` = `queued`, `running`, `succeeded`, `partial`, `failed`, `skipped`                                            |
| `scheduled_at`                                                | text, not null                                                                                                                       |
| `started_at`, `finished_at`, `lease_expires_at`               | text, nullable                                                                                                                       |
| `attempt`                                                     | integer, not null, default 1                                                                                                         |
| `required_count`, `checked_count`, `unknown_count`            | integer, not null, default 0                                                                                                         |
| `error`                                                       | text, nullable, at most 500 characters, stored through `safeError` (move it out of `GrowthJobService.ts` so both callers share it)   |
| `requested_by`                                                | text, nullable: the user for `manual` and `baseline` runs                                                                            |

Unique (`enrollment_id`, `trigger`, `scheduled_at`); index (`status`, `scheduled_at`).

**`page_snapshots`**

- **Keys:** `id`, `project_id`, `monitored_page_id` (FK cascade), `run_id` (FK cascade).
- **`fetched_at`:** text, not null.
- **`fetch_state`:** `ok`, `unknown`, `not_html` or `truncated`.
  - A `null` status is `unknown` (a timeout, network error or blocked fetch), never an invented status code.
  - `truncated` covers a body at the 2 MiB cap and any value over its column bound.
  - Only `ok` snapshots are compared.
- **Response:** `status` (nullable integer), `redirected` (boolean), `location` (nullable, at most 2000).
- **Robots and canonical:** `robots_header` (at most 500), `robots_meta` (at most 500), `canonical` (at most 2000).
- **Text:** `title` (at most 1000), `description` (at most 2000), `h1` (the first H1, at most 1000), `og_title` (at most 1000), `og_image` (at most 2000).
- **Counts:** `h1_count`, `internal_link_count`, `word_count`, `json_ld_valid_count`, `json_ld_invalid_count`.
- Every fact column is nullable and null unless `fetch_state` is `ok`.

**`page_snapshot_values`**: `snapshot_id` (FK cascade), `kind` (`hreflang`, `json_ld_type`), `value` (at most 200). Primary key (`snapshot_id`, `kind`, `value`). At most 100 rows per snapshot; more makes the snapshot `truncated`. Repeated facts live here rather than in JSON, as RFC-0019 requires.

**`site_snapshots`**

| Column                                                     | Type and rule                                                               |
| ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| `id`, `project_id`, `enrollment_id`, `run_id` (FK cascade) | text                                                                        |
| `fetched_at`                                               | text, not null                                                              |
| `robots_state`                                             | `ok`, `missing`, `unknown`, `truncated`                                     |
| `robots_txt`                                               | text, nullable, at most 64 KiB, so robots rules can be re-evaluated later   |
| `sitemap_state`                                            | `ok`, `missing`, `unknown`                                                  |
| `sitemap_url_count`                                        | integer, nullable                                                           |
| `sitemap_at_cap`                                           | boolean: the count hit `MONITOR_SITEMAP_CAP = 1000`, so it is a lower bound |

A discovery failure is `unknown`, never `missing`. If `discoverUrls` cannot tell a missing file from a failed fetch, add that distinction in `discovery.ts`, where both the audit and the monitor benefit.

**Baseline columns**

- `monitored_pages`: `baseline_snapshot_id` (nullable FK `page_snapshots`), `baseline_accepted_by`, `baseline_accepted_at`.
- `protection_enrollments`: `site_baseline_snapshot_id` (nullable FK `site_snapshots`).

Use Drizzle's `(): AnySQLiteColumn` form for the circular reference. An origin change clears every baseline.

## Fetching and runs

1. **Extend `fetchSnapshot`.** Return the `Location` header of a 3xx as an optional `location` on `Snapshot`; existing callers are unaffected. Move `inPool` to `src/server/lib/inPool.ts` with a concurrency argument and import it from both callers.
2. **Map snapshots in one place.** `snapshotRecord.ts` maps a `Snapshot` to a row plus value rows, and back with `toSnapshot(row, values)`. Because `comparePage` only counts links, `toSnapshot` rebuilds `internalLinks` as a placeholder array of the stored length; say so in a one-line comment.
3. **Execute runs in `MonitorRunService.execute(runId)`:**
   - Load the run, enrollment and active non-excluded pages.
   - Skip runs of `paused` or `ended` enrollments, with a reason.
   - Fetch each page as `production_origin + path` with `fetchSnapshot(url, null)`, after `isCrawlableUrl`, at most two concurrent requests.
   - Call `discoverUrls(origin, MONITOR_SITEMAP_CAP)` for the site snapshot.
   - Write snapshots with `runBatch` in chunks of at most 100 statements.
   - Finish with counts: `succeeded` when nothing was unknown, `partial` when some pages were, `failed` when all were or an error stopped the run.
4. **Hook the tick.** `runProtectionMonitor(scheduledTime)` in `src/server/features/protection/monitorCron.ts` joins the `Promise.allSettled` list in `scheduled()` in `src/server.ts`, marked `// playbook-seam`. Each tick it does three things:
   - **Schedule:** for every `setup` or `active` enrollment past today's `check_hour_utc` with at least one accepted baseline, insert today's `schedule` run with `onConflictDoNothing`.
   - **Reclaim:** requeue runs whose lease expired once (`attempt` 2), then mark them `failed` with "interrupted".
   - **Claim:** claim due `queued` runs with a compare-and-set to `running` and a 10-minute lease, and execute them until a 4-minute tick budget is spent.
5. **Manual checks.** `requestProtectionCheck` queues a `manual` run for now. Allow at most four per enrollment per UTC day, and show how many remain.
6. **Retention.** On the 03:30 UTC tick:
   - Delete page and site snapshots older than 90 days unless they are a baseline (IRFC-0003 adds "or referenced by an incident").
   - Delete runs older than 90 days with no remaining snapshots.
   - Bound each tick to 500 rows.

This skips RFC-0019's 30-per-page cap: daily checks stay within it.

## Baseline

1. **Capture.** `captureProtectionBaseline` queues two `baseline` runs, one now and one ten minutes later. Baseline runs also run in `setup`.
2. **Match.** A page matches when both snapshots are `ok` and `comparePage(first, second)` returns no findings.
3. **Find problems.** `baselineProblems(snapshot)` (pure) lists absolute problems: status not 200, redirected, title or description missing, `noindex` in the meta tag or `X-Robots-Tag`, an invalid JSON-LD block, or a canonical pointing to another path.
4. **Accept.** `acceptProtectionBaseline({ projectId, pageIds, acknowledgeProblems })` refuses pages without a matching pair. It refuses pages with problems unless `acknowledgeProblems` is true; the dialog lists the problems, and an intentionally non-indexable page is accepted this way. It sets each page's `baseline_snapshot_id` to the second snapshot and the site baseline to the second site snapshot, in one `runBatch` with a `protection.baseline_accepted` audit row.
5. **New pages.** A page added later has no baseline, shows **needs baseline**, and is covered by the next capture.

Automatic promotion of newer baselines is deferred. Intentional changes are accepted explicitly through IRFC-0003.

## Coverage and readiness

`protectionCoverage(input)` is a pure function that returns:

- **Per page:** baseline state, last check result and time, and last successful check time.
- **For the enrollment:** `healthy` or `degraded`, with one reason. It is degraded when any of these hold:
  - no `schedule` run has succeeded in 26 hours ("checks are overdue");
  - the last run was `failed`, or `partial` (name the unknown pages);
  - an active page lacks a baseline;
  - pull requests are allowed but the publishing connection is revoked.
- **Next check:** the next due check time.

IRFC-0001's readiness items become real:

- **`baseline`** passes when every active page has an accepted baseline.
- **`schedule`** passes when a `schedule` run succeeded within 26 hours.

When an active enrollment's `schedule` run ends `failed` or `partial`, call `GrowthJobRepository.notify` with the new kind `protection_degraded` (add it to both schema literals) and `dedupeKey` `${enrollmentId}:${date}`, so at most one notification goes out per day.

## Interface

- New page `src/routes/_app/p/$projectId/protection/index.tsx` with `src/client/features/protection/ProtectionPage.tsx`, and a **Protection** item in `src/client/navigation/items.ts` (`// playbook-seam`).
- **Header:** the status (`Setup`, `Active`, `Degraded`, `Paused` or `Ended`) and the reason.
- **Summary:** "N pages · last successful check … · next check …", and **Check now** with the remaining count.
- **Baseline panel:** capture, then waiting for the confirmation, then a review table (path, matching, problems), then **Accept baseline**.
- **Pages table:** path, baseline, last result, last checked, last success. An unknown result says why.
- **Run history:** the last 20 runs, with trigger, status, counts and error.
- No enrollment shows an `EmptyState` linking to the settings tab.

## Tests

- `monitorRun.test.ts`, real SQLite and Postgres with a faked `fetch`:
  - snapshots store bounded values;
  - a timeout stores `unknown` with a null status;
  - mixed results end `partial`;
  - two claimers execute a run once;
  - an expired lease is requeued once, then fails;
  - paused enrollments are skipped;
  - a fifth manual check is refused;
  - today's schedule run is inserted once per enrollment.
- `snapshotRecord.test.ts`: a `Snapshot` stored and rebuilt with `toSnapshot` gives `comparePage` the same findings as the original. This is the invariant the monitor depends on.
- `protectionBaseline.test.ts`, real SQL:
  - acceptance refuses unmatched pages;
  - it refuses problem pages without acknowledgement;
  - it sets page and site baselines atomically with one audit row;
  - an origin change clears baselines.
- `protectionCoverage.test.ts`: healthy, overdue, partial, needs-baseline and revoked-connection cases, plus the next-check time across midnight UTC.
- `pageSnapshot.test.ts`: a 3xx records `location`.

## Acceptance gate

On an authorized site, protect 5–20 pages. Capture and accept a baseline, including one acknowledged problem page. Let the daily check run, and run a manual check. On staging, make one page time out: the run is `partial`, the page shows unknown, and the enrollment shows degraded with that reason. Stop the cron for 26 hours (or fake the clock in a staging test): coverage shows overdue. Readiness `baseline` and `schedule` pass, and activation succeeds. Every protected URL shows its baseline time, last success and next check. Schema parity and the tenant tests pass on both dialects.

## Explicit boundary

No comparisons against the baseline, regression alerts, repairs or guessed commit-to-page provenance. No rendered checks.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- State what was tested with fixtures and what was tested on a live authorized site. Never treat a test fixture or an unmerged PR as a production result.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**. Do not block later unrelated work.

**Next:** [IRFC-0003](0003-confirm-deduplicate-and-explain-production-regressions.md)
