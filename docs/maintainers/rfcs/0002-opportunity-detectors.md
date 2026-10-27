# RFC-0002: Opportunity engine, remaining detectors and signals

- **Status:** Done on 2026-10-16 for every item that Relay's code can close (PRs #65, #66 and #67). The items in section 13 wait on Search Console data, a paid run or RFC-0009. The owner decided on 2026-10-16 that they do not block closing this RFC.
- **Date:** 2026-10-15
- **Brief section:** 3 (Feature A)
- **Depends on:** RFC-0001. Phase 3 also depends on RFC-0009 (spending limits).

## Current delivery role — October 23, 2026

Implemented detection foundation. Reuse evidence and prioritization in stages 1 and 4; no new detector catalog blocks the release-assurance pilot.

The historical status and acceptance notes below are retained. The [delivery plan](README.md) and [current audit](../relay-release-assurance-audit.md) distinguish implementation, live acceptance, and commercial evidence.

## 1. Summary

The engine detects 2 of the 7 opportunity types in the brief, and it reads only Search Console. This RFC adds the 5 missing types, adds free first-party signals (brand terms, year-ago data, GA4, audits, rank history), and adds one paid signal (competitor keywords) behind an explicit, estimated, limited request.

## 2. What exists today

| Part       | Location                                                                     | Behavior                                                                                                                                                                                            |
| ---------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types      | `src/types/schemas/opportunities.ts`                                         | `striking_distance`, `declining_page`.                                                                                                                                                              |
| Statuses   | same file                                                                    | All 10 brief states.                                                                                                                                                                                |
| Detection  | `src/server/features/opportunities/services/detectOpportunities.ts`          | Pure function. Top 50 candidates by priority.                                                                                                                                                       |
| Collection | `src/server/features/opportunities/services/OpportunityService.ts`, `detect` | 3 Search Console requests (query+page, page, previous page). 28 final days ending 3 Pacific days ago. Row limit 1,000. 90-second deadline.                                                          |
| Throttle   | same, `DataRefreshClaimRepository`                                           | One claim per project (`opportunities:gsc:{projectId}`). 24-hour cache. 5-minute retry after failure.                                                                                               |
| Identity   | same, `identityKey`                                                          | SHA-256 of `[projectId, siteUrl, type, url, query]`. Re-detection refreshes the row and keeps human state.                                                                                          |
| Storage    | `src/db/opportunities.schema.ts` and `src/db/pg/opportunities.schema.ts`     | `opportunity_runs`, `opportunities`, `opportunity_evidence` (Search Console metrics only), `opportunity_decisions`.                                                                                 |
| Score      | `detectOpportunities.ts`, `candidate`                                        | `100 × confidence × (0.30 commercial + 0.25 demand + 0.20 visibility + 0.15 (1 − difficulty) + 0.10 inverse effort)`. Commercial comes from the key page role only. Difficulty is a position proxy. |

Enum columns are TypeScript-level `text` enums in both dialects. New enum values need no SQL migration. New columns and tables do.

## 3. Goals

1. Detect all 7 brief types: striking distance, declining pages, low click-through rate, cannibalization, technical blockers, internal links and content gaps.
2. Use free first-party data first: Search Console, GA4, site audits, rank history, project context and cached keyword metrics.
3. Use paid data only on an explicit request, with a cost estimate and a spending-limit check.
4. Store each evidence kind in its own normalized table.
5. Keep every rule deterministic, documented and testable. No model output decides whether an opportunity exists.
6. Keep identity stable, so a new run refreshes an opportunity instead of duplicating it.

## 4. Non-goals

1. No AI-written explanations in detection. RFC-0004 adds drafting after detection.
2. No traffic or revenue forecasts.
3. No automatic runs. RFC-0008 adds schedules.
4. No new crawler. Technical and link signals come from the existing site audit.

## 5. Design

### 5.1 Phases

| Phase | Types and signals                                                                                                                                     | Paid calls         |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1     | `low_ctr`, `cannibalization`, better `declining_page`, brand terms, year-ago data, GA4 commercial signal, cached keyword difficulty, larger row limit | None               |
| 2     | `technical_blocker`, `internal_link`, URL inspection, rank history                                                                                    | None               |
| 3     | `content_gap`, AI visibility evidence, optional live SERP check                                                                                       | Yes, explicit only |

### 5.2 Shared changes

**Types.** Add `low_ctr`, `cannibalization`, `technical_blocker`, `internal_link` and `content_gap` to `OPPORTUNITY_TYPES`. Each phase adds the values it detects. Enum values are TypeScript-level, so a later phase needs no migration for them.

**Detector layout.** Keep `detectOpportunities` as the single pure entry point. Move each type's rule into its own pure function in `src/server/features/opportunities/services/detectors/`. Keep one shared `scoreCandidate` helper for the formula. Each detector receives the same `DetectionInput` and returns candidates.

**Row limit.** Raise the query+page request from 1,000 to 5,000 rows. Keep 1,000 for the page-only requests. The Search Console API allows up to 25,000 rows per request at no cost. Keep the `truncated` flag and its confidence penalty.

**Request budget.** Reserve the full request count before network work, as today. Phase 1 uses 6 requests: query+page, page, previous page, the two year-ago page windows (see `declining_page`), and one GA4 report when GA4 is connected. A failed GA4 report does not fail the run. The run continues with page roles only and says so. Raise the deadline from 90 to 120 seconds.

**Run record.** Add to `opportunity_runs`:

| Column                | Type                                                                | Purpose                             |
| --------------------- | ------------------------------------------------------------------- | ----------------------------------- |
| `kind`                | text enum `search_console`, `content_gap`, default `search_console` | Paid content-gap runs are separate. |
| `year_ago_page_rows`  | integer, default 0                                                  | Row count of the year-ago requests. |
| `ga4_property_id`     | text, nullable                                                      | GA4 property used, if any.          |
| `audit_id`            | text, nullable, FK `audits.id` on delete set null                   | Audit used by phase 2.              |
| `inspection_requests` | integer, default 0                                                  | URL inspections reserved (phase 2). |

**Multiple URLs.** Cannibalization and internal links involve two or more URLs. Add `opportunity_urls`:

| Column           | Type                                                           |
| ---------------- | -------------------------------------------------------------- |
| `id`             | text primary key                                               |
| `project_id`     | text, FK `projects.id`, cascade                                |
| `opportunity_id` | text, FK `opportunities.id`, cascade                           |
| `url`            | text, not null                                                 |
| `role`           | text enum `primary`, `competing`, `link_source`, `link_target` |

Unique index on (`opportunity_id`, `url`, `role`). `opportunities.url` stays the primary target URL, so existing reads keep working. Roles can swap between runs, so a run replaces the URL rows of each opportunity that it refreshes.

**Per-URL and per-query evidence.** Add `url` and `query` to `opportunity_evidence`, both `text not null default ''`. An empty string means "the opportunity's own URL or query". Replace the unique index with (`opportunity_id`, `run_id`, `period`, `url`, `query`). Add `year_ago` and `year_ago_previous` to the `period` enum.

**Diagnosis.** Add `diagnosis` to `opportunities`: text enum `ranking_drop`, `demand_drop`, `ctr_drop`, `mixed`, `seasonal`, `unknown`, nullable. Only declining pages set it.

**Brand terms.** Add `project_brand_terms`:

| Column       | Type                                         |
| ------------ | -------------------------------------------- |
| `id`         | text primary key                             |
| `project_id` | text, FK `projects.id`, cascade              |
| `term`       | text, lowercase, trimmed, 2 to 60 characters |
| `created_by` | text enum `user`, `sam`, `mcp`               |
| `created_at` | text                                         |

Unique index on (`project_id`, `term`). Limit 20 terms per project. When a project has no saved terms, use one term from the first label of the project domain (for example `eigenn` from `eigenn.io`). The seed is not stored, so a project always has its domain term until a person saves terms. Show and edit terms on the project context page. Expose them through `get_project_context` and `update_project_context`. An `update_project_context` call can send only `brandTerms`, so its `updates` list becomes optional.

A query is branded when its lowercase text contains any brand term as a whole word.

**GA4 evidence.** Add `opportunity_ga4_evidence`:

| Column           | Type                            |
| ---------------- | ------------------------------- |
| `id`             | text primary key                |
| `project_id`     | text, FK cascade                |
| `opportunity_id` | text, FK cascade                |
| `run_id`         | text, FK cascade                |
| `period`         | text enum `current`, `previous` |
| `landing_page`   | text                            |
| `sessions`       | real                            |
| `key_events`     | real                            |
| `revenue`        | real, nullable                  |
| `currency`       | text, nullable                  |

Unique index on (`opportunity_id`, `run_id`, `period`).

**Commercial score.** Today it uses only the key page role. New rule:

1. Role score: money 1.0, hub 0.7, spoke or other 0.5, no role 0.25 (unchanged).
2. GA4 score, when GA4 is connected: 0 key events → 0; 1 to 9 key events → 0.7; 10 or more → 1.0, over the current 28 days of organic landing-page sessions.
3. Commercial score = the higher of the two.
4. When GA4 is not connected, add "GA4 not connected; commercial value uses page roles only." to the uncertainty text.

**Difficulty.** Use `keyword_metrics.keyword_difficulty / 100` when the project has a cached row for the query that is 90 days old or newer. Do not buy new metrics. Otherwise keep the position proxy. Say which source was used in `scoreExplanation`.

**Per-type defaults.** Store these as one exported constant table, and print them in the score explanation.

| Type                | Base confidence                            | Truncated confidence | Effort (hours)       |
| ------------------- | ------------------------------------------ | -------------------- | -------------------- |
| `striking_distance` | 0.65                                       | 0.45                 | 2                    |
| `declining_page`    | 0.50                                       | 0.35                 | 4                    |
| `low_ctr`           | 0.55                                       | 0.40                 | 1                    |
| `cannibalization`   | 0.40                                       | 0.30                 | 4                    |
| `technical_blocker` | 0.50, or 0.70 when URL inspection confirms | 0.40                 | 1 to 8 by issue type |
| `internal_link`     | 0.45                                       | 0.35                 | 0.5                  |
| `content_gap`       | 0.35                                       | 0.25                 | 8                    |

### 5.3 Detector rules

All thresholds are named constants. Unit tests cover each boundary.

#### `low_ctr` (phase 1)

1. Use current-period query+page rows. Remove branded queries.
2. Build the site's own click-through curve. Round each row's position to the nearest whole number from 1 to 10. For each position with at least 5 rows that have 100 or more impressions, take the median CTR.
3. Skip positions without a curve value. Do not use an external benchmark.
4. For each page, sum its non-branded rows at positions 1 to 10:
   - `impressions` = sum of impressions.
   - `expected` = sum of (row impressions × curve CTR at its position).
   - `observed` = sum of clicks.
5. Create a candidate when impressions ≥ 500, `observed / expected` ≤ 0.6, and `expected − observed` ≥ 20.
6. Identity: type and URL. The query is null.
7. Evidence: the page report row for the URL, plus the top 5 queries by impressions as per-query rows. These rows match Search Console exactly. The sums in the explanation cover only the non-branded rows at curve positions.
8. Visibility score: `(expected − observed) / expected`.
9. Explanation: "This page got {observed} clicks from {impressions} non-branded impressions in positions 1 to 10. Pages on this site at the same positions got about {expected} clicks."
10. Action: "Check the live search results. Then rewrite the title and description for the main queries."
11. Uncertainty: "Ads, AI answers, featured snippets and other results can lower clicks. Positions are averages."

#### `declining_page` (phase 1 changes)

1. Keep the current rule: previous clicks ≥ 30, loss ≥ 20, and loss ≥ 30%.
2. Request the current and previous windows one year earlier (start and end minus 364 days, so weekdays match). A year-ago loss needs both windows.
3. Set `diagnosis`:
   - `seasonal`: the year-ago windows show a click loss of at least 70% of the current loss for the same page. Multiply confidence by 0.6.
   - `ranking_drop`: average position worsened by 2 or more.
   - `ctr_drop`: impressions changed by less than 15%, and CTR fell by 30% or more.
   - `demand_drop`: impressions fell by 30% or more, and position changed by less than 1.
   - `mixed`: two or more of the last three match.
   - `unknown`: none match.
4. Store the year-ago page rows as evidence with periods `year_ago` and `year_ago_previous`.
5. Put the diagnosis in the explanation in plain words.

#### `cannibalization` (phase 1)

1. Use current non-branded query+page rows.
2. For each query, keep pages with impressions ≥ 50 and position ≤ 20.
3. The query qualifies when at least 2 pages remain and the two largest each have ≥ 25% of the query's impressions.
4. If the two URLs differ only by trailing slash, protocol, `www` or letter case, do not create this type. Phase 2 reports it as a technical canonical issue.
5. Group qualifying queries by the sorted URL pair.
6. Create a candidate when the pair shares 2 or more queries, or the shared queries total 200 or more impressions.
7. Identity: type and the sorted URL pair. Query is null.
8. URLs: the page with more clicks is `primary`. The other is `competing`.
9. Evidence: the primary URL's page report row, plus one current row for each URL and shared query, for up to 10 shared queries.
10. Visibility score: twice the smaller URL's share of the shared-query impressions. An even split scores 1.
11. Explanation: "Two pages rank for the same {n} queries. This can split clicks, but it is not always a problem."
12. Action: "Check whether both pages serve the same intent. If they do, merge or differentiate them, and point internal links to one page."

#### `technical_blocker` (phase 2)

1. Load the latest completed audit for the project. Skip this type when no audit completed in the last 30 days. Report "No recent site audit. Run an audit to check technical blockers." in the run result.
2. Load issues of these types: `noindex-page`, `blocked-page`, `canonicalized-page`, `canonical-conflict`, `broken-page`, `server-error`, `redirect-loop`, `redirect-chain`, `javascript-rendering-suspected`, `missing-title`, `duplicate-title`, `slow-response`.
3. Normalize URLs before the join: lowercase host, remove the fragment, remove the default port, remove a trailing slash except on the root.
4. Create a candidate when the page has ≥ 50 impressions in the current or previous period, or the page is a key page.
5. Identity: type, URL and issue type (see 5.4). The `query` column stays null.
6. For the top 10 candidates by priority whose issue can stop indexing, call the existing URL Inspection service. It is free, but Google limits it per property per day. A project can use 50 inspections a day. The run reserves its inspections in `opportunity_runs.inspection_requests` before network work, so failed runs count too. Skip inspection when the daily budget for the project is used, and say so in the run result. Inspection confirms an issue when the verdict is not `PASS`. Detection runs again with the results, so confirmed candidates get confidence 0.70.
7. Store audit evidence in `opportunity_audit_evidence`:

   | Column                                   | Type                                           |
   | ---------------------------------------- | ---------------------------------------------- |
   | `id`                                     | text primary key                               |
   | `project_id`, `opportunity_id`, `run_id` | FKs, cascade                                   |
   | `audit_id`                               | text, FK `audits.id`, cascade                  |
   | `audit_issue_id`                         | text, nullable, FK `audit_issues.id`, set null |
   | `issue_type`                             | text                                           |
   | `severity`                               | text enum `critical`, `warning`, `info`        |
   | `page_url`                               | text                                           |
   | `audit_completed_at`                     | text                                           |

8. Store inspection evidence in `opportunity_inspection_evidence`: `id`, the three FKs, `url`, `verdict`, `coverage_state`, `indexing_state`, `robots_txt_state`, `page_fetch_state`, `google_canonical`, `user_canonical`, `last_crawl_time`, `inspected_at`.
9. Map each issue type to one plain-language action and an effort estimate in a constant table.
10. Visibility score: 1 for an issue that can stop indexing, 0.5 for the others (`redirect-chain`, `missing-title`, `duplicate-title`, `slow-response`). Difficulty uses the page position, or 0.5 when Search Console has no row for the page.

#### `internal_link` (phase 2)

**New audit data.** The crawler keeps link edges only in the per-audit Durable Object scratchpad (`src/server/features/audit/AuditScratchpad.ts`), which it destroys after success. A new workflow step between the link checks and finalize persists `audit_page_inlinks`: `id`, `project_id` (FK cascade), `audit_id` (FK cascade), `target_page_id` (FK cascade), `source_page_id` (FK cascade). Unique on (`audit_id`, `target_page_id`, `source_page_id`). Write rows only for targets that are project key pages with role `money` or `hub`. Cap at 100 targets and 2,000 sources per target. A failure is logged and never fails the audit.

The scratchpad gets one generic method that lists the inlinks of given URLs. On a synthetic 5,000-page graph with 500,000 links, the query takes about 1.5 seconds.

An earlier draft also stored `audit_pages.inbound_link_count`. No rule reads it, and it would add a fork column to an upstream table, so it is left out.

**Rule:**

1. Targets: key pages with role `money` or `hub` that have ≥ 3 non-branded queries with impressions.
2. A source qualifies when it is a different page, it has impressions for one of the target's top 10 queries at position ≤ 30, the audit shows it as status 200 and indexable, and it does not already link to the target.
3. Rank sources by their impressions on the shared queries. Keep the top 5 per target.
4. Identity: type, target URL and source URL.
5. URLs: target is `primary` and `link_target`. Source is `link_source`.
6. Store `opportunity_link_evidence`: `id`, the three FKs, `audit_id`, `source_url`, `target_url`, `shared_query`, `source_impressions`, `source_position`.
7. Action: "Add a contextual link from the source page to the target page, in text about '{shared_query}'."
8. Skip this type when the latest audit has no inlink rows. Say so in the run result.
9. Skip a target that has 2,000 inlinks, the cap. Almost every page links to it, and a missing row there proves nothing.
10. Visibility score: (target position for the shared query − 1) / 19. Demand uses the source impressions on the shared queries.

#### Rank history evidence (phase 2)

For any candidate whose query is a tracked keyword, add rank evidence. Today only `striking_distance` has a query; a declining page is about all queries of a page. Store `opportunity_rank_evidence`: `id`, the three FKs, `tracking_keyword_id`, `device`, `first_position`, `last_position`, `first_checked_at`, `last_checked_at`, over the last 30 days. Rank history does not change the score in this RFC.

#### `content_gap` (phase 3, paid)

1. A user starts it with "Find content gaps". It never runs on a schedule in this RFC.
2. The user picks up to 3 competitors from `project_competitors`.
3. The dialog shows the cost estimate from the existing DataForSEO ranked-keywords pricing. The user confirms.
4. Admission goes through the RFC-0009 spending check, then the existing hold, execute and settle path in `createDataforseoClient`. Until RFC-0009 ships, the credit hold is the only admission check: it refuses a call before any provider request when the balance is too low. The run refuses when the estimate is now higher than the credits the person confirmed. Purchases run one competitor at a time, and each is saved before the next starts, so a refusal keeps what was already bought.
5. Cache competitor data for 30 days in two new tables:
   - `competitor_keyword_snapshots`: `id`, `project_id` (FK cascade), `domain`, `location_code`, `language_code`, `fetched_at`, `row_count`, `estimated_credits`. Unique on (`project_id`, `domain`, `location_code`, `language_code`, `fetched_at`). The metered client does not return the settled charge to its caller, so the snapshot keeps the reserved estimate; the settlement charges the provider's real cost, which is never higher.
   - `competitor_keyword_rows`: `id`, `project_id` (FK cascade), `snapshot_id` (FK cascade), `keyword`, `position`, `url`, `search_volume`, `keyword_difficulty`, `intent`.

   The paid request asks for at most 1,000 organic rows per competitor, already filtered to position 10 or better and 50 or more monthly searches, ordered by search volume.

6. Reuse a snapshot younger than 30 days. Do not buy it again.
7. A keyword is a gap when the competitor position is ≤ 10, search volume ≥ 50, intent is `commercial` or `transactional`, the site has fewer than 10 impressions for that exact query, and no tracked keyword ranks ≤ 20 for it.
8. Group gap keywords into topics. Remove stop words (a short English list). For each keyword, take its two tokens that are most frequent across all gap keywords, in sorted order, as the topic key. A keyword counts once, even when several competitors rank for it.
9. Create a candidate when a topic has 3 or more keywords, or 500 or more total search volume.
10. URL: the site page with the most impressions on any query that shares a token with the topic. If none exists, use the property root.
11. Identity: type and topic key.
12. Store `opportunity_keyword_evidence`: `id`, the three FKs, `keyword`, `location_code`, `language_code`, `search_volume`, `keyword_difficulty`, `intent`, `competitor_domain`, `competitor_url`, `competitor_position`, `fetched_at`.
13. Action: "Write a brief for a new or refreshed page about this topic." Create a page only through RFC-0021, from verified facts, with a person's approval.
14. Score: demand uses the topic's monthly searches, visibility is 1, and difficulty is the mean competitor keyword difficulty. Evidence keeps up to 20 keyword rows per topic.
15. A content-gap run is a separate run kind (`content_gap`). It has its own claim, so it never ends a running Search Console run, and the Search Console cache ignores it.

#### AI visibility evidence (phase 3)

1. For each opportunity URL, count the AI answers from the last 30 days that cite that URL (`ai_sources`). Use the project's tracker with the most completed answers. `answers` is that tracker's completed answers in the period, so "0 of 24" is also evidence.
2. Store `opportunity_ai_evidence`: `id`, the three FKs, `tracker_id`, `citations`, `answers`, `period_start`, `period_end`.
3. Show it in the detail view. It does not change the score in this RFC.

#### Live SERP check (phase 3, paid)

1. On a `low_ctr` opportunity, the user can click "Check live results".
2. Reuse the existing SERP service. Show the cost first. Cache the result for 24 hours.
3. When the results page has ads, an AI answer or a featured snippet above the page, lower confidence by 0.15 and say why.
4. When it has none, raise confidence by 0.10.
5. Store each check in `opportunity_serp_checks`: `id`, `project_id`, `opportunity_id`, `keyword`, `page_position`, `has_ads`, `has_ai_overview`, `has_featured_snippet`, `confidence_delta`, `estimated_credits`, `checked_at`. The check uses the page's top query by impressions. A feature counts as above the page when its rank is lower than the page's, or when the page is not in the first 20 results.
6. The check updates the opportunity's confidence and priority at once, from the type default plus the change, and says why in the score explanation. A detection run within 24 hours of a check applies the same change.

### 5.4 Identity

Extend `identityKey` to hash a tuple per type:

| Type                | Tuple                                       |
| ------------------- | ------------------------------------------- |
| `striking_distance` | project, site, type, URL, query             |
| `declining_page`    | project, site, type, URL, null              |
| `low_ctr`           | project, site, type, URL, null              |
| `cannibalization`   | project, site, type, sorted URL pair        |
| `technical_blocker` | project, site, type, URL, issue type        |
| `internal_link`     | project, site, type, target URL, source URL |
| `content_gap`       | project, site, type, topic key              |

Existing hashes must not change. Keep the current tuple shape for the first two types.

### 5.5 Service changes

1. `OpportunityService.detect` loads brand terms, key pages, GA4 connection, latest audit and cached keyword metrics before the network phase.
2. It reserves the full request count, as today.
3. It runs the requests in parallel under one deadline.
4. It passes all inputs to `detectOpportunities`.
5. `OpportunityRepository.completeRun` writes the new evidence tables in the same atomic operation as today.
6. The result message names each skipped type and why, for example "No recent site audit" or "GA4 not connected".

A new `OpportunityService.detectContentGaps` runs phase 3 under its own claim key `opportunities:content-gap:{projectId}`, with a 24-hour cooldown.

### 5.6 User interface

1. Add a label, an icon and a short help text for each new type.
2. In the detail view, show one evidence section per evidence kind: Search Console, year-ago, GA4, audit issues, URL inspection, competing URLs, link sources, rank history, competitor keywords and AI citations.
3. Add a brand-terms editor to the project context page.
4. Add a "Find content gaps" action with a competitor picker and a cost confirmation.
5. Show skipped types and reasons in the run log.

## 6. Security and tenancy

1. Every new table carries `project_id`. Every read filters by project after the organization check in the service.
2. Competitor domains and SERP results are untrusted text. Escape them in the UI.
3. Do not follow URLs from provider responses.
4. URL inspection uses the stored Google token through the existing service. No new token handling.

## 7. Cost

| Phase | Provider                                     | Cost to us                                                                                               |
| ----- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1     | Search Console, GA4                          | Free (Google quota only)                                                                                 |
| 2     | Search Console URL Inspection, internal data | Free (Google quota only)                                                                                 |
| 3     | DataForSEO ranked keywords and SERP          | Paid. Estimated before the request. Admitted by RFC-0009. Cached 30 days (keywords) and 24 hours (SERP). |

## 8. Alternatives considered

1. **An external CTR benchmark.** Rejected. Published curves differ widely and do not match a given site. The site's own curve is honest and free.
2. **Model-based detection.** Rejected. Detection must be reproducible and testable. A model can explain, but not decide.
3. **Storing all evidence in one JSON column.** Rejected by the engineering rules. Each evidence kind gets a normalized table.
4. **Persisting the full link graph.** Rejected. A large site can produce millions of edges. Inlinks for key pages only are enough for this rule.

## 9. Ready-for-other-users checklist

### Phase 1

- [x] New types added to `OPPORTUNITY_TYPES`, with UI labels and help text.
- [x] `project_brand_terms` table, D1 and Postgres migrations, parity test updated.
- [x] Brand-term seeding from the project domain, and the editor on the context page.
- [x] `get_project_context` and `update_project_context` include brand terms.
- [x] `opportunity_urls` table and migrations.
- [x] `opportunity_evidence.url`, `.query` and the new unique index, in both dialects.
- [x] `opportunities.diagnosis` column.
- [x] `opportunity_runs.kind`, `.year_ago_page_rows`, `.ga4_property_id`.
- [x] `opportunity_ga4_evidence` table.
- [x] Query+page row limit raised to 5,000.
- [x] Year-ago request added inside the reserved request count.
- [x] GA4 organic landing-page request added when GA4 is connected.
- [x] `low_ctr` detector, with boundary tests for each threshold.
- [x] `cannibalization` detector, with boundary tests and the URL-variant exclusion test.
- [x] `declining_page` diagnosis, with one test per diagnosis value.
- [x] Commercial score uses GA4 when connected, with tests for 0, 1 and 10 key events.
- [x] Difficulty uses cached keyword metrics when fresh, with a test that no paid call happens.
- [x] Identity hashes for the existing two types do not change (regression test).
- [x] Real-SQL repository tests pass on D1 and Postgres.
- [x] A tenancy test proves that project B cannot read project A's new evidence rows.
- [x] Detail view shows every phase 1 evidence kind.
- [ ] Live run on two real properties. Counts per type recorded.
- [ ] A person reviews 20 sampled opportunities. At least 14 are judged worth reviewing.
- [x] `content/docs/opportunities.mdx` explains each phase 1 type and its rule.

### Phase 2

- [x] `audit_page_inlinks`, written at audit finalize (`inbound_link_count` is left out; see `internal_link`).
- [ ] Audit finalize stays inside its current time limits on a 5,000-page site. The inlinks query takes about 1.5 seconds on a synthetic graph of that size; the live write time is not measured yet. The free plan audits at most 50 pages (a paid plan audits 10,000), so the live run needs a paid plan.
- [x] `technical_blocker` detector with the URL normalization tests.
- [x] `opportunity_audit_evidence` and `opportunity_inspection_evidence` tables.
- [x] URL inspection limited per project per day, with a test.
- [x] `internal_link` detector, with a test that existing links are excluded.
- [x] `opportunity_link_evidence` table.
- [x] `opportunity_rank_evidence` table and its detail view section.
- [x] Run result names skipped types and the reason.
- [ ] Live run on a property with a recent audit. A person reviews 10 technical and 10 link opportunities.
- [x] Docs updated for phase 2 types.

### Phase 3

- [x] RFC-0009 spending limits are live. Until then, the credit hold is the only admission check. Done 2026-10-18: every DataForSEO call reserves inside the monthly limits (`src/server/lib/dataforseo/client.ts`).
- [x] Content-gap dialog shows the estimate before any paid request.
- [x] Admission refusal shows a clear message and makes no provider call (test). The metering tests prove that a refused hold makes no provider call; the content-gap test proves the message and that nothing is saved.
- [x] `competitor_keyword_snapshots` and `competitor_keyword_rows`, with 30-day reuse (test proves no second purchase).
- [x] `content_gap` detector and `opportunity_keyword_evidence`.
- [x] Settled charge equals the provider-reported cost (test with the metering mock). The metering test "holds the estimate, then confirms the hold at the billed cost" covers every metered call, and a content-gap test proves the purchase goes through the metered client.
- [x] `opportunity_ai_evidence` and its detail view section.
- [x] Live SERP check with a 24-hour cache and the confidence rule.
- [ ] Live run with real credits on one project. Cost recorded and checked against the estimate.
- [x] Docs explain the paid action and its cost.

## 10. Open questions

1. Should the brand-term seed also use the organization name?
2. Should GA4 revenue raise the commercial score when ecommerce data exists? This RFC uses key events only.
3. Should content-gap topics use the existing keyword-clustering skill instead of the two-token key?

## 11. Real-site acceptance test

### Phase 1

**Site:** S2 (`conduitt.io`) when it meets the data floor. Otherwise the own site with the most impressions, plus S3 for the "thin data" case.

**Steps:**

1. Record the property's 28-day clicks and impressions.
2. Set the brand terms (for example `conduitt`). Connect GA4.
3. Run detection. Record the count per type.
4. The site owner reviews every `low_ctr`, `cannibalization` and `declining_page` item, or 20 sampled items when there are more.
5. For 3 items, open Search Console with the same dates, page and query. Compare the numbers.
6. Run detection again at once, then again after 24 hours.
7. Run detection on S3.

**Pass when:**

- S2 returns at least 5 opportunities across at least 2 types.
- The owner judges at least 70% worth acting on.
- Every checked number matches Search Console after rounding.
- No branded query appears in `low_ctr` or `cannibalization` evidence.
- The immediate re-run makes 0 provider calls. The 24-hour re-run creates 0 duplicates.
- Every declining page shows a diagnosis, and the owner agrees with at least 3 of 4 checked diagnoses.
- S3 shows fewer or no items with a clear "not enough data" reason, and no invented items.

**Value check:** the owner learns at least 2 things that the Search Console UI did not show directly. Examples: a page that loses clicks to a sister page, or a high-impression page with half the expected clicks.

### Phase 2

**Sites:** S1 and S3. Run a fresh site audit on each first.

**Steps:**

1. Run detection after the audit completes.
2. For every `technical_blocker`, check the live page (view source, HTTP status, robots and canonical tags) and the URL Inspection result.
3. For every `internal_link`, open the source page and search for a link to the target.
4. The owner fixes at least one real issue and runs the audit again.

**Pass when:**

- Every technical item matches the live page.
- No internal-link suggestion names a source that already links to the target.
- The top technical items show URL Inspection evidence.
- After the fix and a new audit, the fixed item is no longer detected (it shows the "not in latest analysis" flag from RFC-0003).

**Value check:** each technical item names the affected page, its search impressions and the exact fix, instead of a site-wide issue count.

### Phase 3

**Site:** S2, with 3 real competitors.

**Steps:**

1. Run "Find content gaps". Record the estimate.
2. Record the settled charge.
3. Run it again within 30 days.
4. The owner reviews every topic.

**Pass when:**

- The settled charge is at most the estimate plus 10%.
- The second run costs 0 credits.
- The owner would write about at least 3 topics.
- No topic is one that an existing page already covers well (the owner checks).

**Value check:** the owner gets a short list of commercial topics that competitors rank for, with volumes and competitor URLs, for a known cost.

## 12. Completion criteria

**Accuracy**

- For 10 random items, every evidence number matches Search Console for the same dates, page and query, after rounding.
- For 3 declining pages, the year-ago numbers match the Search Console compare view.
- For 3 pages with key events, the GA4 numbers match a GA4 Exploration within 2%.
- An automated query over the run's stored evidence finds 0 branded queries in `low_ctr` and `cannibalization` rows.
- The site CTR curve is reproduced by hand from the stored rows for 2 positions, with the same median.

**Usefulness**

- The site owner judges at least 70% of all items worth acting on, and at least 60% for each type with 5 or more items.
- Each type with qualifying data produces at least 1 item on S2. Each type without one shows the reason.
- For the top 10 items, the owner agrees with the high, medium or low priority band of at least 7.
- At least 3 items lead to an approved proposal or a ticket within the test week.
- The owner names at least 2 findings that were new to them.

**Stability**

- Three runs on three days create 0 duplicates.
- Apart from items explained by new data, no more than 10% of items appear or disappear between runs.
- The same inputs always give the same priority and the same order (test).

**Honesty**

- On S3, each skipped type shows its reason, and no item lacks evidence.
- A truncated run shows the truncation notice, and its items show the lower confidence.
- Every item's uncertainty text names the unverified factors.

**Explainability**

- Every score explanation lists each input and its value.
- For 3 pairs of items, the owner can say why one ranks above the other by reading the explanations alone.

**Performance**

- A phase 1 run finishes in under 60 seconds at the 95th percentile on S2, and always within its deadline.
- The Opportunities page loads in under 1 second with 500 stored items.

**Cost and quotas**

- Phase 1 and 2 runs make 0 paid calls. The ledger (RFC-0009) shows no charge for them.
- A run never makes more Search Console requests than it reserved.
- URL Inspection never exceeds the per-project daily cap.
- Phase 3 charges stay within the estimate plus 10%. A cached repeat costs 0.

## 13. Follow-ups that do not block closing

Each follow-up names its trigger. Check it here when it passes.

**Search Console data.** The only connected property, `sc-domain:playbookmedia.io`, had 0 clicks and 0 impressions over 3 months on 2026-10-16, and no signed-in Google account had another property. The detection code runs in production with no rows: the brand-terms editor, the detail sections and the content-gap estimate were checked live.

- [ ] Phase 1 acceptance (section 11) on a property with traffic. Trigger: the owner verifies a site with search traffic (for example `conduitt.io`, `eigenn.io` or `solomonhq.io`) in Search Console for the account that Relay uses, or adds that account as a user on an existing property.
- [x] Phase 1 thin-data run (S3 step) on `playbookmedia.io`. Trigger: the 24-hour cache of its last run ends, after 2026-10-17 11:10 UTC. Done at 11:00 UTC on 2026-10-18: the scheduled opportunity refresh found no qualifying opportunities and said so. It also said that the result is not a complete assessment, that GA4 is not connected, and that the latest audit has no internal-link data. It made 0 new high-priority items.
- [ ] Phase 1 checklist: live run on two real properties, and a person reviews 20 sampled opportunities (at least 14 worth reviewing).
- [ ] Phase 2 acceptance: fresh audits on S1 and S3, every technical item checked against the live page, no internal link that already exists, and a fixed item that disappears after a new audit. Mark money or hub key pages first, so the audit saves inlinks.
- [ ] Phase 2 checklist: audit finalize stays inside its time limits on a 5,000-page site (the inlinks query takes about 1.5 seconds on a synthetic graph of that size). Trigger: a paid plan, because the free plan audits at most 50 pages.
- [ ] Section 12 completion criteria: accuracy against Search Console, usefulness reviews, three runs on three days, and the performance targets.

**Paid run.** The owner approved on 2026-10-16 one content-gap run with up to 3 competitors (about 507 credits at 169 each), one live results check and one site audit, once a property with data is connected.

- [ ] Phase 3 acceptance: record the estimate and the settled charge, run it again within 30 days at 0 credits, and the owner reviews every topic. The DataForSEO deposit must be topped up first.

**RFC-0009.**

- [x] Content-gap and live-check admission go through the RFC-0009 spending check. Until then, the credit hold is the only admission check. Trigger: RFC-0009 ships its spending limits. Done 2026-10-18: both use `createDataforseoClient`, which reserves inside the monthly limits.
