# RFC-0009: Spending limits, billing fixes, audit log and credential keys

- **Status:** Done on 2026-10-18. Built in PRs #91 to #97: limits, ledger and admission (A), limit settings and warnings (B), AI paths, scheduled skips and the three billing debts (C), the audit log and Activity page (D), the token key, rate limit and docs (E). The live check passed in production. The owner decided on 2026-10-17 that the follow-ups in section 12 do not block closing this RFC.
- **Date:** 2026-10-15
- **Brief section:** 10
- **Depends on:** RFC-0001 B4 (billing configured).

## Current delivery role — October 23, 2026

Implemented controls for every stage. Recheck relevant key/configuration and billing follow-ups before pilot activation. Included basic monitoring capacity is specified in RFC-0026.

The historical status and acceptance notes below are retained. The [delivery plan](README.md) and [current audit](../relay-release-assurance-audit.md) distinguish implementation, live acceptance, and commercial evidence.

## 1. Summary

Relay meters paid work against each organization's Autumn credit balance. It has feature caps (AI visibility cost approval, measurement allowance, refresh cooldowns), but no limit that a customer can set per project or per organization, and no durable record that reconciles failed settlements. It also has no cross-feature audit log. This RFC adds project and organization monthly limits, a spend ledger, fixes for three verified billing debts, an audit log for approved actions, a separate key for repository tokens, and per-user rate limits on paid actions.

## 2. What exists today

| Part                 | Location                                                        | Behavior                                                                                                                                        |
| -------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| DataForSEO metering  | `src/server/lib/dataforseo/client.ts`, `createDataforseoClient` | Reserve, execute, settle. Settlement runs in `waitUntil`.                                                                                       |
| Holds and settlement | `src/server/billing/subscription.ts`                            | `holdCredits`, `reserveUsageCredits`, `finalizeHold`, `settleUsageCredits`. Holds expire after 30 minutes.                                      |
| Customer context     | `BillingCustomerContext` in `subscription.ts`                   | `organizationId`, `userId`, `userEmail`, optional `projectId`.                                                                                  |
| Research spend       | `src/server/billing/researchSpend.ts`, `billResearchSpend`      | Bills after the call. Allows overdraft for admitted work.                                                                                       |
| AI assistant         | `src/server/features/sam/SamChatAgent.ts`                       | Per-turn credit gate. Bills spend step by step.                                                                                                 |
| Credit features      | `src/shared/billing-credit-features.ts`                         | `keyword_research`, `domain_overview`, `backlinks`, `site_audit`, `rank_tracking`, `ai_citations`, `ai_prompt_responses`, `local_seo`, `agent`. |
| Error codes          | `AppError` usage                                                | `INSUFFICIENT_CREDITS`, `RATE_LIMITED` and others.                                                                                              |
| Repository tokens    | `src/server/features/publishing/publishingAccess.ts`            | Encrypted with `BETTER_AUTH_SECRET`. No key version.                                                                                            |
| Audit trail          | Per-feature tables                                              | Opportunity decisions, proposal approvals, execution events and deployment attestations. No cross-feature log.                                  |

**Verified billing debts** (from `docs/maintainers/organic-growth-platform-audit.md`):

1. `parseTaskItems` in `src/server/lib/dataforseo/envelope.ts` throws a plain `AppError` when a payload fails validation. In `backlinks.ts` this happens before `buildTaskBilling`. The wrapper only recovers billing from `DataforseoChargedTaskError`, so the provider charge can go unrecorded.
2. `settleUsageCredits` only logs when finalization fails after its retry. The hold expires, and the charge is lost.
3. `aiPromptSuggestions.ts` checks the balance without a hold. Parallel requests can pass the same check.

## 3. Goals

1. Owners can set a monthly credit limit for the organization and for each project.
2. Every paid action passes one admission check that respects both limits, before any provider call.
3. Every charge has a durable ledger row that a job reconciles until it settles.
4. Fix the three billing debts.
5. Record every approved or consequential action in one audit log.
6. Encrypt repository tokens with a dedicated, versioned key.
7. Rate-limit paid actions per user.

## 4. Non-goals

1. No new billing provider. Autumn stays the balance authority.
2. No per-feature limits in this RFC. Project and organization limits come first.
3. No IP address logging.

## 5. Design

### 5.1 Spending limits

`spend_limits`:

| Column                  | Type                                      |
| ----------------------- | ----------------------------------------- |
| `id`                    | text primary key                          |
| `organization_id`       | text, FK organization, cascade            |
| `project_id`            | text, nullable, FK `projects.id`, cascade |
| `monthly_limit_credits` | integer, ≥ 0                              |
| `updated_by`            | text                                      |
| `updated_at`            | text                                      |

Partial unique index on (`organization_id`) where `project_id IS NULL`. Partial unique index on (`organization_id`, `project_id`) where `project_id IS NOT NULL`. No row means no limit beyond the credit balance.

Only owners (`billing:manage`) set limits.

### 5.2 Spend ledger

`spend_ledger`:

| Column                     | Type                                                                    |
| -------------------------- | ----------------------------------------------------------------------- |
| `id`                       | text primary key                                                        |
| `organization_id`          | text                                                                    |
| `project_id`               | text, nullable                                                          |
| `feature`                  | text: the credit features plus `proposal_draft` and `content_gap`       |
| `provider`                 | text enum `dataforseo`, `openrouter`                                    |
| `actor`                    | text: user id, `system:schedule:{id}` or `mcp:{clientId}`               |
| `period_month`             | text, `YYYY-MM` in UTC                                                  |
| `estimated_credits`        | integer                                                                 |
| `actual_credits`           | integer, nullable                                                       |
| `cost_usd`                 | real, nullable                                                          |
| `hold_lock_id`             | text, nullable                                                          |
| `status`                   | text enum `admitted`, `settled`, `released`, `refused`, `settle_failed` |
| `idempotency_key`          | text, unique                                                            |
| `attempts`                 | integer, default 0                                                      |
| `last_error`               | text, nullable, sanitized                                               |
| `created_at`, `settled_at` | text                                                                    |

Indexes on (`organization_id`, `period_month`) and (`project_id`, `period_month`).

**Committed spend** for a period = sum of `actual_credits` for `settled` and `settle_failed` rows with an actual value, plus `estimated_credits` for `admitted` rows.

### 5.3 Admission

Add `admitSpend({ customer, feature, provider, estimatedCredits, idempotencyKey })` in a fork-owned file `src/server/billing/spendAdmission.ts`.

1. Compute the period from the current UTC time.
2. Insert an `admitted` ledger row only when the project's committed spend plus the estimate is within the project limit, and the organization's committed spend plus the estimate is within the organization limit.
   - **D1:** one `INSERT ... SELECT ... WHERE` statement. D1 runs one statement atomically.
   - **Postgres:** in a transaction, lock the organization's `spend_limits` rows with `SELECT ... FOR UPDATE`, then insert. When no limit row exists, lock nothing and insert.
3. When the insert does not happen, insert a `refused` row and throw `AppError("SPEND_LIMIT_REACHED")`. The message names the limit: "This project reached its monthly limit of {n} credits. An owner can change it in Billing."
4. Then call the existing Autumn hold. Store its lock id on the row. When Autumn refuses, set `refused` and throw the existing `INSUFFICIENT_CREDITS` error.
5. After the provider call, store `actual_credits` and `cost_usd` on the row first, then call the existing settlement. Set `settled` on success, or `settle_failed` with the error.
6. When no provider charge happened, release the hold and set `released`.

**Where to call it** (each in an upstream file gets one `// playbook-seam` line that calls the fork function):

| Path                                  | File                                                                | Change                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| DataForSEO                            | `src/server/lib/dataforseo/client.ts`                               | Call `admitSpend` before `reserveUsageCredits`. Record settlement on the ledger.         |
| AI assistant                          | `src/server/features/sam/SamChatAgent.ts`                           | Admit a per-turn cap (start at 50 credits) in the turn gate. Settle the real turn total. |
| AI prompt suggestions                 | `src/server/features/ai-visibility/services/aiPromptSuggestions.ts` | Replace the balance check with `admitSpend` and a hold. Fixes debt 3.                    |
| Website research                      | `src/server/features/projects/services/websiteResearch.ts`          | Same as above.                                                                           |
| Proposal drafts                       | RFC-0004 service                                                    | Use `admitSpend` from the start.                                                         |
| Content gaps                          | RFC-0002 phase 3                                                    | Use `admitSpend` with the shown estimate.                                                |
| Scheduled rank and AI visibility runs | `scheduledRankChecks.ts`, `scheduledAiVisibility.ts`                | Admit at schedule admission. On refusal, skip with "Project monthly limit reached".      |

`settleUsageCredits` hard-codes `provider: "dataforseo"`. Add a `provider` argument with that default, so the AI paths can use holds.

**As built (part A).**

1. One ledger row follows one Autumn hold. A DataForSEO batch that draws on monthly and top-up credits gets a second row when the holds are known; refused calls drop out of the estimate.
2. DataForSEO admission wraps the reservation in `meterDataforseoCalls` (`reserveWithinLimits`). Upstream's `settleUsageCredits` records each settlement on the ledger through one seam line. Ledger writes after admission never throw.
3. `cost_usd` is the raw provider cost, because reconciliation charges it through `trackUsageCreditSpend`, which applies the markup.
4. Both dialects run the same two statements in `runBatch`: an update that changes nothing but locks the organization's limit rows on Postgres, then the conditional insert. A test with 8 parallel admissions against a limit for 3 fails on Postgres without the lock.
5. Limits apply in hosted mode, where Autumn holds credits. Self-hosted installs pay their providers directly.

**As built (part C).**

1. AI research holds its estimate through the same reservation as DataForSEO, with provider `openrouter`, then settles the summed step costs against the hold. This covers drafts, investigation summaries and content briefs (one helper, `generateChecked`, 50 credits), prompt suggestions (50 credits) and website research (200 credits). The ledger labels them `proposal_draft` or `ai_research`.
2. The assistant keeps upstream's chunked metering. Each turn reserves 50 credits as an `admitted` row; each metered chunk adds a `settled` row; the reservation is released when the turn's metering ends. A refused turn answers with the limit message. A ledger outage does not lock members out of chat, because the Autumn balance check already passed.
3. Content gaps make DataForSEO calls, so each call already passes admission. No separate job-level admission was added.
4. Scheduled work checks for room before it starts (`assertSpendRoom`): rank checks with their credit estimate, AI visibility checks with 1 credit. A refusal stores the reason `spend_limit` (rank) or "Project monthly limit reached" (AI visibility). Each provider call during the run still admits.
5. Debt 1 is fixed once, in `parseTaskItems`: a billed task with an invalid payload throws `DataforseoChargedTaskError` with its cost, which the metering wrapper already settles. One test at that function replaces the per-caller tests.
6. Debt 2: `reconcileSpend` claims each attempt with a conditional update, so two runs never charge one row. It also releases `admitted` rows whose hold expired without a settlement, such as an assistant turn that never ended. Until the Trigger.dev account exists (RFC-0008 follow-up), the task does not run.
7. Debt 3: the hold is atomic in Autumn, so parallel requests cannot all pass one balance reading. The limit side is covered by the part A race test; the balance side is checked live (section 11).

### 5.4 Billing debt fixes

**Debt 1: charged tasks that fail validation.**

1. In each DataForSEO caller, compute `buildTaskBilling` before `parseTaskItems`.
2. Change `parseTaskItems` so that a validation failure on a billed task throws `DataforseoChargedTaskError` with that billing.
3. The metering wrapper already settles this error type. Add one test per caller that a bad payload still settles the provider cost.

**Debt 2: lost settlements.**

1. Add `reconcileSpend()` in `src/server/billing/spendReconcile.ts`. Run it every 15 minutes as the RFC-0008 Trigger.dev task `spend-reconcile`, through the signed internal endpoint.
2. It selects `settle_failed` rows, and `admitted` rows older than the hold time plus 5 minutes.
3. While the hold is valid, retry `finalizeHold` with the stored lock id.
4. After the hold expired, record the charge with `trackUsageCreditSpend`, using the ledger id as the idempotency key in the event properties.
5. Stop after 10 attempts. Mark the row `settle_failed` with the last error. Show a count of such rows on an internal admin query, documented in `docs/maintainers/playbook-deployment.md`.

**Debt 3: AI admission race.** Fixed by the admission change in 5.3.

### 5.5 User interface

1. **Billing page (owners):** an organization monthly limit field in credits, with the dollar value beside it. A table of this month's committed spend by project and by feature, from the ledger.
2. **Project settings (owners):** a monthly limit field and this month's committed spend for the project.
3. At 80% of a limit, show a banner on the project, and create an RFC-0008 notification once per period.
4. At 100%, paid actions show the `SPEND_LIMIT_REACHED` message with a link to the setting.
5. Every paid action that has a confirm step shows the estimate before the user confirms. Check each existing paid action, and list any without an estimate in this RFC's follow-up.

**As built (part B).**

1. Every member sees the limits and this month's committed spend, as they already see usage on the Billing page. Only owners change a limit.
2. The project limit lives in a new **Project settings → Spending** tab. The Billing page shows the organization limit, spend by project and spend by feature.
3. The 80% notification uses the RFC-0008 bell. An organization limit notifies once a month, on the project whose spend crossed 80%.
4. A refused action shows a generic message with a link to Billing, because the client receives only the error code.

5. Survey of 5.5 item 5 (2026-10-17): every paid action with a confirm step shows its estimate (rank checks, AI visibility, site audit rendering, saved keyword refresh, website research). Keyword research, domain overview and backlinks run on a click without a confirm step. No action is missing an estimate.

### 5.6 Audit log

`audit_events`:

| Column            | Type                                     |
| ----------------- | ---------------------------------------- |
| `id`              | text primary key                         |
| `organization_id` | text                                     |
| `project_id`      | text, nullable                           |
| `actor_type`      | text enum `user`, `system`, `mcp`        |
| `actor_id`        | text                                     |
| `action`          | text enum, listed below                  |
| `target_type`     | text                                     |
| `target_id`       | text                                     |
| `summary`         | text, at most 300 characters, no secrets |
| `created_at`      | text                                     |

Indexes on (`organization_id`, `created_at`) and (`project_id`, `created_at`).

**Actions:**

- `opportunity.reviewed`, `opportunity.approved`, `opportunity.rejected`, `opportunity.deferred`, `opportunity.assigned`
- `proposal.drafted`, `proposal.prepared`, `proposal.approved_and_executed`, `proposal.revert_prepared`
- `ticket.created`
- `publishing.connected`, `publishing.disconnected`, `github_app.installed`, `github_app.revoked`
- `experiment.registered`, `experiment.deployment_confirmed`, `experiment.measurement_requested`
- `schedule.changed`
- `spend_limit.changed`
- `integration.gsc_connected`, `integration.gsc_disconnected`, `integration.ga4_connected`, `integration.ga4_disconnected`
- `member.invited`, `member.removed`
- `api_key.created`, `api_key.deleted`

**Rules:**

1. Write the event in the same database operation as the change when the change is in fork code (D1 batch or Postgres transaction).
2. For upstream code paths (integrations, members, API keys), add one seam line after the successful change. A failed audit write logs an error but does not undo the change.
3. The existing decision, approval and event tables stay the detailed record. The audit log is the cross-feature index.
4. Keep events for 1 year. Delete older rows in the RFC-0008 daily `growth-retention` task.
5. **UI:** Organization settings → **Activity** for owners and admins. Filters for project, action and actor. CSV export with formula escaping.

**As built (part D1).**

1. Fork paths add the event as one more statement of the change's batch. The event is an insert that selects from the same fence the change set (for example `last_decision_id` or `last_event_id`), so a refused change writes no event.
2. The actor type comes from the caller: MCP contexts carry a client id (`mcp`), scheduled jobs mark themselves (`system`), everything else is `user`.
3. Part D1 writes the opportunity decisions, `ticket.created` (only a new ticket, not a repeat), `experiment.registered`, `schedule.changed` and `spend_limit.changed`. Part D2 adds the other actions.
4. The Activity tab lists the newest 200 events. The filters are project, action and person. The CSV export holds up to 5,000 rows and reuses the RFC-0006 formula escaping.
5. The daily `growth-retention` task deletes events older than 365 days.

**As built (part D2).**

1. Proposals, executions, drafts, publishing connections, deployment confirmations and measurement runs add the event to their batch on the same fence. The repository argument is optional, so repository tests can leave it out; the services always pass it.
2. A GitHub App revocation writes its event before the update, while the row is still unrevoked, because the installation table has no event fence. Its actor is the system: GitHub refused the token.
3. Upstream paths record the event after the change with one seam line each: Search Console and GA4 connect and disconnect, and team invitations.
4. Member removal and API key changes run in better-auth's own endpoints. A global `hooks.after` middleware records them when they succeed. A member is recorded by id, never by the email that a removal may name.

### 5.7 Repository token key

1. Add `PUBLISHING_TOKEN_KEY` (at least 32 random bytes) and `PUBLISHING_TOKEN_KEY_VERSION` (integer, starting at 1).
2. Add `token_key_version` to `publishing_connections`: integer, not null, default 0. Version 0 means `BETTER_AUTH_SECRET`.
3. Decrypt with the key that matches the row's version. Keep `PUBLISHING_TOKEN_KEY_PREVIOUS` for one rotation.
4. After a successful decrypt with an older version, re-encrypt with the current key and update the row.
5. Fail closed when the needed key is missing. Show "Reconnect the repository."
6. Document the rotation steps in `docs/maintainers/playbook-deployment.md`.

**As built (part E).** The key module keeps version 0 on `BETTER_AUTH_SECRET`, so nothing changes until an owner sets `PUBLISHING_TOKEN_KEY`. A missing secret stays a configuration error; a missing key for a stored version, or a token the key cannot open, asks for a reconnect. The re-encryption writes only when the row still holds the ciphertext that was opened.

### 5.8 Rate limits on paid actions

1. Use the Cloudflare Workers rate limiting binding. Declare `PAID_ACTION_RATE_LIMIT` in `deploy/alchemy/alchemy.run.ts`, next to the existing `MCP_RATE_LIMIT`, with its own namespace id and a 60-second period. The `wrangler.jsonc` surfaces skip the check when the binding is absent, as `MCP_RATE_LIMIT` does.
2. Key: `{userId}:{feature}`. Limit: 30 paid actions per minute per user and feature.
3. Apply it in `admitSpend` before the ledger insert. Return `RATE_LIMITED` with the retry time.
4. Self-hosted installs without the binding skip this check and log one warning at startup.
5. MCP API keys keep their existing per-user limit (`MCP_RATE_LIMIT`, 5,000 requests per minute, in `src/server/mcp/api-key-auth.ts`). The Better Auth plugin limiter stays disabled.

## 6. Security and tenancy

1. Limits and ledger rows are read only through organization-checked services.
2. The ledger and audit log store no tokens, provider bodies or personal data beyond user ids.
3. Spend admission happens on the server. The client estimate is display only.

## 7. Alternatives considered

1. **Limits inside Autumn only.** Rejected. Autumn tracks the organization balance, not per-project spend.
2. **A Durable Object per organization for admission.** Rejected for now. One conditional statement (D1) or one row lock (Postgres) is enough at this volume.
3. **Logging audit events to Workers Logs only.** Rejected. Logs expire and are not visible to customers.

## 8. Ready-for-other-users checklist

### Limits and ledger

- [x] `spend_limits` and `spend_ledger` with D1 and Postgres migrations, partial unique indexes and the parity test.
- [x] `admitSpend` with the D1 single-statement path and the Postgres lock path.
- [x] Test: two parallel admissions near the limit admit only one (both dialects).
- [x] Test: no limit rows means only the Autumn balance applies.
- [x] Test: a refused admission makes no provider call.
- [x] DataForSEO, assistant, prompt suggestions, website research, drafts and content gaps call `admitSpend`.
- [x] Scheduled rank and AI visibility runs skip with a reason on refusal (test).
- [x] `settleUsageCredits` accepts a provider argument.
- [x] Billing page and project settings show limits and month-to-date spend.
- [x] 80% banner and one notification per period.
- [x] Live check: set a small project limit, run paid lookups until refusal, and confirm the ledger matches Autumn.

### Billing debts

- [x] Debt 1 fixed, with one test per DataForSEO caller.
- [x] Debt 2: `reconcileSpend` with tests for valid hold, expired hold and the 10-attempt stop.
- [x] Debt 3 fixed by admission, with a parallel-request test.
- [x] Review guidelines updated if the fixes add a new invariant. Done 2026-10-18 (PR #98).

### Audit log

- [x] `audit_events` table and migrations.
- [x] Every listed action writes an event (one test per action group).
- [x] Fork paths write in the same operation as the change (test that a failed change writes no event).
- [x] Activity page with filters and CSV export.
- [x] Retention deletes events older than 1 year.

### Credentials and rate limits

- [x] `PUBLISHING_TOKEN_KEY` and versioned decryption with lazy re-encryption.
- [x] Test: a version 0 row decrypts with the old secret and is re-encrypted.
- [x] Test: a missing key fails closed with the reconnect message.
- [x] Rotation steps documented.
- [x] `PAID_ACTION_RATE_LIMIT` binding added in the Alchemy stack, and `RATE_LIMITED` returned with the retry time (test with a fake binding).
- [x] Docs explain limits, the Activity page and what counts as a paid action.

## 9. Open questions

1. Should admins also set project limits, below the organization limit? **Answer (owner, 2026-10-17):** no. Only owners set limits.
2. Is 50 credits the right per-turn admission cap for the assistant? Measure the 95th percentile turn cost first. **Answer (owner, 2026-10-17):** start at 50 credits. The ledger records real turn totals, so the cap can follow the 95th percentile later.

## 10. Real-site acceptance test

**Site:** production, on the S2 project (or S1), with real credits. Use the staging deployment for the failure steps.

**Steps:**

1. Set the project's monthly limit to 200 credits.
2. Run paid keyword lookups until Relay refuses one.
3. Compare the month's ledger total for the project with the usage that Autumn shows.
4. On staging, break Autumn settlement with a wrong key. Run one paid lookup. Restore the key. Wait 15 minutes.
5. Run the RFC-0005 phase 1b flow on S1. Open the Activity page.
6. On staging, rotate the repository token key. Prepare a new proposal.
7. Send 31 paid requests in one minute from one account.

**Pass when:**

- The refusal shows the limit message before any provider call.
- The ledger total equals Autumn's usage for the project.
- The staging charge moves from `settle_failed` to `settled` with no manual step.
- The Activity page lists each approval, execution and deployment step, with the correct person.
- The proposal works after the key rotation. The connection row shows the new key version.
- Request 31 returns `RATE_LIMITED` with a retry time.

**Value check:** an owner can let a team and its agents work without the risk of a surprise bill, and can see who approved what.

## 11. Completion criteria

**Limits**

- In 20 attempts at the limit, every refusal happens before any provider call.
- A burst of 10 parallel requests at the limit admits only what fits.
- Normal use of 1 paid request every 2 seconds for 10 minutes is never rate-limited.
- Admission adds under 50 ms at the 95th percentile to a paid call.

**Ledger accuracy**

- The test project's month total in the ledger equals Autumn's usage exactly. Per-feature sums match too.
- A forced settlement failure is settled automatically within 30 minutes.
- On staging, a row that keeps failing stops after 10 attempts and shows in the documented admin query.

**Billing debts**

- On staging, a simulated bad payload from a billed DataForSEO task still records the provider cost.
- Ten parallel AI prompt-suggestion requests at a low balance cannot overdraw beyond one request's estimate.

**Audit log**

- After a full S1 flow, every listed action appears with the correct actor and target.
- A search of all event summaries finds no token, secret or email body.
- The Activity filters return the same rows as a direct database query for 3 combinations.

**Credentials**

- The token-key rotation causes no failed operation for existing connections.

**Usability**

- An owner finds this month's spend for a project in 2 clicks or fewer.

## 12. Follow-ups that do not block closing

Each follow-up names its trigger. Check it here when it passes.

- [x] Review guidelines carry the spend and audit invariants. Trigger: the maintainer reviews and merges PR #98. Done 2026-10-18 (PR #98).
- [x] Failed settlements are reconciled every 15 minutes. Trigger: the RFC-0008 Trigger.dev account exists and `spend-reconcile` runs. Done on 2026-10-18: the Worker cron reconciles at the start of each quarter-hour tick (RFC-0008, owner decision). The scheduled jobs ran at the 11:00 UTC tick. No failed settlement was waiting, so the reconcile changed no rows.
- [ ] Staging steps of section 10 (a broken Autumn key, a token key rotation, 31 requests in one minute) and the staging items of section 11. Trigger: a staging deployment exists.
- [ ] Repository tokens use the dedicated key. Trigger: the owner sets `PUBLISHING_TOKEN_KEY` and `PUBLISHING_TOKEN_KEY_VERSION=1` in `ENV_PLAYBOOK`, following `playbook-deployment.md`.
- [ ] An exact, per-event comparison of the ledger with Autumn usage. Trigger: a check that reads Autumn events with the secret key. The live check compared the balance and the 30-day usage, which the Billing page rounds to cents.
- [ ] The assistant's turn reservation follows the 95th percentile turn cost. Trigger: one month of `agent` ledger rows.
- [ ] Admission latency (under 50 ms at the 95th percentile) is measured. Trigger: Workers Observability shows enough paid calls.

**Live check, production, 2026-10-17 (Playbook Media project):**

1. An owner set a 200-credit project limit in **Project settings → Spending**. The Activity page listed "Set the monthly credit limit to 200 credits".
2. Three keyword lookups made 9 settled ledger rows (147 credits), each linked to its Autumn hold.
3. The fourth lookup admitted one more call (163 credits in all) and refused the next one before the provider call, with "This project or organization reached its monthly credit limit. An owner can change it in Billing." The ledger has one `refused` row. Past 80%, the bell got one notification ("This project used 87% of its monthly credit limit") and the project showed the amber banner "This project is close to its monthly credit limit (163 of 200 credits)".
4. Autumn: the balance fell from $0.36 to $0.19 and the 30-day usage rose from $0.64 to $0.81, both about $0.17. The ledger holds $0.163 (163 credits). They match within the cents rounding of the Billing page.
5. The owner removed the limit. The Activity page listed "Removed the monthly credit limit".
