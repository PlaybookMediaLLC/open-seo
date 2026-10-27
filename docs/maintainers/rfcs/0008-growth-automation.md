# RFC-0008: Growth automation on Trigger.dev, and notifications

- **Status:** Done on 2026-10-17 for phase 1 code: part A (runner, endpoints, Trigger.dev tasks, PR #86), part B (all jobs, notifications, PR #87) and part C (audit hook, Automation tab, default schedules, PR #88). The owner decided on 2026-10-17 that the follow-ups in section 12 do not block closing this RFC. On 2026-10-27 the Automation tab gained each job's last run and each run's start time and duration (5.10). The same change fixed four gaps: task queue limits (5.3), archived projects that stayed due (5.6), the weekly cycle's missing audit event (5.7), and the audit hook outside `trigger` mode (part C).
- **Date:** 2026-10-15
- **Brief section:** 9
- **Depends on:** RFC-0001 and RFC-0009 (limits and audit log). Jobs call services from RFC-0002, RFC-0005 and RFC-0006. Needs a Trigger.dev account for Playbook Media.
- **Decision:** the brief said not to add Trigger.dev unless the current system cannot do the work. The owner chose Trigger.dev on 2026-10-15 for its retries, per-project concurrency, idempotency keys, run dashboard and alerts. Section 8 records the trade-offs.

## Current delivery role — October 23, 2026

Implemented scheduling foundation for stage 1. Reuse the Worker cron path recorded below; Trigger.dev is optional. Monitoring must prove its own due-time and confirmation latency.

The historical status and acceptance notes below are retained. The [delivery plan](README.md) and [current audit](../relay-release-assurance-audit.md) distinguish implementation, live acceptance, and commercial evidence.

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

**As built (owner decision, 2026-10-18): the Worker cron.** The Trigger.dev account does not exist yet, so the owner chose Cloudflare cron. The Worker's existing five-minute cron acts on the :00, :15, :30 and :45 ticks. It reconciles failed credit settlements, deletes old history on the 03:30 tick, and runs the due jobs one at a time through the same `GrowthJobService.run`. A failed window is retried on later ticks, up to 3 attempts; the third failure tells the project and moves the schedule on, as a final Trigger.dev failure does. A tick stops starting jobs after 10 minutes. `GROWTH_JOBS_MODE` is now `cron` by default, `trigger` when Trigger.dev is configured (which turns the cron off), or `off`. The signed endpoints answer only in `trigger` mode. Audit follow-ups wait as queued rows for the next tick.

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

**As built (2026-10-27).** Each child task's queue allows one run, and the dispatch's `concurrencyKey` copies that limit per project. The scheduled tasks allow one run overall. Because the limit is copied per key, Trigger.dev cannot also cap `opportunity-refresh` at 5 overall; the environment's concurrency limit bounds it.

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
7. An archived project's schedules and queued rows are not due (2026-10-27). Its run could never start, so they used to come back on every tick. A restored project runs once at the next tick, then moves to its next slot.

### 5.7 Permissions

1. Each schedule has an `owner_user_id`. Jobs run with that user's current membership and role in the project's organization.
2. Before each run, the Worker loads the membership. When the owner is no longer a member, or lacks the needed permission, it skips the run with "The schedule owner no longer has access." It notifies the project's managers.
3. Creating or changing a schedule requires `integration: ["manage"]`. The editor becomes the new owner.
4. Every schedule change writes an RFC-0009 audit event. As built: the weekly cycle settings of RFC-0018 write it too (2026-10-27). Default schedules that turn on with a Search Console connection or tracking start do not.

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

**As built (part C).** The Worker triggers `audit-followup` through the Trigger.dev REST API, with the idempotency key `audit:{auditId}` and the concurrency key `projectId`. It needs no SDK. When the key is missing, the mode is not `trigger`, or the request fails, it writes a queued run that the next dispatch picks up. It does nothing when `GROWTH_JOBS_MODE` is `off`, and it never fails the audit. The follow-up runs as the member who started the audit. Membership is enough, because any member can start an audit; scheduled jobs still need a member who can manage integrations. Connecting Search Console turns on the opportunity refresh, the traffic watch and the recommendation re-check. Starting tracking turns on the measurement refresh and the deployment check, because tracking is where the experiment exists. Each default turns on once; a job that a member turned off stays off.

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

**As built (2026-10-27).** Each job shows its last and next run, and each run in the history shows when it started and how long it took. A cron tick runs its due jobs one after another, so a run records the moment it really started, not the tick's time. Section 11's start-time criterion reads that value.

### 5.11 Email digest (phase 2)

1. Only when Loops is configured (RFC-0001 B3).
2. Opt-in per user, per organization: `growth_email_preferences` (`user_id`, `organization_id`, `digest` `off`/`daily`/`weekly`).
3. A scheduled task `growth-digest` sends one digest of unread notifications per opted-in user.

**As built (owner decision, 2026-10-18).** Loops is not set up, so the digest sends through the Cloudflare Email binding that team invitations use (`notifications@mail.playbookmedia.io`); without the binding nothing is sent. The member chooses off, daily or weekly in the notification bell. The Worker cron sends at the 08:00 UTC tick (weekly on Mondays): each digest holds at most 20 of the member's unread notifications created since the last digest, and nothing goes out when there are none. A member who left the organization gets nothing, and a retried tick never sends twice in a day. "Email me a test digest" sends the latest unread notifications to the member who clicks it.

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

The Worker cron runs the jobs now (section 5, as built), so these items apply only if the jobs move to Trigger.dev.

- [ ] Trigger.dev project for Playbook Media, with staging and production environments.
- [ ] A scheduled task calls a signed staging endpoint. The endpoint rejects a wrong signature and a 10-minute-old timestamp.
- [ ] The Worker triggers a task with the SDK or the REST API. Record which one works on Workers.
- [ ] Two triggers with the same idempotency key create one run.
- [ ] Two runs with the same concurrency key never overlap.
- [ ] Plan, limits and expected monthly cost recorded in the PR.

### Phase 1

- [x] RFC-0009 audit log and limits are live.
- [x] Five tables with D1 and Postgres migrations and the parity test.
- [x] Internal endpoints with signature, timestamp, size and mode checks (one test each).
- [x] Due endpoint never changes data (test).
- [x] Run endpoint: "already done" for a succeeded window, conditional schedule advance, `503` and `422` mapping (tests).
- [x] Test: a removed schedule owner causes a skip with the reason and a notification.
- [x] Test: a free plan skips `traffic_watch`.
- [x] Each job has a service test with mocked providers.
- [x] Traffic drop rule tests at each threshold, and the incomplete-data skip.
- [x] Audit hook triggers `audit-followup`, falls back to a queued row, and never fails the audit (tests).
- [x] Task files with the retry, concurrency and duration settings from 5.3.
- [ ] `trigger-deploy-playbook.yml` deploys the tasks after the Worker deploy.
- [x] Default schedules created on Search Console connect and on tracking start.
- [x] Automation tab with toggles, history and logs.
- [x] Notification bell, list and read state.
- [ ] Trigger.dev alerts reach the team's email.
- [x] Privacy policy lists Trigger.dev.
- [x] `content/docs/automation.mdx` lists each job, its default, its cost and how to turn it off.

### Phase 2

- [x] Email preferences table and settings UI. `growth_email_preferences` and the bell control (2026-10-18).
- [x] Digest sends only to opted-in users (test). `emailDigest.test.ts`.
- [ ] Live check: a digest reaches a test inbox. Trigger: the second test account accepts its invitation and sends itself a test digest, or the owner names another test inbox.

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

**With the Worker cron (section 5.1, as built).** There is no Trigger.dev dashboard to compare against; read the Automation tab and the run history instead. Each window should have one succeeded or skipped run per kind and project, and each first attempt should start within 20 minutes of its hour. A failing job retries at the next quarter-hour ticks, up to 3 attempts, then sends `job_failed`. Step 3 has no cron equivalent: the "already done" check and the unique index on (`project_id`, `kind`, `window_key`, `attempt`) stand in for it (tests). In cron mode the signed endpoints answer `404` to every request, so step 5 checks only that nothing is written. The Trigger.dev cost lines do not apply.

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

## 12. Follow-ups that do not block closing

Each follow-up names its trigger. Check it here when it passes.

- [ ] Phase 0 spike: idempotency, concurrency, the signed staging call, plan and cost. Trigger: the owner creates the Trigger.dev project with staging and production environments. Not needed while the Worker cron runs the jobs.
- [x] Turn on scheduled jobs in production: `GROWTH_JOBS_SECRET` and `TRIGGER_SECRET_KEY` in `ENV_PLAYBOOK`, `RELAY_INTERNAL_URL` and `GROWTH_JOBS_SECRET` in Trigger.dev. Trigger: the Trigger.dev project exists. Done on 2026-10-18 with the Worker cron instead, which needs no secrets. At the 11:00 UTC tick, the 4 Playbook Media jobs (opportunity refresh, measurement refresh, deployment check and recommendation re-check) succeeded on their first attempt.
- [ ] Deploy the tasks automatically. Trigger: the maintainer reviews and merges PR #89, then adds `TRIGGER_ACCESS_TOKEN` and `TRIGGER_PROJECT_REF`. PR #89 is merged. The secrets are not needed while the Worker cron runs the jobs.
- [ ] Trigger.dev alerts for failed runs and a monthly spend alert reach the team's email. Trigger: the Trigger.dev project exists. Not needed while the Worker cron runs the jobs: a job that fails 3 times notifies the project.
- [ ] Real-site acceptance (section 10) and completion criteria (section 11) over 7 days on S1 to S3. Trigger: scheduled jobs run in production. They run since 11:00 UTC on 2026-10-18, so the 7 days end on 2026-10-25 at the earliest. On 2026-10-27 the window had passed, but nobody had read the results from production yet. Runs recorded before the 2026-10-27 change store the tick time as their start, which hides the delay only when several jobs share a tick.
- [x] "RFC-0009 audit log and limits are live." Trigger: RFC-0009 is done. Done on 2026-10-18; scheduled jobs that spend now pass the limits, and their audit events show as Scheduled.
- [x] Phase 2 email digest (section 5.11). Trigger: Loops is configured. Done on 2026-10-18 on the Cloudflare Email binding instead (PR #116). Its live check in section 9 stays open.
- [ ] Email digests in `trigger` mode. `sendDigests` runs only on the Worker cron, which `trigger` mode turns off, so digests would stop. Trigger: the jobs move to Trigger.dev; add a `growth-digest` task (5.11) first.
- [ ] The existing projects get their default schedules. They connected Search Console before part C, so the defaults turn on only at the next connection or tracking start. Trigger: scheduled jobs run in production; then a manager turns the jobs on in the Automation tab. Done for Playbook Media on 2026-10-18 (4 jobs). The other projects wait for a manager.

Evidence for the phase 1 items that code can show:

- **Endpoints:** a wrong signature, an old timestamp, a large body and the off mode each answer `404` (tests). The due endpoint changes no data.
- **Runs:** a succeeded window answers "already done". The schedule advance is conditional. A retryable failure answers `503` and a final failure answers `422` (tests on SQLite and Postgres).
- **Permissions and plans:** a removed owner causes a skip with the reason and a `job_failed` notification. A free plan skips the traffic watch. An audit follow-up runs as the member who started the audit (tests).
- **Audit hook:** it triggers `audit-followup` once per audit, writes a queued row when Trigger.dev fails, does nothing when jobs are off, and never fails the audit (tests).
- **Production, 2026-10-17:** the Automation tab shows the five jobs, their defaults and the "not available" notice, and the Edit sheet opens. The notification bell is in the sidebar.
