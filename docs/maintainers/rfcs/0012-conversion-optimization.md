# RFC-0012: Conversion optimization for landing pages

- **Status:** Done on 2026-10-18. Built in PRs #119 to #125: the tracking gate and Conversion settings (A), the four detectors and the conversion run (B), the text picker and copy locator (C1), `copy_text` proposals in one commit (C2), checked copy drafts and the Conversion filter group (D), the conversion metric in experiments and the user guide (E1), and split tests on the chosen conversion (phase 2). Phase 3 waits for its own security and SEO review. The live acceptance tests and the completion criteria are follow-ups in section 12.
- **Date:** 2026-10-15
- **Area:** beyond SEO. Visitors that search brings must become customers.
- **Depends on:** RFC-0004 (drafting), RFC-0005 (publishing), RFC-0006 (measurement), RFC-0011 (split tests, phase 2).

## Current delivery role — October 23, 2026

Implemented conversion foundation. GA4 conversion evidence is optional pilot context; broader copy campaigns and visitor-level tests follow validated demand in stage 4 or later.

The historical status and acceptance notes below are retained. The [delivery plan](README.md) and [current audit](../relay-release-assurance-audit.md) distinguish implementation, live acceptance, and commercial evidence.

## 1. Summary

Relay brings organic visitors, but it cannot see whether they convert or fix pages that do not. GA4 is already connected for many projects, and Relay already writes reviewed changes as code. This RFC adds conversion opportunities from GA4, copy and call-to-action changes by pull request, and measurement with GA4 key events, first before and after, then with page-group split tests.

## 2. What exists today

| Part                   | Location                                                   | Use in this RFC                                                                                                               |
| ---------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| GA4 reports            | `src/server/features/ga4/services/Ga4ReportDefinitions.ts` | Landing pages, page performance, key events, device breakdown (`engagementRate`, `keyEvents`), ecommerce (`purchaseRevenue`). |
| GA4 health             | `Ga4MeasurementHealthService.ts`                           | Checks that tracking can support decisions.                                                                                   |
| GA4 opportunities tool | `SearchOpportunityService.ts`                              | Joins Search Console and GA4 landing pages.                                                                                   |
| Opportunity engine     | RFC-0002                                                   | Types, evidence tables, scoring, identity.                                                                                    |
| Drafting               | RFC-0004                                                   | Grounded drafts with deterministic checks.                                                                                    |
| Publishing             | RFC-0005                                                   | Exact-change approval, pull requests, deployment signals.                                                                     |
| Split tests            | RFC-0011                                                   | Controlled tests on page groups.                                                                                              |

Test site S1 keeps its page copy in `apps/www/lib/content.ts`, which page files import. Many marketing sites store copy in content modules, Markdown or JSX text in the same way.

## 3. Goals

1. Find landing pages that lose conversions, from GA4 data only.
2. Propose copy, call-to-action and form-text changes as reviewed pull requests.
3. Measure the result with GA4 key events. Use a controlled test when the page group allows it.
4. Refuse dark patterns: no fake urgency, scarcity, reviews, logos, numbers or shaming.
5. Stop and explain when tracking cannot support a decision.

## 4. Non-goals

1. No layout or design generation.
2. No session recording or heatmaps.
3. No visitor-level A/B testing in phases 1 and 2. Phase 3 defines it.
4. No paid data.

## 5. Design

### 5.1 Phases

| Phase | Delivers                                                                                                 |
| ----- | -------------------------------------------------------------------------------------------------------- |
| 1     | Tracking gate, 4 detectors, copy locator and text edits, drafted copy, before-and-after GA4 measurement. |
| 2     | Page-group split tests with key events as the metric.                                                    |
| 3     | Visitor-level tests through edge middleware, with SEO-safe rules.                                        |

### 5.2 Tracking gate

Before any conversion work, Relay checks GA4:

1. At least one key event exists, with at least 30 events in the last 28 days.
2. The measurement health check passes.
3. The key event the owner chooses as "the conversion" (for example `sign_up` or `generate_lead`) is stored per project: `project_conversion_events` (`project_id`, `event_name`, `value_minor` nullable, `currency` nullable, `created_by`).

When a check fails, show what to set up in GA4 and create no conversion opportunity.

**As built (part A).** The gate reads the GA4 key-event list from the Admin API and the key-event counts of the last 28 complete days, for all channels. It has four checks: a web data stream, at least one key event, at least 30 events of the conversion (of any key event before a choice), and a chosen key event that GA4 still lists. Each failed check shows its fix. Owners and admins choose the key event and an optional value per conversion in the property's currency. The choice is stored per project and written to the audit log. A GA4 error shows its message instead of a result.

### 5.3 Detectors

All detectors use the organic search channel by default. The owner can switch to all channels. Each rule's thresholds are named constants with boundary tests.

| Type                 | Rule                                                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cro_low_conversion` | A landing page with ≥ 300 sessions in 28 days has a conversion rate (chosen key events / sessions) at or below 50% of the site median for pages with the same key-page role, and the gap is ≥ 5 conversions. |
| `cro_form_drop_off`  | A page with ≥ 50 `form_start` events has `form_submit / form_start` ≤ 30%. GA4 enhanced measurement must record form interactions. Otherwise skip with the reason.                                           |
| `cro_device_gap`     | A page with ≥ 200 mobile sessions has a mobile conversion rate at or below 50% of its desktop rate.                                                                                                          |
| `cro_low_engagement` | A page with ≥ 300 organic sessions has an engagement rate ≤ 40% while the site median is ≥ 55%.                                                                                                              |

Evidence: extend RFC-0002's `opportunity_ga4_evidence` with `device` (nullable), `engaged_sessions`, `key_event_name` (nullable), `form_starts` and `form_submits`.

**Value.** Show "If this page converted at the site median, it would get about N more conversions in 28 days." When the owner set a value per conversion, also show the amount. Label it "not a forecast".

**Score.** Use the RFC-0002 formula. Commercial score = 1.0 for pages whose conversions carry value, else the key-page role score. Demand = `min(1, log10(1 + sessions) / 4)`. Visibility = the conversion gap as a share of the median.

**As built (part B).** "Find conversion problems" on the Opportunities page starts a conversion run. It runs only after the tracking gate passes, and at most once in 24 hours. Opportunities belong to a Search Console property, so the run also needs the Search Console connection. It reads one GA4 report of sessions, engaged sessions and the chosen key event by landing page and device, and one report of `form_start` and `form_submit` by page when GA4 records form interactions. Without form interactions, the form check is skipped, and the run result and the gate say so. Both reports cover the last 28 complete days, for organic search or for all traffic as the owner chooses. Medians use only the pages with 300 or more sessions. The value sentence uses the median for pages with the same role. Visibility is 1 minus the page rate divided by the reference rate: the role median, a 30% submit rate, the desktop rate or the site engagement median. Difficulty is a neutral 0.5, confidence is 0.5 and effort is 2 hours. Device rows are stored as separate evidence rows, so the evidence key now includes the device.

### 5.4 Copy locator and text edit

This is a new publishing change kind, `copy_text`. RFC-0013, RFC-0014 and RFC-0017 reuse its file reading rules.

1. The user picks the text to change from a list that Relay extracts from the live page with `analyzeHtml`: headings, buttons, links, form labels and short paragraphs.
2. Relay starts at the page file (RFC-0004 locator). It follows static imports inside the repository to depth 2. It reads at most 20 files and 1 MB in total, only `.js`, `.jsx`, `.ts`, `.tsx`, `.json`, `.md` and `.mdx`.
3. It finds string literals, template literals without expressions, JSX text and Markdown text nodes whose whitespace-normalized text equals the chosen text.
4. It requires exactly one match. Otherwise it stops with the matches it found.
5. When the matching literal sits in a module that other pages import, it lists those pages. The user must confirm that they change too.
6. It replaces only that node and parses the file again.
7. It rejects text that is split across nodes, contains markup, or is computed.

**Data model.**

- `opportunity_proposals.change_kind`: text enum `metadata`, `copy_text`, `jsx_attribute`, `markdown`, default `metadata`.
- `proposal_text_edits`: `id`, `proposal_id` (FK cascade), `ordinal`, `file_path`, `node_kind`, `before_blob_sha`, `after_blob_sha`, `before_text`, `after_text`, `before_snippet`, `after_snippet`. A proposal holds at most 5 edits in at most 3 files.
- Fingerprint version 3 hashes every edit, plus the blob SHA of the page file.

On S1, the `/approach` hero text resolves to `apps/www/lib/content.ts`.

**As built (part C1).** "Change page text" in the publishing panel of an approved opportunity reads the live page once, without following a redirect, and lists up to 100 headings, links, buttons, form labels and paragraphs of 300 characters or fewer. It uses the page analyzer's streaming HTML parser, because `analyzeHtml` keeps headings only. The locator starts at the page file that RFC-0004 finds. It resolves relative imports and `@/` from the root directory, tries the usual extensions and `index` files, and skips type-only imports. Files over GitHub's 32 KB read limit are skipped. In Markdown, a node is one heading, list item, quote or paragraph line without markup. The S1 hero title carries an underscore accent in the source, so it is markup and the locator refuses it; the hero introduction resolves to `apps/www/lib/content.ts`. The sharing check reads the app directory's file list in one request and up to 30 other page files. A page shares the text when it imports the module that holds it, and the export that holds it, if there is one. Nothing is written in this step.

**As built (part C2).** After the locator finds the text, the person enters the new text in the same sheet. When other pages share the text, the person must confirm that they change too, and the proposal's risk lists them. A copy change can be prepared for any approved opportunity, because the text picker works on any page. The sheet sends one edit; the service accepts up to 5 edits in up to 3 files. Each edit escapes the new text for its node: quotes in string literals, backticks and `${` in template literals. It refuses `{`, `}`, `<` and `>` in JSX text, and Markdown markup in Markdown text. The edited file must parse again with the new text in the same node. Versions 3 to 5 of the fingerprint were already taken by metadata changes, so a copy change uses version 6: it binds the change kind, every edit, and the blob SHA of the page file. Execution builds the edits again from the base commit and refuses any difference. It then writes one commit with every changed file through the Git trees API, points the new branch at that commit, checks that the commit changes exactly those files, and opens one pull request. Relay does not prepare a revert for a copy change; the owner uses the pull request's Revert button in GitHub.

### 5.5 Drafted copy

Reuse the RFC-0004 drafting service with a conversion prompt.

**Inputs:** the page's current text blocks, the chosen key event, the top organic queries, the device and form evidence, and the project context.

**Rules, enforced by deterministic checks after the model:**

1. No new numbers, prices, customer names, logos, reviews, ratings or awards that are not in the inputs.
2. No urgency or scarcity words ("only", "last chance", "ends today", "spots left") unless the same claim is in the inputs.
3. No shaming opt-outs ("No thanks, I hate saving money").
4. A call-to-action label is 2 to 5 words and starts with a verb.
5. A headline keeps the main query's key terms when the page ranks for them.

Each draft lists its claims with sources, as in RFC-0004.

**As built (part D).** "Draft with AI" in the page text sheet drafts new text for the picked block. It shares RFC-0004's admission, daily limits, spend hold and storage, as the draft kind `page_copy`. The prompt holds the page's queries, the current text, the chosen conversion and the opportunity's GA4 evidence, the live page and the project context. A draft passes RFC-0004's number, quote, claim and query checks with a length per block kind, then the rules above. Reviews, ratings, logos, awards and customer names, and urgency or scarcity words, pass only when the page, the project context or the current text states the same phrase. A call to action must start with one of a fixed list of verbs. For a heading, the main query is the page's top Search Console query, and its terms that the current heading uses must stay. A passing draft fills the new text field, the person can edit it, and the proposal records the draft it came from.

### 5.6 Measurement

**Phase 1, before and after.** Extend RFC-0006 with the conversion metric for the changed page: daily sessions and chosen key events. Directional label only when each period has ≥ 1,000 sessions and ≥ 50 conversions, and the conversion rate changes by ≥ 20% relative and ≥ 10 conversions absolute. Otherwise "inconclusive". Always show the caveats.

**As built (part E1).** Every measurement run adds the project's chosen conversion to the key events it reads, so experiments started before the choice also get it. The experiment's GA4 section shows the conversions and the conversion rate of the baseline and observation periods, the label, and the caveats. Experiments keep RFC-0006's organic search sessions that start on the changed page.

**Phase 2, split tests.** For copy that lives in a template shared by 30 or more pages, run an RFC-0011 test with the metric `ln(1 + conversions per day)`. Eligibility uses the same MDE rule on conversions.

**As built (phase 2).** A new split test chooses clicks or the chosen conversion. A conversion test stores its metric and the event name. The group must pass RFC-0011's click rules, and the same page, volume and MDE rules on its 56-day conversions from GA4: zeros have no spread, so the MDE alone would pass a group with almost no conversions. The daily refresh runs RFC-0011's paired analysis on the chosen event's organic conversions by landing page and day, so the label, interval and harm notice use conversions. Sessions stay the secondary metric.

### 5.7 Phase 3: visitor-level tests

Some pages have no group, for example the home page. Phase 3 adds visitor-level tests:

1. A Next.js middleware snippet assigns a first-party cookie bucket, 50/50, only after analytics consent.
2. The page renders the variant for the bucket. Search engine crawlers are treated like any visitor. They are never singled out.
3. Each page view sends a GA4 event parameter `relay_variant`. The owner registers it as a custom dimension.
4. Analysis reads conversions by variant through the GA4 Data API, with a two-proportion test and a fixed sample size set before the start.
5. Tests stop at the planned size or after 6 weeks. Remove the losing variant afterwards.

Phase 3 needs its own security and SEO review before work starts.

### 5.8 User interface

1. Opportunities gets a "Conversion" filter group with the 4 types.
2. Project settings gets a "Conversion" section: the chosen key event, its value and the tracking-gate status.
3. The proposal panel gets a text picker and the copy diff, with the other pages that change.
4. Experiments shows conversion metrics next to search metrics.

## 6. Security and privacy

1. GA4 data stays aggregated. No visitor-level data is stored in phases 1 and 2.
2. The text locator reads only files reachable from the page, within the limits.
3. Drafts pass the dark-pattern checks before any user sees them.
4. Phase 3 sets cookies only after consent, and its privacy text must be reviewed first.

## 7. Cost

GA4 requests are free. Drafts cost model credits, as in RFC-0004.

## 8. Alternatives considered

1. **JavaScript testing tools (VWO, Optimizely).** They change pages in the browser, which can cause flicker and leaves the change outside the code.
2. **Heatmaps and recordings.** Useful for discovery, but they collect visitor-level data and do not ship fixes.
3. **Model-written page redesigns.** Rejected. Copy changes are reviewable and measurable. Redesigns are not.

## 9. Ready-for-other-users checklist

### Phase 1

- [x] Tracking gate with `project_conversion_events`, and the setup guidance when it fails.
- [x] Four detectors with boundary tests, and the skip reason when form events are missing.
- [x] Evidence columns added in D1 and Postgres, with the parity test.
- [x] Value text with the "not a forecast" label.
- [x] Copy locator: import walk, limits, single-match rule, shared-module warning (tests with a copy of S1's `lib/content.ts`). The test copy is trimmed, because S1's repository is private and this one is public.
- [x] `change_kind`, `proposal_text_edits` and fingerprint version 3. Built as version 6, because metadata changes already use versions 3 to 5.
- [x] Execution writes the text edits in one commit (test against the GitHub mock).
- [x] Conversion drafting with one test per dark-pattern rule.
- [x] Conversion metric in experiments with the directional thresholds.
- [x] UI: filter group, settings section, text picker and copy diff.
- [x] `content/docs/conversion.mdx` explains the gate, the detectors, the rules and the limits.

### Phase 2

- [x] RFC-0011 tests with the conversion metric, and the eligibility check on conversions.

### Phase 3

- [ ] Separate review approved before work starts.
- [ ] Middleware snippet, consent hook, GA4 custom dimension setup guide and the two-proportion analysis.

## 10. Real-site acceptance test

### Phase 1

**Site:** S2 (`conduitt.io`), with GA4 and a key event for demo or sign-up requests. Use S1 for the copy locator.

**Steps:**

1. Run the tracking gate. Fix any setup gap it reports.
2. Run the conversion detectors. Record the count per type.
3. The owner reviews every item.
4. For 3 items, compare the numbers with a GA4 Exploration for the same dates and filters.
5. On S1, pick the `/approach` hero headline and draft a new one. Prepare the proposal.
6. On S2, approve one copy change. Merge and deploy it. Start tracking.

**Pass when:**

- The gate gives a clear pass, or a precise list of what to fix.
- The owner judges at least 70% of items worth acting on.
- Checked numbers match GA4 within 2%.
- The S1 proposal edits `apps/www/lib/content.ts` and nothing else, and lists the other pages that use the text, if any.
- No draft contains a dark pattern or an unsupported claim (the owner checks each one).
- The S2 experiment shows conversion metrics with the caveats.

**Value check:** the owner sees which organic landing pages lose sign-ups, and ships a reviewed copy fix in one session.

### Phase 2

**Site:** a site with a template group of 30 or more pages and enough conversions (check S4 and S2).

**Pass when:** the eligibility check gives a clear yes or no with the MDE. An eligible test reaches a label with an interval.

## 11. Completion criteria

**Accuracy**

- For 10 items, sessions and conversions match a GA4 Exploration within 2%.
- Site medians recomputed by hand from the stored evidence match.

**Usefulness**

- At least 70% of items judged worth acting on. At least 2 findings new to the owner.
- At least 1 copy change ships on a real site during the test window.

**Copy locator**

- On 10 text blocks across S1 and S2, the locator finds the right node for at least 8, and never edits a wrong node.

**Drafts**

- At least 8 of 10 drafts are usable with small edits or none.
- 0 dark patterns and 0 unsupported claims across 20 drafts, including 5 on staging pages seeded with fake urgency and fake reviews.

**Honesty**

- Every result below the thresholds says "inconclusive" with the reason.
- No screen promises a conversion lift.

## 12. Follow-ups that do not block closing

Each follow-up names its trigger. Check it here when it passes.

- [ ] Phase 1 acceptance on S2 (section 10, steps 1 to 4 and 6): the gate, the detector counts, the owner's review of every item, three items checked against a GA4 Exploration, and one approved copy change that ships and is tracked. Trigger: the owner connects GA4 to the S2 project, with a key event for demo or sign-up requests. On 2026-10-18 no production project had GA4 connected.
- [ ] Phase 1 acceptance on S1 (section 10, step 5): the `/approach` hero introduction resolves to `apps/www/lib/content.ts`, a draft and the proposal. The hero title carries an underscore accent in the source, so the locator refuses it as markup. Trigger: the GitHub App is installed again on PlaybookMediaLLC; both production connections use it.
- [ ] Phase 2 acceptance (section 10): a split test on the chosen conversion with a clear yes or no on eligibility, and a label with an interval. Trigger: a site with a template group of 30 or more pages, 1,000 conversions in 56 days and GA4 connected.
- [ ] Completion criteria (section 11): accuracy against GA4 Explorations, usefulness reviews, the copy locator on 10 text blocks, and 20 rated drafts including 5 staging pages seeded with fake urgency and fake reviews. Trigger: the S2 acceptance above.
- [ ] Phase 3, visitor-level tests (section 5.7). Trigger: the owner approves a separate security and SEO review. Then the middleware snippet, the consent hook, the GA4 custom dimension guide and the two-proportion analysis.

**Production smoke check (2026-10-18, Playbook Media project):** Project settings > Conversion showed the gate's "Connect Google Analytics" step and no chosen conversion. "Find conversion problems" answered "Connect Google Analytics and choose the conversion in Project settings > Conversion first." The type filter showed the Search and Conversion groups with the four conversion types.
