# RFC-0012: Conversion optimization for landing pages

- **Status:** In progress. Part A built: the tracking gate and Project settings > Conversion.
- **Date:** 2026-10-15
- **Area:** beyond SEO. Visitors that search brings must become customers.
- **Depends on:** RFC-0004 (drafting), RFC-0005 (publishing), RFC-0006 (measurement), RFC-0011 (split tests, phase 2).

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

### 5.6 Measurement

**Phase 1, before and after.** Extend RFC-0006 with the conversion metric for the changed page: daily sessions and chosen key events. Directional label only when each period has ≥ 1,000 sessions and ≥ 50 conversions, and the conversion rate changes by ≥ 20% relative and ≥ 10 conversions absolute. Otherwise "inconclusive". Always show the caveats.

**Phase 2, split tests.** For copy that lives in a template shared by 30 or more pages, run an RFC-0011 test with the metric `ln(1 + conversions per day)`. Eligibility uses the same MDE rule on conversions.

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
- [ ] Four detectors with boundary tests, and the skip reason when form events are missing.
- [ ] Evidence columns added in D1 and Postgres, with the parity test.
- [ ] Value text with the "not a forecast" label.
- [ ] Copy locator: import walk, limits, single-match rule, shared-module warning (tests with a copy of S1's `lib/content.ts`).
- [ ] `change_kind`, `proposal_text_edits` and fingerprint version 3.
- [ ] Execution writes the text edits in one commit (test against the GitHub mock).
- [ ] Conversion drafting with one test per dark-pattern rule.
- [ ] Conversion metric in experiments with the directional thresholds.
- [ ] UI: filter group, settings section, text picker and copy diff.
- [ ] `content/docs/conversion.mdx` explains the gate, the detectors, the rules and the limits.

### Phase 2

- [ ] RFC-0011 tests with the conversion metric, and the eligibility check on conversions.

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
