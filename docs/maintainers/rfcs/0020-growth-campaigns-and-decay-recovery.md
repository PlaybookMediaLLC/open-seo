# RFC-0020: Existing-page growth campaigns and content decay recovery

- **Status:** Draft
- **Date:** 2026-10-15
- **Area:** retention, priorities 2 and 3.
- **Depends on:** RFC-0002 (detectors), RFC-0004 (drafting and investigation), RFC-0005 and RFC-0012 (change kinds), RFC-0017 (Markdown edits), RFC-0018 (weekly queue), RFC-0021 (verified facts), RFC-0024 (history and cool-downs).

## 1. Summary

Single opportunities come and go. Growth on existing pages comes from steady work on a set of pages with search demand: better snippets, internal links, refreshed content and clearer conversion paths. Pages also decay slowly, and a 28-day comparison misses it. This RFC adds campaigns, which run that work week by week within limits, and a decay detector with a recovery plan that ends in an executable refresh.

## 2. What exists today

| Part          | Location                                                                     | Use in this RFC                                      |
| ------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| Detectors     | RFC-0002 (`striking_distance`, `low_ctr`, `internal_link`, `declining_page`) | Campaign candidates.                                 |
| Investigation | RFC-0004 phase 3                                                             | Cause of a decline.                                  |
| Change kinds  | RFC-0005 (metadata), RFC-0012 (`copy_text`), RFC-0017 (`markdown`)           | How campaign steps ship.                             |
| Conversion    | RFC-0012                                                                     | Conversion path steps.                               |
| Weekly queue  | RFC-0018                                                                     | Where campaign steps appear.                         |
| Facts         | RFC-0021 `business_facts`                                                    | The only source for new claims in refreshed content. |
| History       | RFC-0024                                                                     | Cool-downs and no-repeat rules.                      |

Today, internal links and content refreshes end as tickets or briefs. They do not ship.

## 3. Goals

1. Campaigns that run ongoing improvements on a page set, with a goal, a limit and a stop rule.
2. Ship internal links and content refreshes as reviewed pull requests, not only tickets.
3. Detect slow content decay, find the cause, and prepare a refresh.
4. Measure each campaign, using unchanged pages in scope as a natural comparison.

## 4. Non-goals

1. No rewrites of whole pages.
2. No new claims without verified facts.
3. No campaigns that run without a person approving content changes.

## 5. Design

### 5.1 Phases

| Phase | Delivers                                                                                                                   |
| ----- | -------------------------------------------------------------------------------------------------------------------------- |
| 1     | Campaign model, snippet and internal-link campaigns, link insertion in Markdown and MDX, decay detector and recovery plan. |
| 2     | Content refresh steps from query coverage gaps and verified facts. Link insertion in JSX text. Conversion path campaigns.  |
| 3     | Campaign templates shared across projects, and split tests for campaign changes (RFC-0011).                                |

### 5.2 Campaign kinds

| Kind                         | Candidates                         | Change kinds                     | Goal metric                       |
| ---------------------------- | ---------------------------------- | -------------------------------- | --------------------------------- |
| `search_snippets`            | `low_ctr`, `striking_distance`     | Title and description (RFC-0005) | CTR and clicks                    |
| `internal_links`             | `internal_link`                    | Link insertion (5.4)             | Clicks to targets                 |
| `content_refresh`            | Decay and coverage gaps (5.5, 5.6) | `markdown`, `copy_text`          | Clicks and impressions            |
| `decay_recovery`             | `content_decay` (5.5)              | Ordered steps (5.6)              | Recover clicks to the prior level |
| `conversion_paths` (phase 2) | RFC-0012 detectors                 | `copy_text`                      | Conversions                       |

### 5.3 Campaign model

`campaigns`: `id`, `project_id` (FK cascade), `kind`, `name`, `goal_metric` (`clicks`, `ctr`, `conversions`), `goal_target` (nullable), `page_pattern` (nullable), `status` (`active`, `paused`, `completed`), `max_open_changes` (default 2), `started_at`, `ended_at`, `created_by`.

`campaign_pages`: `id`, `campaign_id` (FK cascade), `url_path`, `added_reason`, `status` (`pending`, `changed`, `measuring`, `done`, `skipped`), `baseline_clicks_28d`. Unique on (`campaign_id`, `url_path`).

`campaign_steps`: `id`, `campaign_id` (FK cascade), `campaign_page_id` (FK cascade), `step_kind`, `opportunity_id`, `proposal_id`, `experiment_id` (nullable FKs), `status` (`planned`, `in_review`, `shipped`, `measuring`, `done`, `skipped`), `planned_week`, `skip_reason`.

**Weekly planning** (inside the RFC-0018 cycle):

1. For each active campaign, pick the next steps up to `max_open_changes`, in priority order.
2. Apply the RFC-0018 hard filters and the RFC-0024 cool-downs.
3. When no step is eligible, mark the campaign "idle this week" with the reason.
4. A campaign completes when its goal is met, or when every page is done or skipped. It never invents steps to stay active.

### 5.4 Internal link insertion

A new edit type inside the existing change kinds.

1. Input: the source page, the target URL, and a phrase that already exists in the source page text (RFC-0004 anchor draft, or chosen by a person).
2. Locate the source text with the RFC-0012 copy locator. Exactly one match is required.
3. **Markdown and MDX (phase 1):** wrap the phrase as `[phrase](/target)` in the matched paragraph. Reject phrases inside headings, existing links, code and JSX blocks.
4. **JSX text (phase 2):** wrap the phrase in the link component that the file already imports for internal links (for example `Link` from `next/link`). When the file imports none, reject and offer a ticket. Never add imports in phase 2.
5. At most 1 new link per source page per step, and at most 3 links to the same target per week.
6. The diff shows the sentence before and after.

### 5.5 Content decay detection

New detector `content_decay`, separate from the 28-day `declining_page` rule:

1. Read weekly clicks per page for the last 16 complete weeks, and the same weeks a year earlier (2 free Search Console requests with `date` and `page` dimensions, aggregated by week).
2. A page decays when all of these hold:
   - Its 16-week peak (4-week average) is at least 50 clicks per week.
   - The last 4 weeks average at least 25% below that peak.
   - The decline lasted at least 4 weeks.
   - The year-earlier weeks do not show the same drop (within 70% of it). Otherwise mark it seasonal and skip it.
3. Store weekly evidence in `opportunity_weekly_evidence`: `id`, the three FKs, `week_start`, `clicks`, `impressions`, `position`, `period` (`current`, `year_ago`).
4. Reuse the RFC-0002 diagnosis values.

### 5.6 Recovery plan

For each `content_decay` item, Relay builds an ordered plan. It ships each step as its own change, and measures between steps.

1. **Check for a technical cause first.** Read the page's snapshot history (RFC-0019) for changes near the start of the decline. When one exists, propose a restore or a ticket, and stop the plan.
2. **Query coverage.** Compare the page's queries now and at the peak (2 free requests). List queries that lost clicks and whose terms do not appear in the page text.
3. **Content refresh step.** Draft one new or updated section that answers the lost queries:
   - Sources: the page's own text, project context, and verified facts (RFC-0021).
   - Every claim needs a source. A missing fact becomes a placeholder that blocks approval.
   - Ship it as a `markdown` or `copy_text` edit.
4. **Snippet step.** When the CTR also fell, add a title and description step.
5. **Internal link step.** When the page lost internal links (RFC-0019 snapshot counts) or has few, add link insertions from related pages.
6. **Measure.** After each shipped step, wait for its measuring window before the next content step.

### 5.7 Campaign measurement

1. For each campaign, compare changed pages with pages in scope that are not changed yet, over the same weeks. Report the difference as descriptive, with caveats.
2. When a campaign changes a template shared by 30 or more pages, offer an RFC-0011 split test instead.
3. The campaign page shows pages changed, pages measuring, results by label, and clicks of changed pages against unchanged pages.

### 5.8 User interface

1. Project → **Campaigns**: list, status, pages, open changes, results.
2. "New campaign": the kind, the scope (pattern or list), the goal and the limit. Relay previews the eligible pages first.
3. Decay items show the 16-week chart with the year-earlier line, the diagnosis and the recovery plan.

## 6. Security

1. Content drafts follow the RFC-0004 checks and the RFC-0021 fact rules.
2. Link insertion only wraps existing text. It never adds new text.
3. Content changes never go above the RFC-0018 `prepare` level.

## 7. Cost

Search Console requests are free. Drafts cost model credits.

## 8. Alternatives considered

1. **One-off opportunities only.** Rejected. They do not give a steady reason to stay, and work stops when the list is empty.
2. **Full page rewrites for decay.** Rejected. They are hard to review and measure, and they risk losing what still ranks.
3. **Add imports for links in JSX.** Rejected for now. Wrapping text with an already imported component keeps the diff small.

## 9. Ready-for-other-users checklist

### Phase 1

- [ ] `campaigns`, `campaign_pages`, `campaign_steps` and `opportunity_weekly_evidence` in D1 and Postgres.
- [ ] Weekly planning inside the RFC-0018 cycle, with limits, filters and idle reasons (tests).
- [ ] Snippet and internal-link campaigns.
- [ ] Markdown and MDX link insertion with every rejection case (tests).
- [ ] `content_decay` detector with each condition and the seasonal skip (tests).
- [ ] Recovery plan steps 1, 2, 4 and 5, with the technical check first.
- [ ] Campaign measurement with changed and unchanged pages.
- [ ] Campaigns page and decay chart.
- [ ] `content/docs/campaigns.mdx`.

### Phase 2

- [ ] Content refresh step with verified facts and blocking placeholders (tests).
- [ ] JSX link insertion with an existing link component only (tests).
- [ ] Conversion path campaigns.

### Phase 3

- [ ] Campaign templates and split tests for template-level campaign changes.

## 10. Real-site acceptance test

**Sites:** S2 (when it meets the data floor) for snippets and decay, and S3 docs for internal links and a refresh.

**Steps:**

1. Run decay detection on S2 with 16 months of data. The owner reviews every decaying page against the Search Console chart.
2. Start a `search_snippets` campaign on S2 with a limit of 2 open changes. Run it for 4 weekly cycles.
3. Start an `internal_links` campaign on S3 docs. Ship 3 link insertions.
4. Run a recovery plan on one decaying page, through the coverage step and one refresh step.

**Pass when:**

- The owner agrees that at least 4 of 5 decaying pages really decayed, and the seasonal skip is right where it applies.
- The campaign never has more than 2 open changes, and it reports idle weeks with reasons.
- Each link insertion changes one sentence, and the MDX builds.
- The refresh step uses only sourced claims, and it cannot be approved while a placeholder remains.
- The campaign page shows changed and unchanged pages over the same weeks.

**Value check:** the owner sees steady, limited work on the pages that matter, and a concrete plan for pages that slowly lose traffic.

## 11. Completion criteria

- Decay precision: at least 80% of flagged pages confirmed by the owner. 0 flagged pages with a matching year-earlier drop.
- Link insertion: 10 of 10 edits change only the target sentence. 0 links inside headings, code or existing links.
- Refresh drafts: 0 unsourced claims across 10 drafts.
- Campaign limits: 0 weeks above the open-change limit.
- At least 1 campaign step ships each week on S2 or S3 during the 4-week test, or the idle reason is recorded.
