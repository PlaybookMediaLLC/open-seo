# RFC-0017: Docs improvements and support deflection

- **Status:** In progress. Part A built: the docs settings and the daily docs index. Part B built: the three detectors. Part C built: the `markdown` change kind. Part D built: drafts from verified sources. Part E built: measurement.
- **Date:** 2026-10-15
- **Area:** beyond SEO. For developer-tool and SaaS companies, docs are a growth and support channel.
- **Depends on:** RFC-0004 (drafting), RFC-0005 (publishing), RFC-0012 (file reading rules), RFC-0008 (scheduled sync).

## 1. Summary

Developer-tool companies lose sign-ups and pay for support when their docs miss the questions users ask. The signals exist: docs search terms, search queries that land on docs, and support tickets. This RFC finds docs gaps from these signals, drafts docs changes as Markdown or MDX pull requests from verified sources only, and measures whether searches and tickets on the topic go down.

## 2. What exists today

| Part            | Location                                                | Use in this RFC                                                       |
| --------------- | ------------------------------------------------------- | --------------------------------------------------------------------- |
| GA4 site search | `Ga4ReportDefinitions.ts` (`searchTerm`)                | Docs search terms, when GA4 enhanced measurement records site search. |
| Search Console  | `GscService`                                            | Queries and positions for docs pages.                                 |
| Drafting        | RFC-0004                                                | Grounded drafts with claim checks.                                    |
| Publishing      | RFC-0005, RFC-0012                                      | Pull requests and file reading rules.                                 |
| Our own docs    | Relay `content/docs/` (MDX) and `team@playbookmedia.io` | A dogfood site.                                                       |
| Test docs site  | `conduitt.io/docs`                                      | A real developer docs site.                                           |

## 3. Goals

1. Find docs gaps: frequent searches with no good page, docs pages that rank poorly for their queries, and old pages with high traffic.
2. Phase 2: group support tickets into topics and map them to docs pages.
3. Draft docs changes only from verified sources, and mark every fact that a person must supply.
4. Edit Markdown and MDX by pull request, safely.
5. Measure the change in searches, tickets and docs traffic for the topic.

## 4. Non-goals

1. No public chatbot or AI answer widget.
2. No automatic replies to tickets.
3. No full docs generation.

## 5. Design

### 5.1 Phases

| Phase | Delivers                                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------- |
| 1     | Docs index, docs signals from GA4 and Search Console, 3 detectors, Markdown edits, drafts with placeholders, measurement. |
| 2     | Support connectors (Intercom, Zendesk, GitHub Issues), topic groups, the `support_topic` detector.                        |
| 3     | Zero-result searches from docs search providers (Algolia).                                                                |

### 5.2 Docs index

1. The owner sets the docs path prefix (for example `/docs/`) and the docs directory in the repository (for example `content/docs/`).
2. A daily task reads the docs directory through the GitHub reader. At most 500 files and 10 MB.
3. For each file, store `docs_pages`: `id`, `project_id` (FK cascade), `file_path`, `url_path`, `title`, `headings` (in `docs_page_headings`: `page_id`, `level`, `text`, `anchor`), `word_count`, `blob_sha`, `indexed_at`.
4. Store no full text. Matching reads the files again when needed.

**As built (part A).** The docs paths are a "Docs" section of the GitHub publishing card in **Project settings > Integrations**, with the form in a sheet; the card is the fork's, so no upstream seam is needed. `docs_settings` holds one row per project. Every docs table has `project_id`, so the tenancy test covers it; headings carry their position. The job `docs_index` runs daily at 03:00 UTC, and saving the paths turns it on. It reads the docs directory with one recursive tree read on the base branch and a read-only token, keeps `.md` and `.mdx` files in path order up to 500 files and 10 MB, and reads only files whose blob sha changed. One run reads at most 200 files, to stay inside the Worker's request limit; the rest follows the next day, and **Index now** runs the same step at once. The GitHub reader reads files up to 32 KB, so a bigger file keeps its path and URL with no title or headings, and the run says so. The parser is the repository's MDX tooling (`mdast-util-from-markdown` with the MDX extensions, already in the lockfile through `fumadocs-mdx`). Front matter is cut off before parsing, because no front matter extension is installed; the title comes from its `title`, then the first H1. Anchors follow GitHub's slugger, and a Fumadocs `[#anchor]` suffix wins. All 111 MDX files of Relay's app docs and website parse. A file becomes a URL by its path under the directory, without the extension and a final `index`. Changing the paths deletes the index.

### 5.3 Detectors (phase 1)

| Type                        | Rule                                                                                                                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs_search_gap`           | A site search term with ≥ 20 searches in 28 days matches no docs page title or heading (normalized, stemmed tokens).                                                                                     |
| `docs_page_underperforming` | A docs page with ≥ 500 Search Console impressions has an average position worse than 10, or a CTR at or below 50% of the docs median at its position.                                                    |
| `docs_stale_page`           | A docs page with ≥ 500 views in 28 days (GA4 page path) whose file has not changed for 12 months or more. Read the last commit date with one GitHub request per page, for the 50 most-viewed pages only. |

**As built (part B).** The detectors run as a `docs` opportunity run, like the RFC-0012 conversion run: one free run a day per project, from **Find docs gaps** on the Opportunities page, and the items join the queue under a "Docs" group. The window is the 28 days that end 3 days ago. Search Console gives the page rows that contain the docs path, and GA4 gives `view_search_results` events by `searchTerm` and `screenPageViews` by `pagePath`, 1,000 rows each. A term matches when every word of it, without stop words, is in one title or heading; plurals, `-ing`, `-ed` and a final `e` are removed first, and terms with the same words count together under the most-searched one. The docs median CTR at a rounded position needs 3 docs pages there with 100 or more impressions. A page below position 10 is reported for its position, not also for its CTR. Commit dates come from `GET /commits?path=` on the base branch for the 50 most-viewed indexed pages with 500 or more views. Commercial and difficulty scores are a neutral 0.5, because a docs page has no page role or ranking target. The run message names each skipped check: no GA4, no site search terms, or no repository for commit dates.

### 5.4 Support topics (phase 2)

1. Connectors: Intercom and Zendesk (read-only OAuth), and GitHub Issues (the RFC-0005 GitHub App with Issues read).
2. Read only the subject and the first customer message of each ticket in the last 90 days.
3. Remove emails, phone numbers, URLs with tokens, and names that match the ticket's requester fields before any processing.
4. Group tickets into topics with embeddings and a fixed similarity threshold. Label each topic with its most common terms.
5. Map each topic to the docs page whose title and headings match best. Mark topics with no match as gaps.
6. Store only `support_topics` (`id`, `project_id`, `label`, `ticket_count_28d`, `ticket_count_prev_28d`, `docs_page_id` nullable, `updated_at`) and up to 3 redacted excerpts per topic, at most 200 characters each. Delete raw text after processing.
7. Detector `support_topic`: a topic with ≥ 10 tickets in 28 days.

### 5.5 Docs edits

Add the change kind `markdown`.

1. Parse Markdown and MDX into a syntax tree with the repository's MDX tooling.
2. Supported edits: insert a new section after a chosen heading, add an item to an FAQ list, and replace one paragraph found by exact text.
3. Keep all JSX blocks and front matter unchanged. Reject edits inside JSX blocks.
4. Show the rendered before and after in the diff view.

**As built (part C).** A docs edit is a `markdown` proposal with one text edit of the new node kind `markdown_block`. It reuses the RFC-0012 copy pipeline: prepare and execution both build the change with `applyCopyEdits`, so execution writes exactly what the person approved. Each of the three edits becomes one exact span: a new section replaces the chosen heading's section with itself plus the new section; a list item replaces the first list under the heading with itself plus the item, in the list's marker style and indentation; a paragraph is a top-level paragraph that matches the pasted text or its source. After the replacement, the file parses again with the same MDX tooling, and the front matter and every JSX, ESM, expression and raw HTML block must be byte-identical, in order, or the edit is refused; this one check also refuses edits inside JSX. New text may not contain JSX, imports or HTML. The proposal view shows the whole Markdown block and its rendering with the app's shared Markdown renderer, before and after; the diff block moved out of `PublishingProposal.tsx` into `ProposalDiffs.tsx`, because the file had reached the 400-line limit. The edit sheet is offered on approved docs opportunities. A test inserts a section into every Relay docs page with an H2 and checks the invariant on each.

### 5.6 Drafts from verified sources

1. **Allowed sources:** existing docs pages, the project's changelog file, an OpenAPI file in the repository, and facts the owner types in.
2. Every factual sentence must quote or paraphrase one source, with the claim checks from RFC-0004.
3. When a needed fact has no source, write a visible placeholder: `[Owner: add the exact command]`. A proposal with placeholders cannot be approved until they are filled.
4. Code samples come only from the sources. Relay never invents commands, flags or API fields.

**As built (part D).** A docs draft is the RFC-0004 draft kind `docs_markdown`, with the same admission, credits, daily limits and per-project lease. Its sources are the chosen docs file, up to two indexed docs pages that share a topic word in their title or headings, `CHANGELOG.md` and the first of `openapi.yaml`, `openapi.yml` or `openapi.json` at the repository root, and the owner's typed facts. Each file is read to its first 32 KB, so a long changelog gives its newest entries. The draft output allows 4,000 characters and 10 claims. Before a person sees a draft, the checks require: every number in a source (placeholders excluded), every claim's exact quote in its source, every inline code span and fenced block copied verbatim from a source, and Markdown without JSX, imports or HTML. A missing fact is written as `[Owner: …]`. The edit planner refuses any text that still contains a placeholder, so a proposal with one cannot exist and cannot be approved; the sheet also counts open placeholders and disables the button.

### 5.7 Measurement

For each shipped docs change, compare 4 weeks before and 4 weeks after:

1. Searches for the topic's terms (GA4).
2. Search Console clicks and position for the page.
3. Tickets on the topic (phase 2).

Directional labels need ≥ 50 searches or ≥ 20 tickets in each window, and a change of ≥ 25%. Otherwise "inconclusive". Show the caveat that product changes and launches also move these numbers.

**As built (part E).** A shipped docs change is an RFC-0006 experiment, so its page already measures Search Console clicks and position for the target URL. The "Docs search result" card adds the GA4 part: on request, it counts `view_search_results` events whose term has the same words as the item's search term, in the 28 days before the deployment day and the 28 days from it. The result is read when asked, not stored, and is ready two days after the second window ends. An item without a search term (a ranking or stale page item) has no search result, only the Search Console measurement. The thresholds apply to searches; tickets wait for phase 2.

## 6. Privacy and security

1. Ticket text is personal data. Process it once, keep only redacted excerpts and counts, and delete raw text.
2. Connectors are read-only and revocable. Every connection change writes an audit event.
3. Update the privacy policy and the data processing agreement before phase 2.

## 7. Cost

GA4, Search Console and GitHub reads are free. Embeddings and drafts cost model credits, shown before each run.

## 8. Alternatives considered

1. **An AI answer widget on the docs.** It hides gaps instead of fixing the docs, and it can give wrong answers.
2. **Full-text docs storage in Relay.** Rejected. The repository is the source of truth. Relay reads files when needed.

## 9. Ready-for-other-users checklist

### Phase 1

- [x] Docs settings, `docs_pages` and `docs_page_headings` in D1 and Postgres.
- [x] Daily docs index task with the file and size caps.
- [x] Three detectors with boundary tests, and skip reasons.
- [x] `markdown` change kind with the three edit types (tests on real MDX files from Relay's docs).
- [x] Test: JSX blocks and front matter stay byte-identical.
- [x] Drafts with the allowed sources and placeholders. Approval is blocked while placeholders remain (test).
- [x] Measurement with the thresholds.
- [x] `content/docs/docs-insights.mdx`.

### Phase 2

- [ ] Intercom, Zendesk and GitHub Issues connectors, read-only.
- [ ] Redaction tests with seeded emails, phone numbers and names.
- [ ] Topic grouping and docs mapping.
- [ ] Raw text deletion after processing (test).
- [ ] Privacy policy and processing agreement updated.

### Phase 3

- [ ] Algolia zero-result searches.

## 10. Real-site acceptance test

**Sites:** S3 (Relay's own docs at `/docs`) and `conduitt.io/docs`.

**Steps:**

1. Set the docs prefix and directory for both. Index them.
2. Run the detectors. The owner reviews every item.
3. Draft one docs addition for a real gap on S3. Fill the placeholders. Approve, merge and deploy it.
4. Phase 2: connect one support source with real tickets (GitHub Issues or the help desk in use). Review the top 5 topics.

**Pass when:**

- The index matches the docs directory file count.
- The owner judges at least 70% of items worth acting on.
- The S3 pull request changes only the inserted section, and the MDX builds.
- The draft contains no invented command, flag or field (owner check).
- The top 5 topics make sense to the owner, and no stored excerpt contains personal data.

**Value check:** the owner sees which questions the docs fail to answer, and ships a reviewed fix the same day.

## 11. Completion criteria

**Detection**

- At least 70% of items worth acting on, on both sites.
- 0 `docs_search_gap` items for terms that already have a matching page title or heading.

**Edits**

- 10 of 10 test edits keep JSX blocks and front matter byte-identical.
- Every shipped edit builds in the docs site's own CI.

**Drafts**

- 0 invented facts across 10 drafts. Every gap without a source becomes a placeholder.

**Privacy (phase 2)**

- A scan of stored excerpts finds no email, phone number or requester name.
- Raw ticket text is gone after processing.

**Outcome**

- At least one shipped docs change has a measured result (directional or inconclusive) after 4 weeks.
