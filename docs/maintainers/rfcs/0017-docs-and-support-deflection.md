# RFC-0017: Docs improvements and support deflection

- **Status:** Draft
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

### 5.3 Detectors (phase 1)

| Type                        | Rule                                                                                                                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs_search_gap`           | A site search term with ≥ 20 searches in 28 days matches no docs page title or heading (normalized, stemmed tokens).                                                                                     |
| `docs_page_underperforming` | A docs page with ≥ 500 Search Console impressions has an average position worse than 10, or a CTR at or below 50% of the docs median at its position.                                                    |
| `docs_stale_page`           | A docs page with ≥ 500 views in 28 days (GA4 page path) whose file has not changed for 12 months or more. Read the last commit date with one GitHub request per page, for the 50 most-viewed pages only. |

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

### 5.6 Drafts from verified sources

1. **Allowed sources:** existing docs pages, the project's changelog file, an OpenAPI file in the repository, and facts the owner types in.
2. Every factual sentence must quote or paraphrase one source, with the claim checks from RFC-0004.
3. When a needed fact has no source, write a visible placeholder: `[Owner: add the exact command]`. A proposal with placeholders cannot be approved until they are filled.
4. Code samples come only from the sources. Relay never invents commands, flags or API fields.

### 5.7 Measurement

For each shipped docs change, compare 4 weeks before and 4 weeks after:

1. Searches for the topic's terms (GA4).
2. Search Console clicks and position for the page.
3. Tickets on the topic (phase 2).

Directional labels need ≥ 50 searches or ≥ 20 tickets in each window, and a change of ≥ 25%. Otherwise "inconclusive". Show the caveat that product changes and launches also move these numbers.

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

- [ ] Docs settings, `docs_pages` and `docs_page_headings` in D1 and Postgres.
- [ ] Daily docs index task with the file and size caps.
- [ ] Three detectors with boundary tests, and skip reasons.
- [ ] `markdown` change kind with the three edit types (tests on real MDX files from Relay's docs).
- [ ] Test: JSX blocks and front matter stay byte-identical.
- [ ] Drafts with the allowed sources and placeholders. Approval is blocked while placeholders remain (test).
- [ ] Measurement with the thresholds.
- [ ] `content/docs/docs-insights.mdx`.

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
