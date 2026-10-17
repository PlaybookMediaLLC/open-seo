# RFC-0008: Growth automation on Trigger.dev, and notifications

- **Status:** In progress. Parts A (runner, endpoints, Trigger.dev tasks) and B (all jobs, notifications) built
- **Date:** 2026-10-15
- **Brief section:** 9
- **Depends on:** RFC-0001 and RFC-0009 (limits and audit log). Jobs call services from RFC-0002, RFC-0005 and RFC-0006. Needs a Trigger.dev account for Playbook Media.
- **Decision:** the brief said not to add Trigger.dev unless the current system cannot do the work. The owner chose Trigger.dev on 2026-10-15 for its retries, per-project concurrency, idempotency keys, run dashboard and alerts. Section 8 records the trade-offs.

## 1. Summary

Every growth action runs only when a person clicks a button. This RFC adds scheduled and event-driven growth jobs on Trigger.dev, a signed internal endpoint in the Relay Worker that runs each job, customer-visible run history, and in-app notifications. All jobs are free and read-only toward external systems.

## 2. What exists today

| Part          | Location                         | Behavior                                                                                                        |
| ------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Cron triggers | `wrangler.jsonc`                 | `*/5 * * * *` and `17 3 * * *`.                                                                                 |
| Cron handler  | `src/server.ts`, `scheduled`     | 5-minute tick: stale-audit reconcile, rank checks, AI visibility. Daily tick: OAuth cleanup and referral sweep. |
| Data bindings | `wrangler.jsonc`                 | D1, KV, R2, Durable Objects and Workflows. They exist only inside the Worker.                                   |
| Long work     | Cloudflare Workflows             | Audits, rank checks and AI visibility runs.                                                                     |
| Short leases  | `DataRefreshClaimRepository`     | Keyed claim with a 180-second lease and a cooldown.                                                             |
| Self-hosting  | `scripts/selfhost-scheduler.mjs` | Calls the same scheduled handler every 5 minutes.                                                               |
| Notifications | None                             | No notification table or inbox. Loops sends only auth emails.                                                   |

The existing upstream cron jobs stay on Cloudflare cron. Moving them would create upstream merge conflicts and gives no user value.

## 3. Goals

1. Run free, read-only growth jobs on a schedule: opportunity refresh, measurement refresh, deployment checks, traffic watch and recommendation re-check.
2. Run an audit follow-up when an audit completes.
3. Make every run idempotent per project, job kind and time window.
4. Never run the same task twice at the same time for one project.
5. Retry failed runs with backoff, and tell the project's managers after the final failure.
6. Keep customer-visible run history and short logs in Relay's database.
7. Run each job with the permissions of a real project member.
8. Tell users about important results in the app.

## 4. Non-goals

1. No paid jobs. Content gaps, SERP checks and AI drafting never run on a schedule in this RFC.
2. No repository writes, merges, deployments or reverts in this RFC. RFC-0018 standing approvals add limited writes later.
3. No direct database access from Trigger.dev.
4. No move of the existing upstream cron jobs.
5. No email in phase 1. Phase 2 adds an opt-in digest.

## 5. Design

### 5.1 Architecture

Trigger.dev tasks run on Trigger.dev machines, outside Cloudflare. D1, KV, R2 and Durable Objects are Worker bindings, so the tasks cannot use them. The tasks therefore do scheduling, retries, concurrency and observability only. The Worker does all data work.

1. **Dispatch.** The scheduled task `growth-dispatch` runs every 15 minutes. It calls `POST /api/internal/growth/due` on the Worker.
2. **Due list.** The Worker returns the due work items: `{ kind, projectId, scheduleId, windowKey }`. It changes nothing.
3. **Fan-out.** `growth-dispatch` batch-triggers one child task per item, with an idempotency key and a concurrency key.
4. **Run.** Each child task calls `POST /api/internal/growth/run`. The Worker runs the job with its bindings and the existing services. It writes the run row, logs and notifications, and advances the schedule.
5. **Events.** At the end of a successful audit, the Worker triggers the `audit-followup` task through the Trigger.dev API.

### 5.2 Trigger.dev project

1. Add `trigger.config.ts` at the repository root and task files in `trigger/`. Both are fork-owned.
2. Pin the `@trigger.dev/sdk` version in `package.json`.
3. Use the smallest machine. Set a default `maxDuration` of 300 seconds.
4. Trigger.dev environment variables: `RELAY_INTERNAL_URL`, `GROWTH_JOBS_SECRET`.
5. Worker environment variables (in `ENV_PLAYBOOK`): `GROWTH_JOBS_SECRET`, `TRIGGER_SECRET_KEY`, `GROWTH_JOBS_MODE` (`trigger` or `off`).
6. Deploy the tasks with a new workflow `.github/workflows/trigger-deploy-playbook.yml`. It runs after the Worker deploy succeeds on `main`. It needs the secret `TRIGGER_ACCESS_TOKEN`. This is a `.github` change, so it needs maintainer review.
7. Use separate Trigger.dev environments for staging and production.

### 5.3 Tasks

| Task id                  | Kind      | Trigger                   | Concurrency                                | Retry                                  | Max duration |
| ------------------------ | --------- | ------------------------- | ------------------------------------------ | -------------------------------------- | ------------ |
| `growth-dispatch`        | Scheduled | `*/15 * * * *`            | 1 global                                   | 2 attempts                             | 120 s        |
| `opportunity-refresh`    | Child     | Dispatch                  | Key `projectId`. At most 5 at once overall | 3 attempts: 5 minutes, then 30 minutes | 300 s        |
| `measurement-refresh`    | Child     | Dispatch                  | Key `projectId`                            | 3 attempts, same backoff               | 300 s        |
| `deployment-check`       | Child     | Dispatch                  | Key `projectId`                            | 3 attempts, same backoff               | 180 s        |
| `traffic-watch`          | Child     | Dispatch                  | Key `projectId`                            | 3 attempts, same backoff               | 120 s        |
| `recommendation-recheck` | Child     | Dispatch                  | Key `projectId`                            | 2 attempts                             | 60 s         |
| `audit-followup`         | Event     | Worker, on audit complete | Key `projectId`                            | 3 attempts, same backoff               | 180 s        |
| `spend-reconcile`        | Scheduled | `*/15 * * * *`            | 1 global                                   | 2 attempts                             | 120 s        |
| `growth-retention`       | Scheduled | `30 3 * * *`              | 1 global                                   | 2 attempts                             | 120 s        |

`spend-reconcile` belongs to RFC-0009. `growth-retention` deletes runs, logs and notifications older than 180 days, and audit events older than 1 year.

Later RFCs add tasks with the same rules: `weekly-cycle` (RFC-0018), `deployment-watch` and the monitoring checks (RFC-0019), `revenue-sync` (RFC-0016), and the competitor page fetch (RFC-0022).

### 5.4 Internal endpoints

Add fork-owned route files under `src/routes/api/internal/`:

| Endpoint                               | Body                                                                              | Response                                                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `POST /api/internal/growth/due`        | `{}`                                                                              | Up to 200 due items, oldest first.                                                                             |
| `POST /api/internal/growth/run`        | `{ kind, projectId, scheduleId?, windowKey, triggerRunId, attempt, maxAttempts }` | `200 { status: "succeeded" or "skipped", summary }`, `503` for a retryable failure, `422` for a final failure. |
| `POST /api/internal/billing/reconcile` | `{}`                                                                              | Counts of settled and still-failed rows (RFC-0009).                                                            |
| `POST /api/internal/growth/retention`  | `{}`                                                                              | Counts of deleted rows.                                                                                        |

**Authentication for every endpoint:**

1. Headers `x-relay-timestamp` (Unix seconds) and `x-relay-signature` (hex HMAC-SHA256 of `{timestamp}.{rawBody}` with `GROWTH_JOBS_SECRET`).
2. Reject when the timestamp is more than 300 seconds from now.
3. Compare the signature in constant time.
4. Return `404` for any authentication failure. Do not reveal why.
5. Accept `POST` only, at most 64 KB. Validate the body with Zod. Ignore cookies. Send `Cache-Control: no-store`.
6. Return `404` for all endpoints when `GROWTH_JOBS_MODE` is `off`.

The child task maps `503` and timeouts to a thrown error, so Trigger.dev retries. It maps `422` to `AbortTaskRunError`, so Trigger.dev stops.

### 5.5 Data model

`growth_schedules`:

| Column          | Type                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| `id`            | text primary key                                                                                                      |
| `project_id`    | text, FK `projects.id`, cascade                                                                                       |
| `kind`          | text enum `opportunity_refresh`, `measurement_refresh`, `deployment_check`, `traffic_watch`, `recommendation_recheck` |
| `enabled`       | boolean                                                                                                               |
| `interval`      | text enum `daily`, `weekly`                                                                                           |
| `hour_utc`      | integer, 0 to 23                                                                                                      |
| `next_run_at`   | text                                                                                                                  |
| `owner_user_id` | text. The member whose permissions the job uses.                                                                      |
| `updated_by`    | text                                                                                                                  |
| `updated_at`    | text                                                                                                                  |

Unique on (`project_id`, `kind`). Index on (`enabled`, `next_run_at`).

`growth_job_runs`:

| Column                      | Type                                                            |
| --------------------------- | --------------------------------------------------------------- |
| `id`                        | text primary key                                                |
| `project_id`                | text, FK cascade                                                |
| `schedule_id`               | text, nullable, FK `growth_schedules.id`, set null              |
| `kind`                      | text enum: the schedule kinds plus `audit_followup`             |
| `window_key`                | text, for example `2026-10-15`, `2026-W42` or an audit id       |
| `attempt`                   | integer                                                         |
| `trigger_run_id`            | text, nullable, unique                                          |
| `status`                    | text enum `queued`, `running`, `succeeded`, `failed`, `skipped` |
| `skip_reason`               | text, nullable                                                  |
| `started_at`, `finished_at` | text, nullable                                                  |
| `error`                     | text, nullable, sanitized, at most 500 characters               |
| `summary`                   | text, nullable, at most 500 characters                          |
| `created_at`                | text                                                            |

Unique on (`project_id`, `kind`, `window_key`, `attempt`).

`growth_job_logs`: `id`, `project_id`, `run_id` (FK cascade), `at`, `level` (`info`, `warn`, `error`), `message` (at most 500 characters). At most 50 rows per run.

`growth_notifications`: `id`, `organization_id`, `project_id` (FK cascade), `kind` (`new_opportunities`, `traffic_drop`, `result_ready`, `deployment_detected`, `stale_recommendations`, `new_technical_issues`, `job_failed`), `title`, `body`, `link_path`, `dedupe_key`, `created_at`. Unique on (`project_id`, `kind`, `dedupe_key`).

`growth_notification_reads`: `notification_id` (FK cascade), `user_id`, `read_at`. Unique on (`notification_id`, `user_id`).

### 5.6 Idempotency and overlap

1. The due endpoint never advances a schedule. A dispatch can run twice safely.
2. Each child trigger uses the idempotency key `{kind}:{projectId}:{windowKey}` with a 7-day time-to-live. A second dispatch in the same window creates no new run.
3. The run endpoint advances `next_run_at` only after success or a final skip, with a conditional update on the observed value.
4. The run endpoint returns `200 "already done"` when a succeeded row exists for the window. This guards against expired idempotency keys.
5. The concurrency key `projectId` keeps one run per task per project at a time. The unique index on (`project_id`, `kind`, `window_key`, `attempt`) is a second guard.
6. When Trigger.dev is down, schedules stay due. The next dispatch catches up. Nothing is lost.
7. When the audit hook cannot reach Trigger.dev, it inserts a `queued` row. The due endpoint returns queued rows too. A failed insert never fails the audit.

**As built (part A).**

1. The window key is the date of the schedule's `next_run_at` (`2026-10-17`), for daily and weekly schedules alike; a weekly schedule moves 7 days, so its keys stay unique.
2. A final failure also moves the schedule to its next slot and notifies the project. Otherwise the same window would stay due, and the idempotency key would hold it for 7 days.
3. A late run moves the schedule to the next future slot, so a pause never queues a backlog.
4. Run logs are kept in memory during the run and written, at most 50, when it ends.
5. `GROWTH_JOBS_SECRET_PREVIOUS` holds the old secret during a rotation.
6. The run endpoint finishes a window's `queued` rows when it succeeds or skips that window.

### 5.7 Permissions

1. Each schedule has an `owner_user_id`. Jobs run with that user's current membership and role in the project's organization.
2. Before each run, the Worker loads the membership. When the owner is no longer a member, or lacks the needed permission, it skips the run with "The schedule owner no longer has access." It notifies the project's managers.
3. Creating or changing a schedule requires `integration: ["manage"]`. The editor becomes the new owner.
4. Every schedule change writes an RFC-0009 audit event.

### 5.8 Jobs

| Job                      | Default                                             | What it does                                                                                                                                                                                                  | Cost |
| ------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `opportunity_refresh`    | Weekly, on when Search Console connects             | Calls `OpportunityService.detect`. Creates a `new_opportunities` notification when new items have priority ≥ 50.                                                                                              | Free |
| `measurement_refresh`    | Daily, on when tracking starts                      | For each due experiment (RFC-0006 rules), calls `MeasurementService.refresh`.                                                                                                                                 | Free |
| `deployment_check`       | Daily, on when a pull request opens                 | For merged pull requests without confirmed deployment: refreshes the status and the RFC-0005 deployment signals. Notifies `deployment_detected`. Never confirms the deployment.                               | Free |
| `traffic_watch`          | Daily, on when Search Console connects (paid plans) | One Search Console request: site totals and pages for the last 7 final days, against the 28 days before them scaled to 7 days.                                                                                | Free |
| `recommendation_recheck` | Weekly, on                                          | Counts discovered or reviewed opportunities that are not in the latest analysis (RFC-0003). Notifies a digest. Changes no status.                                                                             | Free |
| `audit_followup`         | Event                                               | Compares the new audit's issues with the previous completed audit. Notifies `new_technical_issues` for new critical issues on pages with impressions. Starts an opportunity refresh when its cooldown allows. | Free |

**Traffic drop rule.**

1. Site level: clicks in the last 7 days fell by 25% or more, and by 100 clicks or more, against the scaled 28-day baseline.
2. Page level: a page lost 30% or more and 30 clicks or more on the same comparison. List at most 10 pages.
3. Skip the comparison when either window has missing dates. Log "Incomplete data".
4. The notification shows the numbers and links to Opportunities. Dedupe key: the 7-day window end date.

**As built (part B).** New opportunities are the discovered items with priority 50 or more whose first detection equals the run's end time. The deployment check refreshes the pull request first, then the deployment signals for merged changes; any signal other than a human attestation creates `deployment_detected`, and it never confirms the deployment. The traffic watch reads 35 days by date and page in one request. Notifications belong to the organization; each member has their own read state.

**Audit hook.** At the end of the site-audit workflow's successful finalize step, call a fork function that triggers `audit-followup` with the idempotency key `audit:{auditId}`. Add it with one `// playbook-seam` line in the upstream workflow file.

### 5.9 Plan rules

1. Free plan: `opportunity_refresh` weekly, `measurement_refresh`, `deployment_check`, `recommendation_recheck`.
2. Paid plans: also `traffic_watch` daily, and `opportunity_refresh` daily.
3. The run endpoint checks the plan with `customerHasPaidPlan`. It skips with a reason when the plan does not allow the job.

### 5.10 User interface

1. Project settings → new **Automation** tab. List each job with its toggle, interval, hour, owner, last run and next run.
2. A run history table with status, duration, summary and a "Logs" sheet. The data comes from Relay's tables, not from the Trigger.dev dashboard.
3. A bell in the app header with an unread count. A sheet lists notifications, newest first, with "Mark all read".
4. Each notification links to the page it is about.
5. When `GROWTH_JOBS_MODE` is `off`, the tab says "Scheduled jobs are not available on this installation."

**Operators** use the Trigger.dev dashboard for live runs. Configure Trigger.dev alerts for failed runs to the team's email.

### 5.11 Email digest (phase 2)

1. Only when Loops is configured (RFC-0001 B3).
2. Opt-in per user, per organization: `growth_email_preferences` (`user_id`, `organization_id`, `digest` `off`/`daily`/`weekly`).
3. A scheduled task `growth-digest` sends one digest of unread notifications per opted-in user.

### 5.12 Self-hosted installs

Upstream self-hosted installs do not need Trigger.dev. `GROWTH_JOBS_MODE` defaults to `off` when `TRIGGER_SECRET_KEY` is missing. An operator can still call the signed endpoints from any scheduler. Document the signature format in `docs/maintainers/playbook-deployment.md`.

## 6. Security and privacy

1. Trigger.dev never receives database credentials, Google tokens, GitHub tokens or page content. Payloads hold ids and window keys only. Summaries hold counts.
2. The internal endpoints need a fresh HMAC signature. A leaked old request expires after 5 minutes, and every job is idempotent per window.
3. Rotate `GROWTH_JOBS_SECRET` by accepting two secrets for one deploy, then removing the old one.
4. Jobs never act as a superuser. They use a real member's current permissions.
5. Job errors are sanitized. Never store provider bodies or tokens.
6. Add Trigger.dev to the privacy policy's list of service providers before launch.

## 7. Cost and limits

1. Trigger.dev bills by compute time. The child tasks mostly wait for the Worker's response, so use the smallest machine.
2. Estimate per project per day: 4 to 6 child runs of under 30 seconds each, plus the shared dispatch.
3. Check the current Trigger.dev pricing and plan limits (concurrency, runs, schedules) in the spike. Set a monthly spend alert in Trigger.dev.
4. Google and GitHub requests per run:

| Job                      | Requests per run                                          |
| ------------------------ | --------------------------------------------------------- |
| `opportunity_refresh`    | At most the RFC-0002 reserved count (5 in phase 1)        |
| `measurement_refresh`    | At most 3 per experiment, inside the 5-per-day allowance  |
| `deployment_check`       | At most 6 GitHub requests and 1 page fetch per experiment |
| `traffic_watch`          | 1                                                         |
| `recommendation_recheck` | 0                                                         |
| `audit_followup`         | 0, plus an optional opportunity refresh                   |

## 8. Alternatives considered

1. **Cloudflare cron with a run table in D1 (the first draft of this RFC).** It adds no vendor, and the brief preferred it. It was not chosen because Relay would have to build retries, backoff, per-project concurrency, a run dashboard and alerts itself.
2. **Cloudflare Workflows for each job.** Durable and inside Cloudflare, but it still needs our own dispatch, per-tenant concurrency and alerting.
3. **Job logic inside Trigger.dev with direct database access.** Rejected. It needs an account-wide Cloudflare API token outside Cloudflare, and it duplicates services in two runtimes.

**Trade-offs accepted:** a new vendor and service provider, two new secrets, a public but signed internal endpoint, and an extra failure point. Catch-up dispatch limits the effect of a Trigger.dev outage to a delay.

## 9. Ready-for-other-users checklist

### Phase 0: spike (half a day)

- [ ] Trigger.dev project for Playbook Media, with staging and production environments.
- [ ] A scheduled task calls a signed staging endpoint. The endpoint rejects a wrong signature and a 10-minute-old timestamp.
- [ ] The Worker triggers a task with the SDK or the REST API. Record which one works on Workers.
- [ ] Two triggers with the same idempotency key create one run.
- [ ] Two runs with the same concurrency key never overlap.
- [ ] Plan, limits and expected monthly cost recorded in the PR.

### Phase 1

- [ ] RFC-0009 audit log and limits are live.
- [x] Five tables with D1 and Postgres migrations and the parity test.
- [x] Internal endpoints with signature, timestamp, size and mode checks (one test each).
- [x] Due endpoint never changes data (test).
- [x] Run endpoint: "already done" for a succeeded window, conditional schedule advance, `503` and `422` mapping (tests).
- [x] Test: a removed schedule owner causes a skip with the reason and a notification.
- [x] Test: a free plan skips `traffic_watch`.
- [x] Each job has a service test with mocked providers.
- [x] Traffic drop rule tests at each threshold, and the incomplete-data skip.
- [ ] Audit hook triggers `audit-followup`, falls back to a queued row, and never fails the audit (tests).
- [x] Task files with the retry, concurrency and duration settings from 5.3.
- [ ] `trigger-deploy-playbook.yml` deploys the tasks after the Worker deploy.
- [ ] Default schedules created on Search Console connect and on tracking start.
- [ ] Automation tab with toggles, history and logs.
- [x] Notification bell, list and read state.
- [ ] Trigger.dev alerts reach the team's email.
- [ ] Privacy policy lists Trigger.dev.
- [ ] `content/docs/automation.mdx` lists each job, its default, its cost and how to turn it off.

### Phase 2

- [ ] Email preferences table and settings UI.
- [ ] Digest sends only to opted-in users (test).
- [ ] Live check: a digest reaches a test inbox.

## 10. Real-site acceptance test

**Sites:** production projects for S1, S2 and S3, for 7 days. Staging for the failure steps.

**Steps:**

1. Turn on the default schedules for S1, S2 and S3.
2. Let them run for 7 days. Compare the Automation tab with the Trigger.dev dashboard each day.
3. Start `growth-dispatch` by hand 3 times within one minute.
4. On staging, make the run endpoint return `503` for `traffic-watch`. Watch the retries. Restore it.
5. On staging, send one request with a bad signature and one with a 10-minute-old timestamp.
6. Compare one `traffic_watch` result with the Search Console UI for the same 7 days.
7. In a test organization, remove a schedule's owner. Wait for the next run.

**Pass when:**

- Every due window ran exactly once: one succeeded row per window, kind and project.
- No two runs of one task overlapped for the same project.
- The manual dispatches created no extra runs.
- The `503` job retried on the configured backoff, then failed with a `job_failed` notification. After the restore, the next window succeeded.
- Both bad requests got `404` and wrote nothing.
- The traffic numbers match Search Console.
- The removed-owner run was skipped with its reason, and the managers were notified.
- The week's Trigger.dev cost is in the PR, and it is below the budget set in the spike.

**Value check:** the owner gets new opportunities, traffic-drop alerts and results without opening Relay, and every automatic run is visible and explained.

## 11. Completion criteria

**Reliability (7 days on S1 to S3)**

- At least 99% of due windows end as succeeded, or as skipped with a reason.
- 0 duplicate runs and 0 overlapping runs of one task for one project.
- Every due job starts within 20 minutes of its scheduled hour.

**Recovery**

- After the staging schedules are paused for 2 hours and then resumed, every missed window runs exactly once.
- Retry delays match the configuration within 1 minute.
- A forced failure reaches the operator alert and the managers' `job_failed` notification.

**Security**

- 1,000 staging requests with random signatures or old timestamps are all refused, and none writes data.
- Trigger.dev payloads and logs hold only ids, window keys and counts (log review).

**Notifications**

- Each notification kind appears at least once in staging tests.
- The same window never creates a second notification of the same kind.

**Permissions and plans**

- A removed owner causes a skip with the reason. A free plan skips paid-plan jobs.

**Cost**

- The week's Trigger.dev cost is recorded. The projected monthly cost per project is within the budget set in the spike.

**Value**

- During the week, the owner gets at least one notification on S1 to S3 that leads to an action (a review, a ticket or a proposal).
