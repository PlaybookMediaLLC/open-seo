# RFC-0021: New pages from verified business facts

- **Status:** Draft
- **Date:** 2026-10-15
- **Delivery order updated:** 2026-10-23
- **Area:** stage 4 facts registry when required; stage 5 new-page execution after validated demand.
- **Depends on:** Phase 0 facts uses project context and RFC-0004 grounding; it does not require launch workflows. New-page execution uses RFC-0002 gaps, RFC-0005/0017 publishing, RFC-0018 reporting, RFC-0023 phase 1 checks for existing pages, RFC-0025 phase 1a, and RFC-0028 verification.
- **Changes earlier rules:** RFC-0002 and RFC-0004 say "never generate pages". This RFC allows new pages only from verified facts, one at a time, with a person's approval and a monthly cap.

## 1. Summary

SaaS sites miss pages that buyers search for: answers to buying questions, use cases, integrations and comparisons. Relay can find these gaps, but today it stops at a brief. This RFC adds a registry of verified business facts, and creates a new page only when enough verified facts exist to make it useful. Pages ship through the repository's own templates as reviewed pull requests. They never ship in bulk.

## 2. What exists today

| Part                  | Location                                                               | Use in this RFC                                 |
| --------------------- | ---------------------------------------------------------------------- | ----------------------------------------------- |
| Content gaps          | RFC-0002 `content_gap`                                                 | Topics competitors cover.                       |
| Briefs                | RFC-0004 phase 3 `content_briefs`                                      | Outline input.                                  |
| Support and docs gaps | RFC-0017                                                               | Buying questions from search terms and tickets. |
| Project context       | `project_context_sections`, `project_competitors`, `project_key_pages` | Business overview and positioning.              |
| Publishing            | RFC-0005, RFC-0012, RFC-0017                                           | Exact-change approval and file edits.           |

## 3. Goals

1. Keep a registry of business facts, each with a source and a person who verified it.
2. Find missing pages: buying questions, use cases, integrations and comparisons.
3. Create a page only when it passes a quality bar built on verified facts.
4. Use the repository's own patterns: a new data record, a new content file, or (phase 2) a copy of a sibling page.
5. Run launch checks on every new page.

## 4. Non-goals

1. No pages without verified facts.
2. No bulk or programmatic page creation.
3. No claims about competitors without a dated public source.
4. No new design or layout. New pages use existing templates.

## 5. Design

### 5.1 Phases

| Phase | Delivers                                                                                                                                       |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Verified facts registry, expiry, sources, review, and citations; independently usable by RFC-0020 content refreshes, without generating pages. |
| 1     | Page-gap detection and reviewed new records in existing data templates or Markdown/MDX files, using the phase 0 facts and RFC-0023 checks.     |
| 2     | Copies of a supported sibling static page and comparison pages with dated sources.                                                             |
| 3     | Suggestions from changelog, OpenAPI, and docs, unverified until a person confirms them.                                                        |

New-page publishing stays deferred until repeat paid release-assurance demand and existing-page growth justify expansion. The facts-only slice can ship earlier when a validated refresh use case requires it.

### 5.2 Facts registry

`business_facts`:

| Column        | Type                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `id`          | text primary key                                                                                                             |
| `project_id`  | text, FK cascade                                                                                                             |
| `kind`        | text enum `product`, `feature`, `integration`, `use_case`, `pricing`, `policy`, `faq_answer`, `comparison`, `customer_proof` |
| `subject`     | text, at most 120 characters (for example "HubSpot integration")                                                             |
| `statement`   | text, at most 500 characters                                                                                                 |
| `source_kind` | text enum `owner_entered`, `repo_file`, `docs_page`, `changelog`, `openapi`, `public_url`                                    |
| `source_ref`  | text, nullable (path, URL or commit)                                                                                         |
| `verified_by` | text, a user id                                                                                                              |
| `verified_at` | text                                                                                                                         |
| `expires_at`  | text, nullable                                                                                                               |
| `status`      | text enum `active`, `expired`, `retired`                                                                                     |

Rules:

1. Only a person can verify a fact. Phase 3 suggestions stay unverified until a person confirms them.
2. Default expiry: pricing 90 days, comparison 90 days, other kinds 365 days. Expired facts cannot support new text.
3. `customer_proof` (quotes, logos, named customers) needs `owner_entered` and a note that the customer agreed. Relay never writes proof from other sources.
4. `comparison` facts need a `public_url` source and a capture date.
5. Show facts on the project context page. Expose them through the MCP context tools.

### 5.3 Page gap detection

New opportunity type `missing_page`, with a `page_kind`: `buying_question`, `use_case`, `integration`, `comparison`.

| Page kind         | Signal                                                                                                                                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `buying_question` | Question-form queries (how, what, can, does, is, pricing, alternative) with ≥ 50 impressions in 28 days, where the best-ranking page is at position 15 or worse and does not cover the question. Also RFC-0017 search terms and support topics. |
| `use_case`        | Content-gap topics (RFC-0002) that match a `use_case` fact.                                                                                                                                                                                     |
| `integration`     | An active `integration` fact with no page at the expected path of the integration template.                                                                                                                                                     |
| `comparison`      | Queries with "vs" or "alternative" for a competitor in `project_competitors`, with ≥ 50 impressions. Phase 2 only.                                                                                                                              |

Each item shows the facts that support it, and the facts still missing.

### 5.4 Quality bar

A page can be prepared only when all of these hold:

1. At least 5 active facts support it, and at least 1 is `owner_entered` or `repo_file`.
2. No existing page covers the same main query. Check titles and headings of indexed pages, and the queries of the best-ranking page.
3. The project is under its monthly new-page cap (default 2, plan maximum 10).
4. The page kind has a supported template in the repository (5.5).

When a condition fails, the item says which one, and what to add (for example "Add 2 more verified facts about the HubSpot integration").

### 5.5 Page creation patterns

**A. Data-driven template (phase 1).** The repository has a dynamic route, for example `app/integrations/[slug]/page.tsx`, fed by a data file, for example `lib/integrations.ts` with an exported array of object literals.

1. Find the data source: the dynamic route's import that provides the list, within the RFC-0012 file limits.
2. Read the existing records. Derive the fields and their types from them.
3. Build one new record. Every text field comes from a fact or from the owner. Copy no text from sibling records.
4. Append it as a literal. Parse the file again.
5. Reject sources that are computed, fetched from a CMS, or not literal arrays.

**B. Content collection (phase 1).** The repository has a Markdown or MDX folder for this kind (for example `content/use-cases/`).

1. Copy the front matter keys of the newest sibling file. Fill the values from facts.
2. Write the body from the outline and the facts, with the RFC-0004 claim checks.
3. Missing facts become placeholders that block approval.

**C. Sibling copy (phase 2).** Copy a static sibling page and replace its literals, with the RFC-0012 copy rules. A higher-risk pattern, so it needs a second reviewer.

### 5.6 Drafting rules

1. Every sentence that states a fact cites one fact id. The draft view shows the citations.
2. No numbers, prices, customer names or comparisons without a fact of that kind.
3. Comparison text states the capture date of the competitor source.
4. A similarity check against the competitor pages in the evidence: no 8-word sequence may match. Relay never copies competitor text.
5. New pages never go above the RFC-0018 `prepare` level.

### 5.7 After the page ships

1. Start the RFC-0023 launch checklist: indexability, sitemap, internal links from at least 2 related pages, structured data, and monitoring.
2. Measure as a new page: the date of the first impression, then impressions, clicks, queries and conversions at weeks 4, 8 and 12. There is no baseline, so there is no label.
3. At week 8, list queries that land on the page but are not answered. Offer them to the RFC-0020 refresh step.

### 5.8 Data model

- `business_facts` (5.2).
- `page_fact_citations`: `id`, `proposal_id` (FK cascade), `fact_id` (FK), `sentence_hash`.
- `opportunities.page_kind`: text enum, nullable.
- `opportunity_proposals.change_kind` adds `new_record` and `new_file`.

## 6. Security

1. Facts are project data with an owner. Every fact change writes an audit event.
2. New-page proposals use the exact-change approval and never a standing approval.
3. Competitor text is untrusted input and is never copied.

## 7. Cost

Drafts cost model credits. Detection uses free data, plus RFC-0002 paid content gaps when the owner runs them.

## 8. Alternatives considered

1. **Generate pages from keyword lists.** Rejected. Thin pages harm the site and its search standing.
2. **A Relay-hosted page builder.** Rejected. Pages belong in the customer's code and templates.
3. **No new pages at all.** Rejected. Missing buyer pages are a real, recurring source of growth when facts support them.

## 9. Ready-for-other-users checklist

### Phase 0

- [ ] `business_facts` and normalized citations in D1 and Postgres; citations support existing content as well as later new pages.
- [ ] Facts editor with expiry, `customer_proof` and `comparison` rules (tests).
- [ ] MCP context tools expose facts.

### Phase 1

- [ ] `missing_page` detector for buying questions, use cases and integrations (tests per signal).
- [ ] Quality bar with the reason for each failed condition (tests).
- [ ] Pattern A: data source discovery, field derivation, literal append, rejection cases (tests).
- [ ] Pattern B: front matter copy, body with citations, blocking placeholders (tests).
- [ ] Similarity check against competitor text (test).
- [ ] Monthly cap (test).
- [ ] Launch checklist start (RFC-0023) and new-page measurement.
- [ ] Update RFC-0002 and RFC-0004 rule lines to point to this RFC.
- [ ] `content/docs/new-pages.mdx`.

### Phase 2

- [ ] Sibling copy with a second reviewer.
- [ ] Comparison pages with dated sources.

### Phase 3

- [ ] Fact suggestions from the changelog, OpenAPI and docs, unverified until a person confirms them.

## 10. Real-site acceptance test

**Phase 0:** On an authorized project, verify ten sourced facts, then expire and retire selected facts. Validate a supplied draft through the fact/citation checks: unsourced, expired, or retired claims must fail. This acceptance requires no campaign executor, generated page, repository write, or launch feature. The remaining steps cover phase 1.

**Sites:** S3 (Relay docs, a content collection) and S2 (integration pages, when they use a data-driven template).

**Steps:**

1. Enter 10 facts for S3, and verify them.
2. Run detection. The owner reviews every `missing_page` item.
3. Create one S3 docs page for a real buying question. Approve, merge and deploy it.
4. On S2, prepare one integration page as a new data record, when the template fits.
5. Follow the launch checklist and the week-4 measurement.

**Pass when:**

- Every sentence with a fact cites an active fact.
- No placeholder remains in the approved page.
- The S2 diff adds one record and changes nothing else.
- The page passes the launch checks and gets its first impressions within the measurement window, or the report says it did not.
- The owner would publish the page with no rewrite.

**Value check:** the owner gets a useful buyer page built from facts they trust, in their own template, without writing it from scratch.

## 11. Completion criteria

- 0 unsourced factual sentences across 5 new pages.
- 0 expired facts used.
- 0 matches of 8 or more words with competitor pages.
- At least 4 of 5 new pages published with small edits or none.
- At least 3 of 5 new pages get impressions within 8 weeks, or the reason is recorded.
- The monthly cap is never exceeded.
