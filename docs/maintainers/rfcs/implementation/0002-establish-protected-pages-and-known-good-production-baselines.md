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
| `manual_day`, `manual_slot`                                   | text and integer 1–4, nullable; set only on `manual` runs                                                                            |

Unique (`enrollment_id`, `trigger`, `scheduled_at`); partial unique (`enrollment_id`, `manual_day`, `manual_slot`) where `manual_slot` is not null; index (`status`, `scheduled_at`).

**`page_snapshots`**

- **Keys:** `id`, `project_id`, `monitored_page_id` (FK cascade), `run_id` (FK cascade).
- **`fetched_at`:** text, not null.
- **`fetch_state`:** `page`, `response`, `unknown` or `truncated`.
  - `page` is a 200 HTML response with facts.
  - `response` is any other real response: a 3xx, a 4xx or 5xx, or a 200 that is not HTML. Its status, redirect flag and location are stored, and its facts are null. `comparePage` still raises `status-regressed` and `newly-redirected` from these, because it checks status before facts.
  - `unknown` covers no response (timeout or network error) and any response that `classifyFetch` (`src/server/lib/audit/classify-fetch.ts`) does not call `ok`. That includes 401, 403, 429, 202, `cf-mitigated` and challenge pages. A bot wall is an unknown check, never a status regression, as RFC-0019 section 7 requires.
  - `truncated` covers a body that hit the 2 MiB cap, or any value over its column bound.
  - `unknown` and `truncated` are never compared and count as unknown in the run.
- **Response:** `status` (nullable integer), `redirected` (boolean), `location` (nullable, at most 2000).
- **Robots and canonical:** `robots_header` (at most 500), `robots_meta` (at most 500), `canonical` (at most 2000).
- **Text:** `title` (at most 1000), `description` (at most 2000), `h1` (the first H1, at most 1000), `og_title` (at most 1000), `og_image` (at most 2000).
- **Counts:** `h1_count`, `internal_link_count`, `word_count`, `json_ld_valid_count`, `json_ld_invalid_count`.
- Every fact column is nullable and null unless `fetch_state` is `page`.

**`page_snapshot_values`**: `snapshot_id` (FK cascade), `kind` (`hreflang`, `json_ld_type`), `value` (at most 200). Primary key (`snapshot_id`, `kind`, `value`). At most 100 rows per snapshot; more makes the snapshot `truncated`. Repeated facts live here rather than in JSON, as RFC-0019 requires.

**`site_snapshots`**

| Column                                                     | Type and rule                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------- |
| `id`, `project_id`, `enrollment_id`, `run_id` (FK cascade) | text                                                                      |
| `fetched_at`                                               | text, not null                                                            |
| `robots_state`                                             | `ok`, `missing`, `unknown`, `truncated`                                   |
| `robots_txt`                                               | text, nullable, at most 64 KiB, so robots rules can be re-evaluated later |
| `sitemap_state`                                            | `ok`, `missing`, `unknown`                                                |
| `sitemap_url_count`                                        | integer, nullable                                                         |
| `sitemap_at_cap`                                           | boolean: discovery stopped at a limit, so the count is a lower bound      |

A discovery failure is `unknown`, never `missing`. If `discoverUrls` cannot tell a missing file from a failed fetch, add that distinction in `discovery.ts`, where both the audit and the monitor benefit.

`discoverUrls(origin, maxPages)` does not cap URLs at `maxPages`. It caps them at `min(max(maxPages * 20, 500), 50000)` and may fetch up to 300 sitemap documents of 10 MiB each. Extend it with an optional limits argument (maximum documents, maximum bytes per document, total time budget) whose defaults keep today's behavior for existing callers. The monitor calls `discoverUrls(origin, 50)`, which caps URLs at 1000, with at most 20 documents of 2 MiB each and a 60-second budget. Hitting any limit sets `sitemap_at_cap`. `sitemap-shrunk` is evaluated only when the current count is not at a cap.

**Baseline columns**

- `monitored_pages`: `baseline_snapshot_id` (nullable FK `page_snapshots`), `baseline_accepted_by`, `baseline_accepted_at`.
- `protection_enrollments`: `site_baseline_snapshot_id` (nullable FK `site_snapshots`).

Use Drizzle's `(): AnySQLiteColumn` form for the circular reference. An origin change clears every baseline.

## Fetching and runs

1. **Extend `fetchSnapshot`.** Add three optional fields to `Snapshot`; existing callers are unaffected:
   - `location`: the `Location` header of a 3xx;
   - `fetchClass`: from `classifyFetch(status, cf-mitigated header present, first 2 KiB of the body)`;
   - `truncated`: true when `readTextUpTo` stopped at the 2 MiB cap, which it does silently today. Move `inPool` to `src/server/lib/inPool.ts` with a concurrency argument and import it from both callers.
2. **Map snapshots in one place.** `snapshotRecord.ts` maps a `Snapshot` to a row plus value rows, and back with `toSnapshot(row, values)`. Because `comparePage` only counts links, `toSnapshot` rebuilds `internalLinks` as a placeholder array of the stored length; say so in a one-line comment.
3. **Execute runs in `MonitorRunService.execute(runId)`:**
   - Load the run, enrollment and active non-excluded pages.
   - Skip runs of `paused` or `ended` enrollments, with a reason.
   - Fetch each page as `production_origin + path` with `fetchSnapshot(url, null)`, after `isCrawlableUrl`, at most two concurrent requests.
   - Call `discoverUrls(origin, 50)` with the monitor limits above for the site snapshot.
   - Write snapshots with `runBatch` in chunks of at most 100 statements.
   - Finish with counts: `succeeded` when nothing was unknown, `partial` when some pages were, `failed` when all were or an error stopped the run.
   - A run is bounded to about 3 minutes: 20 pages at 10 s each, two at a time, plus 60 s of discovery. That stays inside both the 10-minute lease and the 4-minute tick budget, so a lease never expires on a run that is still working.
4. **Hook the tick.** `runProtectionMonitor(scheduledTime)` in `src/server/features/protection/monitorCron.ts` joins the `Promise.allSettled` list in `scheduled()` in `src/server.ts`, marked `// playbook-seam`. Each tick it does three things:
   - **Schedule:** for every `setup` or `active` enrollment past today's `check_hour_utc` with at least one accepted baseline, insert today's `schedule` run with `onConflictDoNothing`.
   - **Reclaim:** requeue runs whose lease expired once (`attempt` 2), then mark them `failed` with "interrupted".
   - **Claim:** claim due `queued` runs with a compare-and-set to `running` and a 10-minute lease, and execute them until a 4-minute tick budget is spent.
   - Add the new `src/server.ts` and `src/client/navigation/items.ts` seams to the seam registry comment in `vite-plugin-relay-brand.ts`.
5. **Manual checks.** `requestProtectionCheck` inserts a `manual` run for now into the first free slot from 1 to 4 for today's `manual_day`, using `onConflictDoNothing` and trying each slot in turn. All four taken means refused. The unique index is the fence, so concurrent requests can never exceed four. Show how many remain.
6. **Resume.** `paused`→`active` (IRFC-0001) queues a `schedule` run for now. Coverage reads "checks resuming" until that run finishes.
7. **Retention.** Runs on every tick, deleting at most 500 rows per tick, which is up to 144,000 a day:
   - Keep the 30 most recent snapshots per page within 90 days, as RFC-0019 requires, and delete the rest.
   - Never delete a baseline snapshot. IRFC-0003 adds snapshots, site snapshots and findings that an incident references.
   - Delete runs older than 90 days that no longer hold any snapshot or finding.

## Baseline

1. **Capture.** `captureProtectionBaseline` queues two `baseline` runs, one now and one ten minutes later. Baseline runs also run in `setup`.
2. **Match.** A page matches when both snapshots are `page` (a 200 HTML response) and `comparePage(first, second)` returns no findings.
3. **Find problems.** `baselineProblems(snapshot)` (pure) sorts problems into two groups:
   - **Blocking:** anything but a 200 HTML `page`, including a redirect, an error status, non-HTML, unknown or truncated. Such a page cannot get a baseline, because `comparePage` returns nothing when the baseline is not a 200. The owner excludes it with a reason instead, and coverage shows it as excluded, never as healthy.
   - **Acknowledgeable:** a missing title or description, `noindex` in the meta tag or `X-Robots-Tag`, an invalid JSON-LD block, or a canonical pointing to another path.
4. **Accept.** `acceptProtectionBaseline({ projectId, pageIds, acknowledgeProblems })` refuses pages without a matching pair or with a blocking problem. It refuses pages with acknowledgeable problems unless `acknowledgeProblems` is true. The dialog lists those problems; an intentionally non-indexable page is accepted this way. It sets each page's `baseline_snapshot_id` to the second snapshot and the site baseline to the second site snapshot, in one `runBatch` with a `protection.baseline_accepted` audit row.
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
  - a fifth manual check is refused, including when five requests arrive at once;
  - today's schedule run is inserted once per enrollment;
  - fetch states:
    - a 403, 429 or Cloudflare challenge page is `unknown`, not a status;
    - a 500 or a 301 is `response`, with its status and location stored;
    - a body at the 2 MiB cap is `truncated`;
  - resuming a paused enrollment queues one immediate check;
  - retention deletes beyond 30 snapshots per page but never a baseline.
- `discovery.test.ts` (extend): the new limits stop document fetches and set the at-cap flag, and existing callers get today's limits.
- `snapshotRecord.test.ts`: a `Snapshot` stored and rebuilt with `toSnapshot` gives `comparePage` the same findings as the original. This is the invariant the monitor depends on.
- `protectionBaseline.test.ts`, real SQL:
  - acceptance refuses unmatched pages;
  - it refuses a redirecting or non-200 page even with acknowledgement;
  - it refuses acknowledgeable problem pages without acknowledgement;
  - it sets page and site baselines atomically with one audit row;
  - an origin change clears baselines.
- `protectionCoverage.test.ts`: healthy, overdue, partial, needs-baseline and revoked-connection cases, plus the next-check time across midnight UTC.
- `pageSnapshot.test.ts`: a 3xx records `location`, a challenge response records its `fetchClass`, and the size cap sets `truncated`.

## Acceptance gate

On an authorized site, protect 5–20 pages. Capture and accept a baseline, including one acknowledged problem page. Let the daily check run, and run a manual check. On staging, make one page time out: the run is `partial`, the page shows unknown, and the enrollment shows degraded with that reason. Stop the cron for 26 hours (or fake the clock in a staging test): coverage shows overdue. Readiness `baseline` and `schedule` pass, and activation succeeds. Every protected URL shows its baseline time, last success and next check. Schema parity and the tenant tests pass on both dialects.

## Explicit boundary

No comparisons against the baseline, regression alerts, repairs or guessed commit-to-page provenance. No rendered checks.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- State what was tested with fixtures and what was tested on a live authorized site. Never treat a test fixture or an unmerged PR as a production result.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**. Do not block later unrelated work.

**Next:** [IRFC-0003](0003-confirm-deduplicate-and-explain-production-regressions.md)
