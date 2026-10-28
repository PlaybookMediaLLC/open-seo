# IRFC-0001: Record protected-site scope and activation

**Status:** Ready to build; specified against `develop` on 2026-10-28  
**Priority:** Required to reach the next core milestone  
**Prerequisites:** None; may start immediately  
**Canonical technical specification:** [RFC-0026](../0026-protected-site-pilots-and-service.md) phase A  
**Implementation order:** 0001 of 0032

## Implement this slice

Give each project one protected-site record: its verified production origin, the agreed page set and exclusions, the daily check hour, a named reviewer with a tested alert channel, and the operations Relay may perform. Show a readiness checklist and allow activation only when every required item passes. Activation stays blocked until IRFC-0002 adds baselines and scheduled checks; this slice makes that visible rather than faking it.

Read RFC-0026 in full, including its activation checklist. Inspect `develop` before writing code: reuse what is listed here, and update this file if the code has moved.

## What exists to reuse

| Need                       | Existing code                                                                                                                                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layered feature pattern    | Project approvers: `src/serverFunctions/approvals.ts` → `PublishingApproverService` → `repositories/publishingApprovers.ts`, UI `PublishingApproversCard.tsx`                                            |
| Project scoping            | `requireProjectContext` (`src/serverFunctions/middleware.ts`); `projectScope` in `src/types/schemas/publishing.ts`                                                                                       |
| Role check                 | `requireOrgPermission(context, { integration: ["manage"] })` (`src/server/auth/org-gate.ts`); owners and admins hold it                                                                                  |
| Reviewer candidates        | `listApproverCandidates(projectId, organizationId)` (`publishing/repositories/publishingApprovers.ts`)                                                                                                   |
| Project website            | `projects.domain`, a lowercase bare host normalized by `normalizeProjectDomain`                                                                                                                          |
| Origin validation          | `normalizeAndValidateStartUrl` (`src/server/lib/audit/url-policy.ts`)                                                                                                                                    |
| Ownership signals          | `GscService.getConnection(projectId)` → `gsc_connections.site_url` (unverified properties are already refused); `IndexNowService.checkKeyFiles` (the owner-placed key file on `domain` and `www.domain`) |
| Page suggestions           | `project_key_pages` via `ProjectContextRepository.listKeyPages`; `pageTraffic(projectId)` in `seo-checks/seoCheckPlan.ts`                                                                                |
| Repository connection      | `PublishingRepository.getConnection(projectId)` → `publishing_connections` (`revoked_at`, `production_environment`)                                                                                      |
| Atomic write + audit       | `runBatch` (`src/db/runBatch.ts`) with `auditInsert` (`src/server/features/activity/auditLog.ts`); actions in `src/shared/auditActions.ts`                                                               |
| Email                      | `src/server/email/relay-email.ts` (`env.EMAIL`, `FROM`), as `sendHostedInvitationEmail` does                                                                                                             |
| Settings tab and UI pieces | `src/client/features/projects/SettingsTabs.tsx`, routes under `src/routes/_app/p/$projectId/settings/`; `useAppForm`, `DataTable`, `QueryState`, `ConfirmDialog`                                         |
| Real-database tests        | `createPublishingTestDatabase` (`publishing/repositories/publishingTestDb.ts`), which runs SQLite and Postgres                                                                                           |

"Activation" already names the dashboard onboarding checklist (`project_activation_state`, `src/server/features/activation/`). Call this one **protection readiness** in code to avoid the clash.

## Data model

Add `src/db/protection.schema.ts` and its twin `src/db/pg/protection.schema.ts`. Register them in `src/db/schema.ts` (imports and `AppSchema`), `src/db/d1/schema.ts`, `src/db/pg/schema.ts` and the import lists of `src/db/schema-parity.test.ts`. Generate both migrations with `pnpm db:generate` and read the SQL. Put the enum arrays in `src/shared/protection.ts` so the schema, Zod schemas and UI import one copy. IDs are `crypto.randomUUID()`; timestamps are ISO text written by the app, as in newer tables.

**`protection_enrollments`**, one per project:

| Column                                                 | Type and rule                                                                                   |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `id`                                                   | text primary key                                                                                |
| `project_id`                                           | text, not null, unique, FK `projects.id` on delete cascade                                      |
| `production_origin`                                    | text, not null: `https://host`, whose host is `projects.domain` or `www.` + it                  |
| `status`                                               | text enum `PROTECTION_STATUSES` = `setup`, `active`, `paused`, `ended`; default `setup`         |
| `scope_version`                                        | integer, not null, default 1; bumped by every change to the origin or the page set              |
| `check_hour_utc`                                       | integer 0–23, not null                                                                          |
| `origin_verified_at`, `origin_verified_by`             | text, nullable; `origin_verified_by` enum `search_console`, `indexnow_key`                      |
| `reviewer_user_id`                                     | text, nullable, no FK (like other user columns); must be a member of the project's organization |
| `alert_tested_at`, `alert_confirmed_at`                | text, nullable; cleared when the reviewer changes                                               |
| `allow_repair_proposals`, `allow_pull_requests`        | boolean, not null, default false; merging always stays with the customer                        |
| `notes`                                                | text, nullable, at most 1000 characters: response expectations and support contact              |
| `activated_at`, `paused_at`, `ended_at`                | text, nullable                                                                                  |
| `created_by`, `created_at`, `updated_by`, `updated_at` | text, not null                                                                                  |

`degraded` is never stored. IRFC-0002 derives it from coverage, as RFC-0026 requires.

**`monitored_pages`**, the agreed page set:

| Column                     | Type and rule                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| `id`                       | text primary key                                                                                   |
| `project_id`               | text, not null, FK `projects.id` on delete cascade                                                 |
| `enrollment_id`            | text, not null, FK `protection_enrollments.id` on delete cascade                                   |
| `path`                     | text, not null: pathname only, starts with `/`, no query or fragment, no trailing slash except `/` |
| `selection_reason`         | text enum `MONITORED_PAGE_REASONS` = `owner`, `key_page`, `top_traffic`                            |
| `excluded_reason`          | text, nullable, at most 300 characters; an excluded page is listed but never checked               |
| `scope_version`            | integer, not null: the enrollment's scope version when the row was added                           |
| `added_by`, `added_at`     | text, not null                                                                                     |
| `removed_by`, `removed_at` | text, nullable; removal keeps the row for history                                                  |

Partial unique index on (`enrollment_id`, `path`) where `removed_at` is null. `MAX_MONITORED_PAGES = 20` active, non-excluded rows per enrollment. Add `protection_enrollments.reviewer_user_id` and the `*_by` columns to `ATTRIBUTION` in `scripts/relay-erase-user-d1.ts`.

## Server functions, service and repository

Files: `src/serverFunctions/protection.ts`, `src/types/schemas/protection.ts` (inputs derived from `projectScope` with `.extend()`), `src/server/features/protection/ProtectionService.ts`, `src/server/features/protection/protectionReadiness.ts` (pure), `src/server/features/protection/repositories/ProtectionRepository.ts`.

Every function uses `requireProjectContext`. Writes call `requireOrgPermission(context, { integration: ["manage"] })` first, except `confirmProtectionAlert`.

| Server function               | Input (beyond `projectId`)                                                                                                 | Behavior                                                                                                                                                                                                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getProtection` (GET)         | none                                                                                                                       | Enrollment or null, active and excluded pages, readiness items, reviewer candidates. Any project member may read.                                                                                                                                                 |
| `saveProtectionSettings`      | `productionOrigin`, `checkHourUtc`, `reviewerUserId`, `notes`, `allowRepairProposals`, `allowPullRequests`                 | Creates the enrollment in `setup` or updates it. Origin changes only in `setup` or `paused`, bump `scope_version` and clear origin verification. A reviewer change clears both alert timestamps.                                                                  |
| `verifyProtectionOrigin`      | none                                                                                                                       | Passes when the GSC `site_url` covers the origin (`sc-domain:` + domain covers the domain and its subdomains; a URL-prefix property must have the same origin), else when `checkKeyFiles` reports `found` for the origin's host. Records the method.              |
| `suggestMonitoredPages` (GET) | none                                                                                                                       | Key pages (`money`, then `hub`, then others), then top pages from `pageTraffic`, on the production origin only, minus active rows. Extract `pageTraffic` from `seoCheckPlan.ts` into a shared seo-checks module so both callers import it.                        |
| `saveMonitoredPages`          | `expectedScopeVersion`, `add` (`path`, `selectionReason`, at most 20), `remove`, `exclude` (`pageId`, `reason`), `include` | One `runBatch`: a compare-and-set that bumps `scope_version` only from `expectedScopeVersion`, the row changes conditioned on that new version, and one `protection.pages_changed` audit row. Refuses a 21st active page, another origin, a query, or a fragment. |
| `sendProtectionTestAlert`     | none                                                                                                                       | Sends a test email to the reviewer's account email through a new `sendProtectionAlertEmail` in `relay-email.ts`; sets `alert_tested_at`. Errors when `env.EMAIL` is unset, and says so.                                                                           |
| `confirmProtectionAlert`      | none                                                                                                                       | Only the reviewer may call it, after a test was sent. Sets `alert_confirmed_at`.                                                                                                                                                                                  |
| `setProtectionStatus`         | `status`                                                                                                                   | `setup`→`active` only when readiness passes; `active`→`paused`; `paused`→`active` after readiness passes again; any→`ended`; `ended`→`setup` restarts and bumps `scope_version`.                                                                                  |

Add audit actions `protection.settings_changed`, `protection.origin_verified`, `protection.pages_changed`, `protection.alert_confirmed` and `protection.status_changed` to `AUDIT_ACTIONS`, each written with `auditInsert` in the same batch as its change. The reviewer is stored as a user ID and emailed at their account address, so no separate email address is kept. When the organization has no member rows (single-user delegated modes), the signed-in user is the only reviewer candidate.

## Readiness checklist

`protectionReadiness(input)` is a pure function of stored state that returns one item per checklist line, each with `state` (`passed`, `failed`, `not_available`, `not_required`), `required` and a one-sentence `message`.

| Item          | Required                        | Passes when                                                                             |
| ------------- | ------------------------------- | --------------------------------------------------------------------------------------- |
| `origin`      | yes                             | `origin_verified_at` is set for the current origin                                      |
| `repository`  | only if either permission is on | an active publishing connection with a production environment                           |
| `pages`       | yes                             | 1–20 active, non-excluded pages                                                         |
| `baseline`    | yes                             | `not_available` until IRFC-0002                                                         |
| `reviewer`    | yes                             | reviewer set, still a member, and `alert_confirmed_at` set                              |
| `schedule`    | yes                             | `not_available` until IRFC-0002                                                         |
| `repairs`     | no                              | `not_available` until IRFC-0004 and IRFC-0005                                           |
| `search_data` | no                              | shows whether GSC and GA4 are connected; missing data never blocks technical protection |

Activation needs every required item `passed`. Until IRFC-0002 ships, `baseline` and `schedule` keep activation blocked, and the page says why.

## Interface

- New settings tab **Protection** in `SettingsTabs.tsx`, route `src/routes/_app/p/$projectId/settings/protection.tsx`, component `src/client/features/protection/ProtectionSettings.tsx`.
- Sections:
  - **Site:** the origin input, **Verify ownership**, and which method passed.
  - **Pages:** a table with path, reason and exclusion; **Add from suggestions**; a counter showing N of 20.
  - **Reviewer and alerts:** the reviewer select and **Send test alert**. **I received it** appears only for the reviewer.
  - **Permissions:** two switches, with a note that the customer always merges and deploys.
  - **Readiness:** the checklist, and **Activate**, which is disabled with the failing reason.
  - **Status:** **Pause**, **Resume** and **End**, each behind a `ConfirmDialog`.
- Members without `integration:manage` see everything read-only.

## Tests

- `src/server/features/protection/protectionReadiness.test.ts`, table-driven:
  - each item's states;
  - `repository` is `not_required` with both permissions off;
  - `search_data` never blocks;
  - activation is allowed only when every required item passes.
- `src/server/features/protection/ProtectionService.test.ts`, real SQLite and Postgres through a new `repositories/protectionTestDb.ts` built on `createPublishingTestDatabase`:
  - a member without `integration:manage` is refused before any write;
  - a 21st page is refused, and so is a path on another origin or with a query;
  - a removed path can be added again, but one path never has two active rows;
  - a stale `expectedScopeVersion` writes nothing;
  - activation is refused while a required item fails, and the status stays `setup`;
  - only the reviewer can confirm the alert, and a reviewer change clears it;
  - an origin change outside `setup`/`paused` is refused, and an allowed one clears verification;
  - each save writes exactly one audit row.
- `verifyProtectionOrigin` coverage rules: `sc-domain:` covers subdomains, a URL-prefix property must match the origin exactly, and an `http` property does not cover `https`.
- Schema parity covers the new tables once registered.

## Acceptance gate

On an authorized site, record the origin, verify ownership, select 5–20 pages with one exclusion, choose a reviewer, send and confirm a test alert, and turn one permission on without a publishing connection. The checklist must show `repository` failing with its reason. With every other item passing, `baseline` and `schedule` show "not available until IRFC-0002" and **Activate** stays disabled. A member of another organization gets not found for every protection function.

## Explicit boundary

Do not promise automatic PRs or unattended monitoring before checks are scheduled. Do not build a CRM or store sales notes; store only the fields needed to run protection. No snapshots, check runs or incident alerts in this slice.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- State what was tested with fixtures and what was tested on a live authorized site. Never treat a test fixture or an unmerged PR as a production result.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**. Do not block later unrelated work.

**Next:** [IRFC-0002](0002-establish-protected-pages-and-known-good-production-baselines.md)
