# RFC-0018: Weekly execution queue and work report

- **Status:** In progress. Phase 1 built: the weekly cycle, the view, selection, empty-week reasons, the notification and history. Phase 2 in part: the monthly work report and the weekly digest.
- **Date:** 2026-10-15
- **Area:** retention. Build this first.
- **Depends on:** RFC-0001, RFC-0005 (execution and deployment signals), RFC-0006 (measurement), RFC-0008 (scheduled tasks and notifications), RFC-0009 (audit log and limits). Standing approvals for content classes depend on RFC-0025 (previews). It reads work from RFC-0002, RFC-0019, RFC-0020, RFC-0023 and RFC-0024 as they ship.

## 1. Summary

Customers keep paying when useful work is left to do and they can see it getting done. Today Relay has the parts: opportunities, drafts, pull requests, deployment signals and measurements. It has no single place that answers "What did Relay do for us this week, what is it still measuring, and what is next?"

This RFC makes that answer the project's home: a weekly cycle with three sections, **Completed**, **Measuring** and **Next**, backed only by real records. It adds standing approvals, so Relay can act within limits the customer sets. It adds plan limits for the recurring service, and a work report that makes the renewal decision easy.

The queue never invents work. When nothing is worth changing, it says so and explains why.

## 2. What exists today

| Part                        | Location                                                                         | Use in this RFC                             |
| --------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------- |
| Project home                | `src/routes/_app/p/$projectId/index.tsx` (upstream website dashboard, spec 0015) | Gets one summary card through a seam.       |
| Opportunities               | RFC-0002, RFC-0003                                                               | Candidates for Next.                        |
| Proposals and executions    | RFC-0005 (`opportunity_proposals`, `proposal_approvals`, `proposal_executions`)  | Source of Completed.                        |
| Deployment signals          | RFC-0005 `experiment_deployment_signals`                                         | Proof that a change is live.                |
| Experiments and split tests | RFC-0006, RFC-0011                                                               | Source of Measuring.                        |
| Tasks and notifications     | RFC-0008                                                                         | Weekly task and digest.                     |
| Audit log and limits        | RFC-0009                                                                         | Record of every action, and plan admission. |

## 3. Goals

1. One weekly view per project: Completed, Measuring and Next, plus Waiting on you.
2. Every item links to its evidence and its records. Nothing is a summary without a source.
3. Next holds only items that pass a quality bar. There is no weekly quota.
4. Customers can let Relay act on some change classes without a click, within limits they set.
5. Plan limits are visible, and they limit execution, never protection.
6. A work report shows the value delivered per month and per quarter, including negative results.

## 4. Non-goals

1. No new detection logic. Detection stays in the source RFCs.
2. No automatic deployment. Deployment always stays with the customer's pipeline.
3. No invented value figures. Money appears only where revenue data exists (RFC-0016).

## 5. Design

### 5.1 Phases

| Phase | Delivers                                                                      |
| ----- | ----------------------------------------------------------------------------- |
| 1     | Weekly cycle, the view, selection rules, empty-week reasons, digest, history. |
| 2     | Standing approvals (`open_pr` level), plan limits, monthly work report.       |
| 3     | Opt-in `merge` level for regression restores, quarterly review export.        |

### 5.2 Weekly cycle

1. A Trigger.dev task `weekly-cycle` runs per project, on Monday at 06:00 in the project's time zone. The time zone is the GA4 property's time zone when GA4 is connected, otherwise UTC. Owners can change the day, the hour and the time zone.
2. It is idempotent per project and week start.
3. Steps:
   1. Close the previous cycle. Compute its Completed list from the records of that week.
   2. Refresh detection when the latest run is older than 7 days (RFC-0002, inside its cooldown).
   3. Build the new Measuring, Next and Waiting lists.
   4. Write the cycle and send the notification and the digest.
4. The view also updates live during the week. The weekly cycle is the snapshot that history and reports use.

### 5.3 Sections

| Section            | Contains                                                                                                                                                                                                                           | Shows                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Completed**      | Changes whose pull request merged and whose deployment is verified (RFC-0005 signals) or attested. Regression repairs that passed verification (RFC-0019). Launch steps that passed (RFC-0023). Tickets whose GitHub issue closed. | Affected pages, the change, who approved it (person or standing approval), and the verification result. |
| **Measuring**      | Experiments and split tests inside their windows. New pages in their first 8 weeks (RFC-0021).                                                                                                                                     | Days left, data sufficiency, and the interim state without a label.                                     |
| **Next**           | Selected candidates (5.4).                                                                                                                                                                                                         | Evidence in one sentence, the pages, estimated effort, and the approval needed.                         |
| **Waiting on you** | Approvals pending for more than 3 days, and pull requests open for more than 7 days.                                                                                                                                               | Age, and one action button.                                                                             |

**As built (phase 1, sections).** Completed holds experiments whose pull request merged and whose deployment basis is verified or human-attested, with the deployment inside the week, and split tests deployed in the week. Measuring holds deployed experiments whose primary window is not complete, and running or verifying split tests. Waiting on you holds the newest unexecuted proposal of each approved item when it is more than 3 days old and unapproved, and Relay pull requests open for more than 7 days. Regressions (RFC-0019), launches (RFC-0023), new pages (RFC-0021) and campaigns (RFC-0020) join when those RFCs ship. Closed GitHub issues from tickets are not in Completed yet, because the ticket table does not record the issue state; reading it needs one GitHub request per ticket, so it is a follow-up.

### 5.4 Selection for Next

**Candidate pool:** open opportunities from all detectors, open regressions (RFC-0019), due campaign steps (RFC-0020), launch steps (RFC-0023), and revert recommendations from negative results.

**Hard filters.** A candidate is excluded when any of these is true:

1. Its evidence is older than 14 days.
2. Its confidence is below 0.4.
3. Its priority is below the project bar (default 40, owners can set 20 to 80).
4. Its page changed in the last 28 days, or is inside a measuring window (RFC-0024 cool-down). Regressions are exempt.
5. It repeats a change class that had a negative result on the same page in the last 180 days (RFC-0024).
6. Its needed connection is missing. Then it becomes a setup item, not a Next item.

**Order and limits:**

1. Open blocking regressions first, by severity and then by affected clicks.
2. Then other candidates by priority.
3. At most 5 Next items. This is a maximum, not a target.
4. At most 3 Relay pull requests open at the same time per project (owners can set 1 to 10). When the limit is reached, Next shows the items as "Ready after current changes merge".

**Empty or short weeks.** When Next has no items, show "Nothing worth changing this week" with the reasons the selection produced, for example:

- "2 changes are still measuring. Results arrive on November 12."
- "The best new candidate scored 32. The bar is 40."
- "Search Console data is 3 days old. Relay waits for complete data."

**As built (phase 1, selection).** Open means discovered, reviewed or approved. "The page changed" means an experiment on the same URL join key deployed in the last 28 days or still measuring; "the same change class" is the same opportunity type, with a negative primary result in the last 180 days. A missing GitHub connection excludes items and gives the setup reason "Connect GitHub to prepare N changes." instead of a Next entry, because an entry must link to exactly one record. At the open pull request limit, the items stay in Next with the reason "Ready after current changes merge". Every filter outcome adds its own empty-week reason when Next holds fewer than 5 items, and the reasons carry codes for analytics.

### 5.5 Standing approvals

A standing approval is an explicit human approval given in advance, for one change class, with a weekly limit. It can be revoked at any time.

`execution_policies`:

| Column                     | Type                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `id`                       | text primary key                                                                                           |
| `project_id`               | text, FK cascade                                                                                           |
| `change_class`             | text enum `restore_regression`, `meta_description`, `meta_title`, `alt_text`, `html_lang`, `internal_link` |
| `level`                    | text enum `suggest`, `prepare`, `open_pr`, `merge`                                                         |
| `max_per_week`             | integer, 1 to 20                                                                                           |
| `created_by`               | text                                                                                                       |
| `created_at`               | text                                                                                                       |
| `revoked_at`, `revoked_by` | text, nullable                                                                                             |

Partial unique index on (`project_id`, `change_class`) where `revoked_at IS NULL`.

**Levels:**

| Level                     | What Relay does                                                                                    | Who acts                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `suggest`                 | Shows the item with evidence.                                                                      | A person prepares and approves.                                                 |
| `prepare` (default)       | Drafts and prepares the exact change.                                                              | A person approves in Relay. Relay opens the pull request. A person merges.      |
| `open_pr` (phase 2)       | Approves the exact change under the policy and opens the pull request.                             | A person merges in GitHub. Branch protection and the customer's CI still apply. |
| `merge` (phase 3, opt-in) | Also merges its own pull request when every required check passes and branch protection allows it. | Nobody, inside the limits. Deployment stays with the customer's pipeline.       |

**Rules:**

1. Only owners set `open_pr` or `merge`. `merge` needs a typed confirmation of the project domain.
2. `merge` is allowed only for `restore_regression` (RFC-0019), which restores a value that was verified before. At most 3 per week.
3. Relay never bypasses branch protection, required reviews or required checks. When GitHub refuses the merge, the item moves to Waiting on you.
4. Every policy action stores an approval row with the exact change hash. Add `proposal_approvals.policy_id` (nullable FK). The actor is the policy's creator, recorded as `system:policy:{id}` in the audit log.
5. Every policy action sends a notification within 1 hour and appears in the weekly report.
6. New pages (RFC-0021) and content refreshes (RFC-0020) are never above `prepare`.
7. When a verification fails after a policy action, Relay pauses that policy, notifies the owner, and prepares a revert.
8. Content classes (`meta_description`, `meta_title`, `alt_text`, `html_lang`, `internal_link`) can use `open_pr` only after the change passed a preview (RFC-0025). Until RFC-0025 phase 1 ships, only `restore_regression` can use `open_pr`. `merge` always needs a passed preview when the project supports previews.

This changes the earlier rule "never write, merge or revert without an explicit human approval". A standing approval is that explicit approval, given in advance, scoped and limited. The README rule is updated with this RFC.

### 5.6 Plans and limits

The product sells as two parts:

1. **Onboarding cleanup**, one time: a full audit, baselines, and a first batch of changes over 30 days.
2. **Recurring monitoring and execution**, monthly, with explicit limits.

| Limit                      | Applies to                                     |
| -------------------------- | ---------------------------------------------- |
| Monitored pages            | RFC-0019 production monitoring.                |
| Executed changes per month | Pull requests that Relay opens, by any level.  |
| Active campaigns           | RFC-0020.                                      |
| New pages per month        | RFC-0021.                                      |
| Credits                    | Paid data and AI drafts (RFC-0009, unchanged). |

Rules:

1. Model the limits as Autumn products and features. Verify Autumn's feature types and the one-time product support before building.
2. Show usage in the view: "This month: 7 of 15 changes used."
3. At a limit, Next items stay visible and are marked "Over the plan limit". Execution stops. Monitoring and regression detection never stop.
4. Regression restores do not count toward the change limit, so protection never depends on the plan.

### 5.7 Work report

A monthly page, and a quarterly export through the existing report share links (specs 0012 to 0014):

1. Changes completed, with pages, approver and verification.
2. Regressions caught, with the clicks of the affected pages in the 28 days before, the time to repair, and who repaired them.
3. Results measured: encouraging, inconclusive and negative counts. Negative results are always shown.
4. Signups and revenue from changed pages, only where RFC-0012 or RFC-0016 data exists, with their caveats.
5. Approvals waiting on the customer, and the median time to approve.
6. Estimated effort completed, from the detectors' effort estimates, labeled "Relay's estimate".

The report answers the renewal question "Is this still doing valuable work for us?" with records, not claims.

**As built (phase 2, report).** The monthly report is a sheet on "This week", computed from records when asked: experiments deployed in the month with their deployment basis and the approver's name, the complete primary results that finished in the month (one per experiment, negative ones listed first, with the conversion event's GA4 totals before and after when RFC-0012 data exists, and first-touch revenue when RFC-0016 has 10 customers in each window), the approvals of the month with the median hours from preparation, and the approvals waiting now. Regressions join with RFC-0019. Effort is the sum of the completed items' effort estimates, labeled as Relay's estimate.

### 5.8 Data model

`work_cycles`:

| Column                                                              | Type                                     |
| ------------------------------------------------------------------- | ---------------------------------------- |
| `id`                                                                | text primary key                         |
| `project_id`                                                        | text, FK cascade                         |
| `week_start`                                                        | text, a date in the project's time zone  |
| `status`                                                            | text enum `open`, `closed`               |
| `generated_at`, `closed_at`                                         | text                                     |
| `completed_count`, `measuring_count`, `next_count`, `waiting_count` | integer                                  |
| `empty_reasons`                                                     | text, nullable, at most 1,000 characters |

Unique on (`project_id`, `week_start`).

`work_cycle_entries`:

| Column                                                                                                         | Type                                                  |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `id`                                                                                                           | text primary key                                      |
| `cycle_id`                                                                                                     | text, FK cascade                                      |
| `section`                                                                                                      | text enum `completed`, `measuring`, `next`, `waiting` |
| `rank`                                                                                                         | integer                                               |
| `opportunity_id`, `proposal_id`, `experiment_id`, `split_test_id`, `regression_id`, `launch_id`, `campaign_id` | text, nullable FKs, set null. Exactly one is set.     |
| `title`                                                                                                        | text, at most 200 characters, a snapshot              |
| `reason`                                                                                                       | text, at most 300 characters                          |
| `effort_hours`                                                                                                 | real, nullable                                        |
| `approval_needed`                                                                                              | text enum `none`, `review`, `approve_change`, `merge` |

The entries are a weekly snapshot. Live status comes from the linked records.

### 5.9 User interface

1. New fork-owned route `src/routes/_app/p/$projectId/work.tsx`, titled "This week". Add it first in the project navigation.
2. Add one summary card to the top of the project home through a `// playbook-seam` line: counts per section and the top Next item.
3. Each item card shows the title, the pages, one sentence of evidence, the effort, the approval needed and one action button.
4. "History" lists earlier weeks with their snapshots.
5. Settings → "Autonomy": the level per change class, the weekly limits, the quality bar, the open pull request limit, and the cycle day and hour.

**As built (phase 1, cycle and view).** The cycle is the RFC-0008 growth job `weekly_cycle`, run by the Worker cron like the other jobs (the owner's 2026-10-18 decision). Saving the cycle settings writes `work_settings` and sets the job's next run to the chosen weekday and hour in the chosen time zone; the weekly interval then keeps the weekday. A week starts at local midnight of the cycle day. The job runs the Search Console analysis first when the latest run is older than 7 days, writes the week once (a second run, or a concurrent one stopped by the unique index, writes nothing), recomputes and closes the earlier open weeks' Completed lists, sends one in-app notification per week, and captures `work_cycle:generated` with the counts and reason codes. "This week" (`/p/$projectId/work`) runs the same builder live; the weekly snapshot feeds History. The database refuses an entry with two links through a CHECK constraint; the code always writes exactly one, and a deleted record clears its link while the entry keeps its title. Settings and history live in sheets on the page, since Project settings belongs to upstream.

### 5.10 Digest

1. Always: an in-app notification per cycle.
2. When Loops is configured (RFC-0001 B3): a weekly email to opted-in members with the same three sections and Waiting on you.

**As built (phase 2, digest).** Relay sends email through the Cloudflare Email binding of RFC-0008 5.11, not Loops. The weekly cycle notification lists the top three items of each section and the short-week reasons, and the opt-in daily or weekly digest carries unread notifications, so it carries the sections.

### 5.11 Success metrics

Record these with product analytics from the first release:

1. Share of active projects with at least 1 Completed item in the last 4 weeks.
2. Median time from Next to Completed.
3. Share of weeks with an empty Next, by reason.
4. Approvals per project per week, and the median time to approve.
5. Regressions caught and repaired per month.
6. Renewal and cancellation by the number of completed items in the prior 90 days.

## 6. Security

1. Policy actions use the same exact-change approval and execution path as human approvals.
2. Only owners grant `open_pr` and `merge`. Every grant, revocation and action writes an audit event.
3. The cycle task runs with the schedule owner's current permissions (RFC-0008).

## 7. Cost

No paid providers. One cycle task per project per week. Detection refreshes stay inside their existing cooldowns.

## 8. Alternatives considered

1. **A task list without execution.** Rejected. Alerts that the customer must handle are easy to cancel.
2. **A fixed weekly quota of changes.** Rejected. Unnecessary edits damage trust and pages.
3. **Full autonomy by default.** Rejected. Autonomy is earned per change class, granted by the owner and limited.

## 9. Ready-for-other-users checklist

### Phase 1

- [x] `work_cycles` and `work_cycle_entries` in D1 and Postgres, with the one-link check and the parity test.
- [x] `weekly-cycle` task, idempotent per project and week (test: two runs give one cycle).
- [x] Completed computed only from merged and verified records (test with merged-not-deployed cases).
- [x] Selection with each hard filter (one test each) and the order and limits.
- [x] Empty-week reasons for each filter outcome (tests).
- [x] "This week" route, project home card (one seam line), history and settings.
- [x] In-app notification per cycle.
- [x] Product analytics events for the success metrics.
- [x] `content/docs/this-week.mdx` explains the sections, the bar and empty weeks.

### Phase 2

- [ ] `execution_policies` and `proposal_approvals.policy_id`.
- [ ] `open_pr` level with weekly limits (tests at the limit): `restore_regression` first, content classes only with a passed RFC-0025 preview (test).
- [ ] Policy pause and revert preparation after a failed verification (test).
- [ ] Plan limits through Autumn, the usage line, and "Over the plan limit" (tests).
- [ ] Regression restores excluded from the change limit (test).
- [x] Monthly work report with negative results included.
- [x] Weekly email digest when Loops is configured. Built on the RFC-0008 email digest, which uses the Cloudflare Email binding.

### Phase 3

- [ ] `merge` level for `restore_regression` only, with the typed confirmation and the 3-per-week cap.
- [ ] Test: a branch-protection refusal moves the item to Waiting on you, and nothing is bypassed.
- [ ] Quarterly export through report share links.

## 10. Real-site acceptance test

### Phase 1

**Sites:** S1 and S3 projects in production, for 4 weekly cycles.

**Steps:**

1. Turn on the weekly cycle for both projects.
2. Work the Next items normally for 4 weeks: approve, merge and deploy what is worth it.
3. Each Monday, compare the Completed list with GitHub and the deployment records.
4. Each Monday, the site owner rates each Next item: worth doing, not worth doing.

**Pass when:**

- Every Completed item links to a merged pull request and a verified or attested deployment. No item is missing.
- At least 80% of Next items are rated worth doing.
- No week shows more than 5 Next items, and no item breaks a hard filter.
- At least one week shows a short or empty Next with correct reasons, or the PR records why none occurred.
- The owner answers "What did Relay do for us this month?" from the view in under 1 minute.

**Value check:** the owner sees ongoing, verified work and a short, honest list of what comes next.

### Phase 2

**Site:** S1, with `open_pr` for `restore_regression` and `meta_description`.

**Pass when:**

- A seeded regression on staging gets a restore pull request with no click in Relay, inside the weekly limit.
- The approval row names the policy, and the audit log shows `system:policy:{id}`.
- Revoking the policy stops the next automatic action.
- The monthly report lists the change, the regression and every result, including any negative one.

## 11. Completion criteria

**Correctness**

- For 4 cycles on 2 projects, Completed equals the set of merged and verified changes in each week, checked against GitHub and the audit log.
- 0 duplicate cycles, and 0 items that break a hard filter.

**Usefulness**

- At least 80% of Next items rated worth doing across the test.
- At least 1 Completed item per project in at least 3 of the 4 weeks, or a recorded reason when not.

**Honesty**

- Every empty or short week shows the true reasons.
- The monthly report shows every negative result in the period.

**Autonomy (phase 2 and 3)**

- 100% of policy actions stay inside their class and weekly limit.
- 0 merges that bypass branch protection or a required check.
- A failed verification pauses the policy within 1 hour.

**Performance**

- "This week" shows first content in under 1.5 seconds with 1 year of history.
