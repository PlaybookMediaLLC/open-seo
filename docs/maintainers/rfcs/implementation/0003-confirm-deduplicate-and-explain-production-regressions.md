# IRFC-0003: Confirm, deduplicate, and explain production regressions

**Status:** Ready to build; specified against `develop` on 2026-10-28  
**Priority:** Required to reach the next core milestone  
**Prerequisites:** IRFC-0002  
**Canonical technical specification:** [RFC-0019](../0019-release-monitoring-and-regression-repair.md) phase 1b  
**Implementation order:** 0003 of 0032

## Implement this slice

Compare every production check with the accepted baseline using the existing rules. Confirm a candidate with a second observation before opening an incident, and keep one incident per failing fingerprint. Discover production deployments so checks run after releases. Alert the reviewer once per confirmed blocking incident, show the before/after evidence and suspected cause, and offer a ticket. Nothing here edits source.

Read RFC-0019 sections 6–9 in full. Inspect `develop` before writing code: reuse what is listed here, and update this file if the code has moved.

## What exists to reuse

| Need                  | Existing code                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rules                 | `comparePage` and `compareSite` in `src/server/features/seo-checks/seoRules.ts`, with the `Finding` type. Blocking rules: `newly-redirected`, `status-regressed`, `newly-noindex`, `canonical-changed`, `title-removed`, `description-removed`, `json-ld-invalid`, `robots-txt-blocks`, `sitemap-shrunk`. Warnings: `title-changed`, `description-changed`, `h1-changed`, `multiple-h1`, `internal-links-dropped`, `hreflang-changed`, `og-removed`, `content-shrunk` |
| robots evaluation     | `robots-parser` with user agent `Googlebot`, as `seoCheckPlan.ts` does                                                                                                                                                                                                                                                                                                                                                                                                |
| Deployment reads      | `createGithubSignals(request)` in `src/server/features/publishing/githubSignals.ts` (`listDeployments(sha)`, `listDeploymentStatuses(id)`); `connectedGithub` in `publishingAccess.ts`; `PublishingRepository.getConnection`                                                                                                                                                                                                                                          |
| Notifications         | `GrowthJobRepository.notify`; email through `sendProtectionAlertEmail` (IRFC-0001)                                                                                                                                                                                                                                                                                                                                                                                    |
| GitHub issues         | `GithubIssueService.preview` and `create`, `claimTicket` and `completeTicket` (`publishing/repositories/opportunityTickets.ts`), and the `<!-- Relay ticket:{hash} -->` marker                                                                                                                                                                                                                                                                                        |
| Runs, snapshots, cron | IRFC-0002 (`monitor_runs`, `page_snapshots`, `toSnapshot`, `runProtectionMonitor`)                                                                                                                                                                                                                                                                                                                                                                                    |

## Data model

Extend `src/db/protection.schema.ts` and the pg twin; generate both migrations.

- **`MONITOR_TRIGGERS`** gains `deployment` and `confirmation`.
- **`monitor_runs`** gains:
  - `deployment_id` (nullable integer) and `deployment_sha` (nullable text);
  - `confirms_run_id` (nullable FK `monitor_runs`): the run whose candidates this one confirms;
  - `coalesced_count` (integer, default 0): deployments folded into this run.
- **`protection_enrollments`** gains the deployment cursor: `last_deployment_id` (nullable integer) and `last_deployment_seen_at`.

**`monitor_findings`**: one row per finding per run.

| Column                                    | Type and rule                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `id`, `project_id`, `run_id` (FK cascade) | text                                                                                                                |
| `monitored_page_id`                       | nullable FK; null for site rules                                                                                    |
| `subject_key`                             | text, not null: the page ID, or `robots`, or `sitemap`                                                              |
| `rule`, `severity`, `message`             | from `Finding`                                                                                                      |
| `before_value`, `after_value`             | text, nullable, at most 500                                                                                         |
| `fingerprint`                             | text, not null: SHA-256 of `project_id`, `subject_key`, `rule` and the baseline snapshot ID it was compared against |
| `disposition`                             | `FINDING_DISPOSITIONS` = `candidate`, `confirmed`, `transient`, `superseded`                                        |

Index (`project_id`, `fingerprint`).

**`site_regressions`**: the incident.

| Column                                                                | Type and rule                                                                                                                            |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `project_id` (FK cascade), `enrollment_id` (FK cascade)         | text                                                                                                                                     |
| `monitored_page_id`, `subject_key`, `rule`, `severity`, `fingerprint` | as in findings                                                                                                                           |
| `baseline_snapshot_id`, `site_baseline_snapshot_id`                   | the baseline compared against (one is set)                                                                                               |
| `first_finding_id`, `last_finding_id`                                 | FK `monitor_findings`, no `on delete` action (restrict)                                                                                  |
| `first_bad_snapshot_id`, `last_bad_snapshot_id`                       | nullable FK `page_snapshots`, restrict; set for page rules                                                                               |
| `first_bad_site_snapshot_id`, `last_bad_site_snapshot_id`             | nullable FK `site_snapshots`, restrict; set for site rules                                                                               |
| `confirmation_count`, `clean_count`                                   | integer, not null                                                                                                                        |
| `evidence_version`                                                    | integer, not null, default 1; bumped when the bad value changes                                                                          |
| `status`                                                              | `REGRESSION_STATUSES` = `open`, `repairing`, `resolved`, `accepted`, `dismissed`                                                         |
| `resolution`                                                          | nullable `REGRESSION_RESOLUTIONS` = `restored_by_relay`, `fixed_by_customer`, `observed_resolution`, `accepted_change`, `false_positive` |
| `resolved_at`, `resolved_by`, `resolution_note` (at most 500)         | nullable                                                                                                                                 |
| `previous_regression_id`                                              | nullable self FK: recurrence link                                                                                                        |
| `deployment_sha`, `previous_deployment_sha`                           | nullable: the suspect range when both releases were observed                                                                             |
| `detected_at`                                                         | text, not null                                                                                                                           |
| `alert_claimed_at`, `alert_attempts`, `alerted_at`                    | the email send claim, its attempt count, and when it was sent                                                                            |

Partial unique index on (`enrollment_id`, `subject_key`, `rule`) where `status` is `open` or `repairing`. That index enforces one active incident per page or resource and rule.

**Tickets.** Extend `opportunity_tickets` rather than add a second ticket table: make `opportunity_id` nullable, add a nullable `regression_id` (FK `site_regressions` on delete cascade), add a check that exactly one of the two is set, and add a unique index on (`regression_id`, `text_hash`). Every opportunity-ticket query keeps filtering by `opportunity_id`.

SQLite cannot drop a `NOT NULL` without rebuilding the table. On D1, `PRAGMA foreign_keys=OFF` has no effect inside a migration, and dropping a table still runs `ON DELETE` actions on its children. `opportunity_tickets` has no child tables, so its rebuild is safe. Even so:

- start the migration with `PRAGMA defer_foreign_keys = on`;
- rehearse it on a D1 copy and compare the row count before and after.

Postgres only needs `ALTER COLUMN … DROP NOT NULL` and the check.

Retention from IRFC-0002 never deletes a snapshot, site snapshot or finding that an incident references. The restrict foreign keys above make a mistake fail loudly instead of erasing evidence.

## Comparison and confirmation

`compareToBaseline` in `src/server/features/protection/monitorCompare.ts` (pure):

- **Pages:** call `comparePage(toSnapshot(baseline), toSnapshot(current), { path, baseOrigin: origin, previewOrigin: origin, checkRobotsHeader: true })`, when the baseline is a `page` and the current snapshot is a `page` or a `response`. A `response` carries only status and redirect, so the status rules can fire while fact rules stay silent. Production always checks `X-Robots-Tag`, and preview exemptions never apply.
  - **Fix the shared rule for header noindex.** `comparePage` decides whether the baseline was noindex from its meta tag alone (`!noindex(before.robots)`). An acknowledged baseline that sends `X-Robots-Tag: noindex` would therefore raise `newly-noindex` on every check. When `checkRobotsHeader` is on, include `base.robotsHeader` in the baseline's noindex test. This only removes a false positive, and CI's existing callers benefit too. Add a `seoRules.test.ts` case for an unchanged header-noindex page.
- **Site:** call `compareSite` with the monitored paths, `isAllowed` from the baseline and current `robots_txt`, and the sitemap counts. Robots rules run when each side's robots state is `ok` or `missing`. A confirmed missing robots.txt allows every path, so adding `Disallow: /` to a site that had none raises `robots-txt-blocks`. They never run on an `unknown` or `truncated` robots state.
  - The sitemap rule runs when the baseline state is `ok` and the current state is `ok` and not at a cap, or `missing`.
  - A confirmed missing sitemap is compared as zero URLs, so deleting a healthy sitemap raises `sitemap-shrunk`. An `unknown` sitemap is never compared.
- **Unknown data:** an `unknown` or `truncated` snapshot produces no finding and is counted as unknown.

`weigh` is not applied: traffic is optional here, and missing click data is not zero.

`RegressionService.processRun(runId)` runs after every run finishes:

1. **New blocking finding with no active incident.** Store it as `candidate`. Queue one `confirmation` run with `confirms_run_id` for five minutes after the run finished.
   - `status-regressed` and `newly-redirected` need two confirmations ten minutes apart, so the first confirmation queues the second.
2. **Confirmation run.**
   - A candidate whose fingerprint appears again becomes `confirmed`, and its incident opens once the required confirmations are in.
   - A candidate that disappears becomes `transient` and opens nothing.
   - An unknown observation allows one more confirmation, after which the candidate is `transient` with "could not confirm".
3. **Warnings.** A warning confirms when the same fingerprint appears in two consecutive non-confirmation runs. It opens an incident with severity `warning`, an in-app notification and no email.
4. **Finding for an open incident.** Update `last_finding_id` and `last_bad_snapshot_id`, add one to `confirmation_count`, and reset `clean_count`. Bump `evidence_version` only when `after_value` changed. Never notify again.
5. **Open incident without its finding.** Two consecutive comparable observations without the finding resolve it as `observed_resolution`. IRFC-0006 later separates Relay repairs from customer fixes.
6. **Dismissed fingerprint.** A dismissed incident's fingerprint stays quiet while the baseline is unchanged. Accepting a change sets a new baseline, so the fingerprint changes naturally.
7. **Recurrence.** A recurrence after resolution opens a new incident with `previous_regression_id`.
8. **Newer deployment.** A queued confirmation becomes `skipped` ("superseded by deployment …") when a newer `deployment` run is queued. Its candidates become `superseded`. Evidence from two site versions is never mixed.

## Deployment discovery

1. Extend `createGithubSignals`:
   - `listEnvironmentDeployments(environment)` reads `/deployments?environment=…&per_page=10` and returns `id`, `sha` and `created_at`;
   - `listDeploymentStatuses` gains a nullable `environment_url`.
2. On each tick, for every `active` enrollment with an active publishing connection, read production deployments newer than `last_deployment_id`. Use the same read permissions as `DeploymentSignalService`.
3. Walk the deployments oldest first:
   - A latest status of `success` queues a `deployment` run with its ID and SHA.
   - `failure`, `error` and `inactive` are terminal and queue nothing.
   - A deployment still `queued`, `pending` or `in_progress` stops the walk.
   - The cursor advances only past the leading run of terminal deployments, so an in-progress release is read again on the next tick, not skipped.
   - A deployment that is still not terminal after 6 hours is passed over and recorded on the coverage view.
4. A queued `deployment` run that has not started absorbs newer deployments: update its ID and SHA and add one to `coalesced_count`.
5. Without a connection, coverage says "Deployment checks need a GitHub connection; daily checks still run." The webhook path is unchanged; RFC-0019 adds it only if polling latency proves insufficient.

## Alerts, cause and tickets

**Alerts**

- Add `regression_confirmed` to both notification-kind literals.
- A newly opened blocking incident calls `notify` with `dedupeKey` set to the incident ID and `linkPath` `/p/{projectId}/protection/incidents/{id}`.
- It also emails the reviewer through `sendProtectionAlertEmail`, in four steps:
  1. A tick claims the send with a compare-and-set on `alert_claimed_at`, which acts as a 10-minute lease.
  2. It sends the email.
  3. Only then does it set `alerted_at`.
  4. A failed send clears the claim and adds one to `alert_attempts`. Later ticks retry up to 3 attempts, then the incident page shows "alert email failed".
- That makes alerts at-least-once. A crash between sending and recording can send a duplicate, but a failure never loses the alert silently.
- The alert includes the page, rule, before and after values, first seen, confirmations and one next action.

**Cause**

- When the first bad run was a `deployment` run and an earlier `deployment` run exists, store both SHAs.
- The incident page then reads the changed files through a new bounded `compareCommits(base, head)` in `githubRead.ts` (`/compare/{base}...{head}`, at most 300 files).
- Highlight files under the page's route folder, plus `layout.*`, `middleware.*`, `robots.*`, `sitemap.*` and `next.config.*`. Label the result **Suspected cause (not proven)**.
- With no matching deployment, the page says exactly: "No matching deployment was observed; the cause is unconfirmed."

**Tickets**

- `regressionTicketText(incident)` (pure) writes the Markdown.
- **Copy ticket** needs no connection.
- **Create GitHub issue** extends `GithubIssueService` with a regression variant. Its eligibility is the incident being `open` or `repairing` and the caller holding `integration:manage`. The claim, marker and completion steps are the opportunity flow's own. The audit action is the existing `ticket.created`.

**Owner actions**

- **Accept as new baseline** (`acceptRegressionChange`) sets the page baseline to the latest `page` snapshot and closes the incident as `accepted_change`.
  - That snapshot also carries any other current regression on the page. So acceptance is refused while the page has another open incident, and the refusal lists them.
  - The owner either resolves those first or accepts them together: `acceptRegressionChange` takes the full list of the page's open incident IDs, and they close in one batch. RFC-0019 section 4.5 forbids silently overwriting a baseline while findings are unresolved.
  - **Site incidents** (`robots-txt-blocks`, `sitemap-shrunk`) have no page, so they take the site branch instead, with the same rules:
    - it sets `protection_enrollments.site_baseline_snapshot_id` to the latest site snapshot whose robots and sitemap states can be compared;
    - it is refused while another site incident is open, unless all of them are accepted together;
    - it closes them in one batch with the baseline change.
  - Closing a site incident without moving the site baseline would let the next check reopen it, so `accepted_change` always moves the baseline it was compared against.
- **Dismiss** (`dismissRegression`, with a reason) closes it as `false_positive`.
- Both require `integration:manage` and write `regression.accepted` or `regression.dismissed` audit rows in the same batch. Add both actions to `AUDIT_ACTIONS`.

## Interface

- **Protection page.** It gains an **Incidents** list: open first, with severity, page, rule, first seen, confirmations and status, then the 20 most recent closed.
- **Incident page.** It lives at `src/routes/_app/p/$projectId/protection/incidents/$incidentId.tsx` and shows:
  - baseline, first bad and latest values side by side;
  - a timeline of observations and confirmations;
  - coverage freshness and the cause section;
  - **Copy ticket**, **Create GitHub issue**, **Accept as new baseline** and **Dismiss**.
- **Coverage.** It keeps IRFC-0002's degraded reasons, so a monitor that cannot run is always visible with its next action.

## Tests

- `monitorCompare.test.ts` (pure):
  - production checks `X-Robots-Tag`;
  - an unchanged `X-Robots-Tag: noindex` on an acknowledged baseline raises nothing;
  - an unknown current snapshot gives no findings;
  - a missing baseline robots.txt followed by `Disallow: /` raises `robots-txt-blocks`, while an `unknown` robots state raises nothing;
  - a sitemap that is now `missing` raises `sitemap-shrunk`, while an `unknown` one raises nothing;
  - a fingerprint is stable for one baseline and changes with a new one.
- `regressionLifecycle.test.ts`, real SQLite and Postgres:
  - a blocking candidate queues a confirmation;
  - a persistent finding opens one incident and one notification;
  - a transient finding opens nothing and notifies nothing;
  - a status regression needs two confirmations ten minutes apart;
  - repeated observations keep one incident and bump `evidence_version` only on a changed value;
  - a dismissed fingerprint stays quiet;
  - an accepted change stays quiet;
  - a recurrence links to the previous incident;
  - a newer deployment supersedes pending confirmations;
  - two concurrent processors cannot open two incidents;
  - the email is sent once, a failed send is retried, and three failures are shown;
  - a `response` with status 500 opens `status-regressed`, while a 403 challenge (`unknown`) opens nothing;
  - accepting a change is refused while another incident is open on the page, and accepting both together closes both;
  - accepting an intentional sitemap or robots change moves the site baseline, so the next check stays quiet;
  - retention keeps every snapshot, site snapshot and finding an incident references.
- `deploymentDiscovery.test.ts`:
  - the cursor advances only past terminal deployments, and an in-progress one is read again next tick;
  - only `success` statuses queue runs;
  - other environments are ignored;
  - a burst coalesces into one run with a count;
  - no connection means no deployment runs.
- `GithubIssueService.test.ts`: the regression variant creates one issue per incident text, and the existing opportunity cases still pass unchanged.
- `githubSignals` schemas: `environment_url` is optional, and malformed deployments are rejected.

## Acceptance gate

On an authorized staging site, seed each case and check the result:

- removed meta description;
- changed templated title;
- `X-Robots-Tag: noindex`;
- changed canonical;
- a 500 status;
- a single transient 500;
- an unreachable page;
- an intentional change that the owner accepts.

Each blocking regression must produce one confirmed incident per fingerprint and one alert. The transient and unreachable cases must alert nobody. The accepted change must stay quiet afterwards. A stopped monitor must show a visible degraded state with its next action.

Record the measured time from deployment to confirmed alert. The target is 60 minutes. On an authorized production site, observe passively only.

## Explicit boundary

Do not call a suspected cause proven, and make no source edits. No automatic baseline promotion. No webhook path yet.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- State what was tested with fixtures and what was tested on a live authorized site. Never treat a test fixture or an unmerged PR as a production result.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**. Do not block later unrelated work.

**Next:** [IRFC-0004](0004-prepare-source-mapped-repair-proposals-from-confirmed-incidents.md)
