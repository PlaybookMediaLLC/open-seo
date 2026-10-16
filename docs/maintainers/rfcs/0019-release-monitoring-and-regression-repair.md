# RFC-0019: Release monitoring and regression repair

- **Status:** Draft
- **Date:** 2026-10-15
- **Area:** retention, priority 1.
- **Depends on:** RFC-0005 (adapters, deployment signals, publishing), RFC-0008 (tasks), RFC-0018 (standing approvals and the weekly view). Shares its comparison rules with RFC-0010.

## 1. Summary

Every deployment, plugin update, CMS edit or hosting change can break a page that brings traffic. RFC-0010 checks pull requests before merge, but only when the customer installs it, and it cannot see changes that do not come through Git. This RFC watches the production pages that matter, after every deployment and every day. It compares each page with its last known-good state, confirms each problem before it opens one, finds the likely cause, and repairs supported problems by restoring the known-good value through a pull request, within the customer's standing approvals.

## 2. What exists today

| Part                    | Location                                                  | Use in this RFC                                  |
| ----------------------- | --------------------------------------------------------- | ------------------------------------------------ |
| Pull request checks     | RFC-0010, `analyzeHtml`, rules in 5.6                     | The same rules, applied to production over time. |
| Deployment signals      | RFC-0005 (`GET /deployments`, statuses)                   | Trigger checks after each production deployment. |
| Publishing adapters     | RFC-0005 (App Router, helper calls, Pages Router)         | Locate and restore literal values.               |
| Safe fetch              | `readPages`, `normalizeAndValidateStartUrl`               | Every production fetch.                          |
| Tasks and notifications | RFC-0008                                                  | Scheduling, retries, alerts.                     |
| Standing approvals      | RFC-0018 `execution_policies`, class `restore_regression` | How far Relay acts without a click.              |
| Audit alerts today      | RFC-0008 `audit_followup`, `traffic_watch`                | Alerts only. No repair, no known-good state.     |

## 3. Goals

1. Check the pages that matter after every production deployment and once a day.
2. Keep a known-good state per page, and compare each new check with it.
3. Open a regression only after a second check confirms it.
4. Name the likely cause: the commits in the deployment, or "a change outside Git".
5. Repair supported regressions by restoring the known-good value in a pull request.
6. Let the owner accept an intentional change as the new known-good state in one click.

## 4. Non-goals

1. No full-site crawl. The site audit covers it.
2. No repair of content, layout or design. Those become tickets.
3. No CMS writes. Non-Git sites get detection and tickets only.
4. No deployment by Relay.

## 5. Design

### 5.1 Phases

| Phase | Delivers                                                                                                                                                          |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Monitored pages, snapshots, known-good states, daily and deployment triggers, confirmed regressions, cause analysis, tickets, restore pull requests for metadata. |
| 2     | Restores for literal robots meta and canonical values, and for static `robots.txt` files. GitHub App webhooks as the deployment trigger.                          |
| 3     | Rendered checks for client-rendered pages, and response-time regressions.                                                                                         |

### 5.2 Monitored pages

1. The set: key pages, the top pages by organic clicks up to the plan limit, one page per route template, `robots.txt` and the sitemaps.
2. Plan limits: for example 20 pages (free), 200 and 1,000 (paid). The exact numbers are set with RFC-0018 plans.
3. `monitored_pages`: `id`, `project_id` (FK cascade), `url_path`, `reason` (`key_page`, `top_traffic`, `template`, `owner_added`), `known_good_snapshot_id` (nullable), `added_at`, `removed_at`.
4. Refresh the top-traffic part weekly from Search Console data that is already stored.

### 5.3 Snapshots

`page_snapshots`:

| Column                                                                        | Type                                                         |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `id`                                                                          | text primary key                                             |
| `project_id`                                                                  | text, FK cascade                                             |
| `url_path`                                                                    | text                                                         |
| `fetched_at`                                                                  | text                                                         |
| `trigger`                                                                     | text enum `schedule`, `deployment`, `confirmation`, `manual` |
| `deployment_sha`                                                              | text, nullable                                               |
| `status_code`                                                                 | integer                                                      |
| `final_path`                                                                  | text, nullable (after redirects)                             |
| `title`, `meta_description`, `canonical`, `robots_meta`, `x_robots_tag`, `h1` | text, nullable, each at most 300 characters                  |
| `json_ld_types`                                                               | text, nullable, sorted and comma-separated                   |
| `json_ld_valid`                                                               | boolean                                                      |
| `hreflang_hash`, `content_hash`                                               | text, nullable                                               |
| `internal_link_count`, `word_count`                                           | integer                                                      |
| `response_ms`                                                                 | integer                                                      |

`site_snapshots`: `id`, `project_id`, `fetched_at`, `robots_txt_hash`, `googlebot_disallow_rules` (at most 2,000 characters), `sitemap_url_count`, `sitemap_hash`.

Keep the last 30 snapshots per page and every known-good snapshot. Delete the rest after 90 days in the retention task.

### 5.4 Known-good state

1. The first snapshot of a page becomes known-good when it has status 200 and no blocking rule fails on its own.
2. A later snapshot becomes known-good when it shows no blocking change against the current known-good state, and it is at least 24 hours old with a matching confirmation.
3. After Relay ships and verifies its own change, the verified snapshot becomes known-good.
4. "Accept as known-good" lets a member accept an intentional change. It closes the open regression as `accepted` and writes an audit event.

### 5.5 Triggers

1. **After deployment.** A task `deployment-watch` polls GitHub deployments for the production environment every 15 minutes (RFC-0005). Phase 2 uses App webhooks. A new successful deployment starts a check of all monitored pages within 10 minutes.
2. **Daily.** A daily check catches changes outside Git: CMS edits, plugin updates, hosting and CDN rules.
3. **Manual.** "Check now", at most 4 times per day per project.

### 5.6 Rules

Use one shared function with RFC-0010: `compareSnapshots(knownGood, candidate)`. RFC-0010 compares production with a preview. This RFC compares known-good with current production.

**Blocking:** `newly-noindex` (meta or header), `canonical-changed`, `status-regressed`, `newly-redirected`, `robots-txt-blocks`, `title-removed`, `description-removed`, `json-ld-invalid`, `sitemap-shrunk`.

**Warning:** `title-changed`, `description-changed`, `h1-changed`, `internal-links-dropped`, `content-shrunk`, and (phase 3) response time 3 times slower than known-good.

Production compares with production, so `X-Robots-Tag` is always checked.

### 5.7 Confirmation

1. A blocking finding schedules a confirmation snapshot 5 to 10 minutes later.
2. Open a regression only when the confirmation shows the same finding.
3. A `status-regressed` finding needs 2 failed confirmations, 10 minutes apart.
4. A finding that does not confirm is logged as "transient" and opens nothing.

### 5.8 Regressions

`site_regressions`:

| Column                                           | Type                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `id`                                             | text primary key                                                                                  |
| `project_id`                                     | text, FK cascade                                                                                  |
| `url_path`                                       | text, nullable (null for site-level rules)                                                        |
| `rule`                                           | text                                                                                              |
| `severity`                                       | text enum `blocking`, `warning`                                                                   |
| `detected_at`                                    | text                                                                                              |
| `last_good_snapshot_id`, `first_bad_snapshot_id` | text, FKs                                                                                         |
| `suspect_from_sha`, `suspect_to_sha`             | text, nullable                                                                                    |
| `impact_clicks_28d`                              | integer                                                                                           |
| `status`                                         | text enum `open`, `repairing`, `repaired`, `accepted`, `dismissed`                                |
| `resolution`                                     | text enum `restored_by_relay`, `fixed_by_customer`, `accepted_change`, `false_positive`, nullable |
| `resolved_at`                                    | text, nullable                                                                                    |

One open regression per page and rule. Blocking regressions on pages with clicks send a notification at once, and appear first in RFC-0018 Next.

### 5.9 Cause analysis

1. When both snapshots carry deployment SHAs and they differ, call the GitHub compare API for the two SHAs.
2. List the commits and the changed files. Mark files that map to the page (RFC-0004 locator), shared layouts, metadata helpers, `robots` files, `next.config.*` and middleware.
3. Show the suspect commits with their authors and pull requests.
4. When no deployment happened between the two snapshots, say: "No deployment happened between the checks. The change likely came from a CMS, a plugin, or a hosting or CDN setting."

### 5.10 Repair

**Supported restores:**

| Rule                                                      | Phase | Restore                                                                                         |
| --------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------- |
| `title-removed`, `title-changed`                          | 1     | Set the title literal back to the known-good value (RFC-0005 adapters, including helper calls). |
| `description-removed`, `description-changed`              | 1     | The same for the description.                                                                   |
| `newly-noindex` from a literal `robots` metadata value    | 2     | Restore the known-good `robots` literal.                                                        |
| `canonical-changed` from a literal `alternates.canonical` | 2     | Restore the known-good literal.                                                                 |
| `robots-txt-blocks` from a static `public/robots.txt`     | 2     | Remove only the added disallow line that blocks the page.                                       |

Everything else becomes a ticket with the evidence and the suspect commits.

**Flow:**

1. Relay prepares a restore proposal of change class `restore_regression`. The diff shows the known-good snapshot as the source of the value.
2. The RFC-0018 standing approval for this class decides the next step: `prepare` waits for a person, `open_pr` opens the pull request, and `merge` also merges it when branch protection and checks allow.
3. When the file no longer contains a literal (for example the value is now computed), Relay stops and opens a ticket.
4. After the deployment, the next snapshot must match the known-good value for the rule. Then the regression becomes `repaired`.
5. When a customer fixes it first, the next snapshot closes it as `fixed_by_customer`.

### 5.11 Limits and politeness

1. At most 2 parallel requests to the site. A 10-second timeout. HTML only, at most 2 MB.
2. User agent `RelayMonitor/1.0 (+https://relay.playbookmedia.io/docs/monitoring)`.
3. A per-project daily fetch budget: monitored pages × (1 daily + up to 3 deployments + confirmations).
4. The checks run in a Trigger.dev task, which posts results to a signed internal endpoint (RFC-0008).

### 5.12 User interface

1. Project → **Monitoring**: monitored pages, last check, known-good date, open regressions.
2. A regression page: the rule, the before and after values, the clicks at risk, the suspect commits, and the actions Restore, Accept as known-good, and Dismiss.
3. Each page gets a snapshot history (RFC-0024 timeline).

## 6. Security

1. Fetches use the URL policy on every hop, and only the project's own domain.
2. Restore proposals use the exact-change approval path. Policy actions follow RFC-0018 rules.
3. Snapshots keep short values and hashes, never full pages.

## 7. Cost

No paid providers. Trigger.dev compute per check run, and free GitHub reads.

## 8. Alternatives considered

1. **Run a full site audit after every deployment.** Too slow and costly. The monitored set covers the pages that bring traffic.
2. **Alert without repair.** Rejected. Alerts that the customer must handle are easy to cancel.
3. **Revert the whole suspect commit.** Rejected. A commit usually carries wanted changes too. Restoring one value is safer.

## 9. Ready-for-other-users checklist

### Phase 1

- [ ] `monitored_pages`, `page_snapshots`, `site_snapshots` and `site_regressions` in D1 and Postgres, with the parity test.
- [ ] Monitored set selection with the plan limit (tests).
- [ ] Shared `compareSnapshots` used by RFC-0010 and this RFC (one test per rule).
- [ ] Known-good rules, including the 24-hour rule and "Accept as known-good" (tests).
- [ ] `deployment-watch` and daily tasks, with the 10-minute start target.
- [ ] Confirmation rules (tests for transient and confirmed findings).
- [ ] Cause analysis with the compare API, and the "outside Git" message (tests).
- [ ] Title and description restores through the RFC-0005 adapters (tests, including helper calls).
- [ ] Repair flow under each RFC-0018 level (tests).
- [ ] Monitoring page and regression page.
- [ ] Immediate notification for blocking regressions on pages with clicks.
- [ ] `content/docs/monitoring.mdx`.

### Phase 2

- [ ] Robots meta, canonical and static `robots.txt` restores (tests).
- [ ] App webhooks for deployments.

### Phase 3

- [ ] Rendered checks for flagged pages, and the response-time rule.

## 10. Real-site acceptance test

### Phase 1

**Sites:** S1 (the staging deployment as a monitored site, deployed by the monorepo pipeline) and S3 (Relay production, for a change outside Git).

**Steps:**

1. Monitor S1 staging and S3 production for 14 days with no seeded change. Record every regression.
2. On S1 staging, deploy a commit that removes one page's meta description and changes another page's title.
3. On S3, add a Cloudflare response header rule that sends `X-Robots-Tag: noindex` on one test path. Remove it after the check.
4. Set `open_pr` for `restore_regression` on S1. Let Relay restore the description.
5. Accept the title change as known-good.

**Pass when:**

- The 14 quiet days produce 0 confirmed blocking regressions.
- The S1 regressions open within 15 minutes of the staging deployment, with the right suspect commit.
- The S3 regression opens at the next daily or manual check, with the "outside Git" cause.
- The restore pull request changes only the description literal back to the known-good value.
- After deployment, the regression becomes `repaired` with no click.
- The accepted title closes as `accepted`, and later checks stay quiet.

**Value check:** a release breaks a page, and Relay repairs it before the customer notices.

## 11. Completion criteria

**Detection**

- 100% of seeded blocking regressions are found within 15 minutes of a deployment, or at the next daily check for changes outside Git.
- 0 confirmed false blocking regressions over 14 days on S1 and S3.
- At least 90% of transient errors (seeded timeouts and one-off 5xx responses) close without a regression.

**Cause**

- The suspect commit list contains the real commit for every seeded Git regression.

**Repair**

- Every supported restore changes only the regressed literal, and passes the repository's own checks.
- Every repaired regression is verified by a snapshot that matches known-good.

**Load**

- Fetches stay inside the daily budget, with at most 2 parallel requests to the site.
