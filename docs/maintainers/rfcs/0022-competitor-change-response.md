# RFC-0022: Competitor change response

- **Status:** Draft
- **Date:** 2026-10-15
- **Area:** retention, priority 6.
- **Depends on:** rank tracking (existing), RFC-0002 (opportunities), RFC-0008 (tasks), RFC-0009 (paid admission), RFC-0020 (refresh steps), RFC-0021 (facts).

## 1. Summary

Competitors change their pages, and search results move. Most tools alert on every change, and the customer must decide what matters. This RFC records search results for tracked keywords, watches the competitor pages that outrank the customer on commercial queries, and proposes a response only when the customer's own data shows an effect.

## 2. What exists today

| Part            | Location                                                                                                                             | Use in this RFC                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Rank tracking   | `rank_tracking_configs`, `rank_tracking_keywords`, `rank_check_runs`, `rank_snapshots` (`src/db/app.schema.ts`), rank check workflow | Scheduled SERP checks for tracked keywords. Only the project's own position, URL and SERP features are stored. |
| Competitors     | `project_competitors`                                                                                                                | Known competitor domains.                                                                                      |
| AI visibility   | `ai_runs`, `ai_sources`, `ai_matches`                                                                                                | Competitor citations in AI answers.                                                                            |
| Keyword metrics | `keyword_metrics`                                                                                                                    | Intent and volume for tracked keywords.                                                                        |
| Refresh steps   | RFC-0020                                                                                                                             | How a response ships.                                                                                          |

The rank check calls DataForSEO's live organic SERP endpoint (`src/server/lib/dataforseo/serp.ts`) with "stop crawl on match" for the project's domain. It keeps only the project's own result and the list of SERP feature types, and discards the other organic results. The crawl stops after the results page that holds the match, so the first page (the top 10) should always be in the response. Verify this with real responses before building phase 1.

## 3. Goals

1. Keep the top 10 results of each tracked keyword at no extra paid cost.
2. Watch the competitor pages that outrank the customer on commercial keywords.
3. Create a response only when a competitor change and a loss in the customer's own data meet in the same weeks.
4. Propose responses that use the customer's verified facts, never competitor text.

## 4. Non-goals

1. No alerts for competitor changes that show no effect on the customer.
2. No crawling of whole competitor sites.
3. No copying or close paraphrasing of competitor content.

## 5. Design

### 5.1 Phases

| Phase | Delivers                                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------------------------- |
| 1     | Stored top-10 results, SERP movement detection, the evidence gate, response proposals as refresh and snippet steps. |
| 2     | Competitor page snapshots and change detection, with heading-level comparison.                                      |
| 3     | AI-answer citation shifts as an extra signal.                                                                       |

### 5.2 Stored search results (phase 1)

1. In the rank check path (`src/server/workflows/rankCheckPaths.ts`, where the SERP response is reduced to the project's row), persist the top 10 organic results of each check before they are discarded. Add one `// playbook-seam` line that calls a fork function.
2. `rank_serp_results`: `id`, `snapshot_id` (FK `rank_snapshots.id`, cascade), `rank` (1 to 10), `domain`, `url` (at most 500 characters), `title_hash`.
3. No new DataForSEO request. The data is already paid for by the existing rank check.
4. Keep 180 days, then delete in the retention task.

### 5.3 Movement detection

For each tracked keyword with commercial or transactional intent (from `keyword_metrics`), compare the last check with the check 7 and 28 days earlier:

1. A competitor URL entered the top 3, or rose 3 or more positions.
2. A new domain entered the top 10 for 3 or more commercial keywords in the same 28 days.
3. A SERP feature appeared above the customer's result (for example an AI overview or a featured snippet).

These are movements, not opportunities.

### 5.4 Evidence gate

Create a `competitor_change` opportunity only when a movement and a customer loss meet:

1. The customer's position for the keyword fell by 2 or more in the same window, or
2. The customer's page lost 20% or more of its clicks for that query in Search Console over the same 28 days, with at least 20 clicks lost.

Otherwise record the movement in a "Market changes" list with no action and no notification.

### 5.5 Competitor page changes (phase 2)

1. Watch the competitor URLs from opportunities that passed the gate. At most 30 per project.
2. Fetch each URL once a week with the safe fetcher. Follow `robots.txt` for the user agent `RelayMonitor`. Stop on 403 or 429.
3. `competitor_pages`: `id`, `project_id` (FK cascade), `url`, `domain`, `first_seen`, `reason`.
4. `competitor_page_snapshots`: `id`, `competitor_page_id` (FK cascade), `fetched_at`, `title`, `meta_description`, `h1`, `word_count`, `json_ld_types`, `modified_at` (from the page, nullable).
5. `competitor_page_headings`: `snapshot_id` (FK cascade), `level`, `text` (at most 200 characters).
6. A material change: 30% or more new words, a new H2 section, a new FAQ or JSON-LD type, or a new title.
7. Show a heading-level comparison: the sections the competitor has, and the customer's page lacks.

### 5.6 Response proposals

Responses become RFC-0020 steps on the customer's page:

| Evidence                                                                                                    | Response                                                                          |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| The competitor covers a subtopic that the customer's page lacks, and the customer has verified facts for it | Content refresh step with those facts.                                            |
| The competitor's result has a better snippet, and the customer's CTR fell                                   | Snippet step.                                                                     |
| A SERP feature took the clicks                                                                              | Explanation only, plus structured data advice when it applies. No content change. |
| No verified facts exist for the missing subtopic                                                            | Ask the owner for facts (RFC-0021). Do not draft.                                 |

Rules:

1. Never copy or closely paraphrase competitor text. Apply the RFC-0021 similarity check.
2. Never write claims about a competitor without a dated `comparison` fact.
3. Every response lists the evidence: the movement, the customer's loss, and the competitor change.

### 5.7 User interface

1. Opportunities shows `competitor_change` items with the SERP history chart for the keyword.
2. Project → **Market changes**: movements that did not pass the gate, for context, with no notifications.
3. Phase 2: a competitor page view with the heading comparison.

## 6. Security and ethics

1. Competitor pages are untrusted input. They are never sent to a model as instructions.
2. Fetches identify Relay, follow `robots.txt`, and stay at one request per page per week.
3. Stored competitor data is limited to titles, headings and counts.

## 7. Cost

Phase 1 adds no paid calls. Optional live SERP checks use RFC-0009 admission.

## 8. Alternatives considered

1. **Alert on every competitor change.** Rejected. It creates work without evidence that it matters.
2. **Buy competitor data daily.** Rejected. The rank check already pays for the results.
3. **Mirror competitor content.** Rejected on quality, legal and trust grounds.

## 9. Ready-for-other-users checklist

### Phase 1

- [ ] Seam in the rank check workflow and `rank_serp_results` in D1 and Postgres.
- [ ] Test: no extra DataForSEO request per rank check.
- [ ] Movement detection with each rule (tests).
- [ ] Evidence gate (tests for movement with and without a customer loss).
- [ ] `competitor_change` opportunities and the Market changes list.
- [ ] Response steps through RFC-0020, with the similarity check.
- [ ] `content/docs/competitors.mdx`.

### Phase 2

- [ ] Competitor page tables, weekly fetch with `robots.txt` rules, and the 30-page cap.
- [ ] Material-change detection and the heading comparison (tests).

### Phase 3

- [ ] AI citation shifts as a signal.

## 10. Real-site acceptance test

**Site:** S2, with at least 20 tracked commercial keywords and 3 competitors, over 4 weeks.

**Steps:**

1. Turn on stored results. Let rank checks run for 4 weeks.
2. Review every movement and every `competitor_change` item with the owner.
3. For one item, ship the proposed response.

**Pass when:**

- Rank check costs do not change.
- Every `competitor_change` item shows a movement and a customer loss in the same window.
- The owner agrees that at least 70% of items matter.
- Movements without a loss create no notification.
- The shipped response contains no text that matches competitor pages.

**Value check:** the owner hears about competitor moves only when they cost something, with a response ready.

## 11. Completion criteria

- 0 added paid requests from stored results.
- At least 70% of `competitor_change` items judged relevant by the owner.
- 0 notifications for movements that fail the gate.
- 0 copied sequences of 8 or more words from competitor pages in responses.
- Competitor fetches stay at 1 per page per week and stop on 403 or 429.
