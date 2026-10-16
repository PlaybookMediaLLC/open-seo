# RFC-0023: Launch workflows

- **Status:** Draft
- **Date:** 2026-10-15
- **Area:** retention, priority 7.
- **Depends on:** RFC-0005 (GitHub reads and deployment signals), RFC-0018 (weekly queue), RFC-0019 (monitoring and snapshots), RFC-0020 (link insertion and refresh), RFC-0021 (new pages and measurement).

## 1. Summary

A SaaS company launches features, integrations and products all the time. Each launch needs a page that search engines can find, links from related pages and docs, sitemap and index checks, and follow-up once real visitors arrive. Teams forget steps. This RFC ties Relay to the customer's normal release work: it notices a launch, runs a checklist that checks and fixes what it can, and keeps measuring after launch.

There is no final "cleanup complete" moment while the product keeps changing.

## 2. What exists today

| Part                | Location                                | Use in this RFC                                                        |
| ------------------- | --------------------------------------- | ---------------------------------------------------------------------- |
| GitHub reads        | RFC-0005 reader, compare API (RFC-0019) | Detect new route and content files in a deployment.                    |
| Snapshots and rules | RFC-0019                                | Indexability, canonical, title and description checks on the new page. |
| URL Inspection      | Existing Search Console service         | Index status after launch.                                             |
| Link insertion      | RFC-0020                                | Links from related pages.                                              |
| New pages           | RFC-0021                                | Create the page when it does not exist yet, and measure it.            |
| Docs index          | RFC-0017                                | Find the related docs page.                                            |

## 3. Goals

1. Start a launch from a person, or from a signal in a deployment.
2. Run a checklist with automatic checks and prepared fixes.
3. Monitor and measure the launch page for 12 weeks.
4. Turn real visitor questions into follow-up improvements.

## 4. Non-goals

1. No launch marketing (emails, social posts, ads).
2. No sitemap submission through the Search Console API, because that needs a write scope. Relay checks the sitemap only.

## 5. Design

### 5.1 Phases

| Phase | Delivers                                                                                                       |
| ----- | -------------------------------------------------------------------------------------------------------------- |
| 1     | Manual launches, launch detection from new route and content files, the checklist, monitoring and measurement. |
| 2     | Launch detection from GitHub releases and changelog entries. Follow-up questions at week 8.                    |
| 3     | Launch templates per launch kind, shared inside an organization.                                               |

### 5.2 Starting a launch

1. **Manual:** "New launch" with a name, a kind (`feature`, `integration`, `product`, `pricing`), a launch date and the main page URL (existing or planned).
2. **Detected (phase 1):** after each production deployment (RFC-0019 `deployment-watch`), compare the files with the previous deployment. A new App Router `page.*` file, or a new file in a configured content collection, creates a suggested launch: "A new page `/integrations/hubspot` went live. Track it as a launch?"
3. **Detected (phase 2):** a published GitHub release, or a new entry in the changelog file.
4. A suggested launch starts only after a person confirms it. Suggestions expire after 14 days.
5. When the main page does not exist yet, the launch offers the RFC-0021 page flow.

### 5.3 Checklist

| Step            | Check                                                                                                  | When it fails                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Live            | The page returns 200 on production.                                                                    | Wait, and check again after the next deployment.                                |
| Indexable       | No `noindex`, a self canonical, a title and a description within the length rules.                     | Prepare a fix with the RFC-0005 adapters, or a ticket.                          |
| In the sitemap  | The URL appears in a sitemap from `robots.txt` or `/sitemap.xml`.                                      | Ticket with the sitemap source file, when Relay can find it in the repository.  |
| Linked          | At least 2 internal links from related pages: a docs page, a product or index page, or the navigation. | Prepare link insertions with RFC-0020 from the best related pages.              |
| Structured data | Valid JSON-LD where the page kind usually has it (for example `SoftwareApplication` or `FAQPage`).     | Warning with advice. No automatic change.                                       |
| Docs            | A related docs page exists (RFC-0017 index) and links to the page.                                     | Suggest a docs addition (RFC-0017).                                             |
| Indexed         | URL Inspection at day 7 and day 14 shows the page indexed.                                             | Day 14: suggest more internal links, and check the sitemap and canonical again. |
| Monitored       | The page is added to RFC-0019 monitored pages.                                                         | Always passes.                                                                  |

Each step stores its status and evidence. Failed steps appear in the RFC-0018 Next list. Passed steps appear in Completed.

### 5.4 After launch

1. Measure the page as a new page (RFC-0021): first impression date, then impressions, clicks, queries and conversions at weeks 4, 8 and 12.
2. At week 8 (phase 2), list the queries that land on the page and are not answered on it. Offer them as RFC-0020 refresh steps, using verified facts.
3. Close the launch at week 12 with a short summary in the work report.

### 5.5 Data model

`launches`: `id`, `project_id` (FK cascade), `name`, `kind`, `launch_date`, `status` (`suggested`, `planned`, `live`, `monitoring`, `done`, `dismissed`), `source` (`manual`, `github_route`, `content_file`, `github_release`, `changelog`), `source_ref`, `created_by`, `created_at`.

`launch_pages`: `id`, `launch_id` (FK cascade), `url_path`, `role` (`primary`, `related`).

`launch_steps`: `id`, `launch_id` (FK cascade), `step_kind`, `status` (`pending`, `passed`, `failed`, `skipped`), `checked_at`, `detail` (at most 300 characters), `proposal_id`, `opportunity_id`, `regression_id` (nullable FKs).

Unique on `launch_steps` (`launch_id`, `step_kind`).

### 5.6 User interface

1. Project → **Launches**: suggested, active and done launches.
2. A launch page shows the checklist with each step's evidence, the prepared fixes, and the 12-week chart.
3. A suggested launch shows the files that triggered it.

## 6. Security

1. Launch detection uses read-only GitHub calls.
2. Every fix uses the exact-change approval and the RFC-0018 levels for its change class.

## 7. Cost

Free reads and fetches. Drafts cost model credits when the launch creates a page or a docs addition.

## 8. Alternatives considered

1. **A static launch checklist document.** It does not check anything and is easy to forget.
2. **Start launches only by hand.** Rejected as the only path. Deployments already show new pages, so Relay can offer them.

## 9. Ready-for-other-users checklist

### Phase 1

- [ ] `launches`, `launch_pages` and `launch_steps` in D1 and Postgres.
- [ ] Manual launch flow.
- [ ] Detection from new route and content files after a deployment (tests with compare API fixtures).
- [ ] Suggestion confirmation and 14-day expiry.
- [ ] Each checklist step with its check and its failure action (one test each).
- [ ] Day 7 and day 14 URL Inspection.
- [ ] Monitoring and 12-week measurement.
- [ ] Launch steps in the RFC-0018 view.
- [ ] `content/docs/launches.mdx`.

### Phase 2

- [ ] Release and changelog detection.
- [ ] Week-8 unanswered queries offered as refresh steps.

### Phase 3

- [ ] Launch templates per kind.

## 10. Real-site acceptance test

**Site:** S3. Use the next real Relay launch, for example the docs page for SEO checks (RFC-0010).

**Steps:**

1. Merge and deploy the new docs page without telling Relay.
2. Confirm the suggested launch.
3. Work the checklist: accept the prepared link insertions, merge and deploy them.
4. Follow the launch for 4 weeks.

**Pass when:**

- The suggestion appears within 30 minutes of the production deployment, with the triggering file.
- Every checklist step shows its evidence.
- After the link insertions ship, the page has at least 2 internal links from related pages.
- URL Inspection shows the page indexed by day 14, or the step explains why not.
- The weekly view shows the launch steps in Next and then in Completed.

**Value check:** every launch gets a findable, linked, indexed page, and nobody has to remember the steps.

## 11. Completion criteria

- 100% of new route files in test deployments create a suggestion. 0 suggestions for changed (not new) files.
- Every checklist step result matches a manual check of the live page.
- Link insertions reach the 2-link minimum for 3 of 3 test launches.
- Launch measurement data matches Search Console for the page within 1%.
