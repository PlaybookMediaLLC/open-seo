# RFC-0024: Change history and learning

- **Status:** Partial foundation: weekly selection already has cooldown, measuring-window, and negative-result filters. Durable page history, proposal-time enforcement, draft memory, and track records remain draft.
- **Date:** 2026-10-15
- **Delivery order updated:** 2026-10-23
- **Area:** stage 4 foundation before campaigns; partial selection rules already implemented.
- **Depends on:** Phase 1a reuses RFC-0005 executions, RFC-0006/0011 results, RFC-0004 drafting, and the existing RFC-0018 queue. Phase 1b adds RFC-0019 production observations and RFC-0028 verification. The first monitoring/repair slice does not depend on this full history feature.

## 1. Summary

Ongoing work must improve over time, not repeat itself. Relay stores decisions, approvals, executions and results. `workCycle.ts` already uses them for 28-day cooldowns, measuring-window exclusion, and 180-day negative-result filtering by opportunity type. Those selection filters are not yet a shared page-history or proposal-time enforcement system. This RFC keeps one change history per page, including changes that the customer made outside Relay, and uses it to stop repeats, to wait while a page is measuring, to give drafts the page's past results, and to recommend the next step after each result.

## 2. What exists today

| Part                            | Location                                | Use in this RFC                                                                               |
| ------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------- |
| Decisions                       | `opportunity_decisions`                 | Who decided what.                                                                             |
| Approvals and executions        | RFC-0005 tables                         | What shipped and when.                                                                        |
| Results                         | RFC-0006 labels, RFC-0011 labels        | What happened.                                                                                |
| Snapshots (planned)             | RFC-0019 `page_snapshots`               | Future evidence of changes made outside Relay.                                                |
| Selection filters (implemented) | `src/server/features/work/workCycle.ts` | Reuse cooldown, active-measurement, and negative-result filtering instead of rebuilding them. |
| Audit log                       | RFC-0009 `audit_events`                 | Cross-feature index.                                                                          |
| Project memory                  | `project_research_log` (spec 0010)      | Free-text research notes, not used for rules.                                                 |

## 3. Goals

1. One timeline per page: every change by Relay or by others, with its result.
2. Rules that use the timeline: cool-downs, no repeats, and wait-while-measuring.
3. Drafts that know the page's past changes and results.
4. A track record per change class, shown on Next items.
5. A clear next step after every result.

## 4. Non-goals

1. No cross-customer learning in phases 1 and 2.
2. No model that predicts results. Track records are counts, not forecasts.

## 5. Design

### 5.1 Phases

| Phase | Delivers                                                                                                                                                               |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1a    | Durable timeline for existing Relay changes/results, shared rules reused from the weekly selector, proposal-time checks, draft context, and next-step recommendations. |
| 1b    | Accepted external changes and verified repairs from RFC-0019/0028, with the same rules and explicit override history. Complete before ongoing campaigns.               |
| 2     | Project track record per change class; any confidence adjustment is descriptive and visibly explained, not a causal forecast.                                          |
| 3     | Optional anonymized cross-customer counts after demand and the stated legal review.                                                                                    |

### 5.2 Page change records

`page_changes`:

| Column                        | Type                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| `id`                          | text primary key                                                                                 |
| `project_id`                  | text, FK cascade                                                                                 |
| `url_path`                    | text                                                                                             |
| `changed_at`                  | text (the verified deployment time, or the first snapshot that shows it)                         |
| `source`                      | text enum `relay_proposal`, `relay_restore`, `relay_new_page`, `customer_detected`               |
| `field`                       | text enum `title`, `description`, `canonical`, `robots`, `content`, `links`, `new_page`, `other` |
| `change_class`                | text, nullable (the RFC-0018 class)                                                              |
| `before_value`, `after_value` | text, nullable, at most 300 characters                                                           |
| `proposal_id`                 | text, nullable FK                                                                                |
| `snapshot_id`                 | text, nullable FK                                                                                |
| `experiment_id`               | text, nullable FK                                                                                |
| `outcome_label`               | text, nullable (copied when the result is final)                                                 |

Index on (`project_id`, `url_path`, `changed_at`).

**Writers:**

1. A Relay change writes a row when its deployment is verified (RFC-0005).
2. RFC-0019 writes a `customer_detected` row when a snapshot shows a change of a tracked field that Relay did not make, and the owner accepts it as known-good.
3. RFC-0006 and RFC-0011 copy the final label into `outcome_label`.

### 5.3 Rules

| Rule               | Behavior                                                                                                | Override                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Cool-down          | No new change to a page within 28 days of its last change, or while it is inside a measuring window.    | Regression restores are exempt.                                                     |
| No repeat          | No proposal of the same change class on the same page within 180 days of a negative result.             | An owner can override with a written reason. The reason is stored in the audit log. |
| Inconclusive twice | After two inconclusive results of one class on a page, lower that class's priority on the page by half. | None.                                                                               |
| Customer change    | After a `customer_detected` change, treat it like a Relay change for the cool-down.                     | None.                                                                               |

RFC-0018 selection reads these rules. Every excluded item records which rule excluded it, so the empty-week reasons stay true.

### 5.4 Draft context

1. RFC-0004, RFC-0012 and RFC-0020 drafts receive the page's last 3 changes with their outcomes.
2. The prompt says: do not repeat a value or pattern whose result was negative.
3. A deterministic check rejects a draft that equals any earlier value of the same field on the page.

### 5.5 Next-step recommendations

After a final result, Relay adds one recommendation to the page timeline and to RFC-0018 Next when it passes the bar:

| Result       | Recommendation                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Encouraging  | Apply the same pattern to similar pages (an RFC-0020 campaign), or offer an RFC-0011 split test when 30 or more similar pages exist. |
| Inconclusive | Wait, or try a different change class. Never repeat the same change.                                                                 |
| Negative     | Prepare a revert (RFC-0005), and record the pattern as negative for the page.                                                        |

### 5.6 Track record (phase 2)

1. Count final results per change class and opportunity type in the project, for example: "Title changes on striking-distance pages: 5 encouraging, 3 inconclusive, 1 negative."
2. Show the track record on Next items of that class.
3. With at least 5 final results, adjust confidence by up to 0.1: up when encouraging results are the majority, down when negative results are at least a third.
4. Show the adjustment in the score explanation.

### 5.7 Cross-customer results (phase 3)

1. Opt-in per organization in settings, off by default.
2. Share only counts per change class and opportunity type, never content, URLs or domains.
3. Show a figure only when it comes from at least 20 projects.
4. Needs a legal and privacy review, and an update to the terms and the privacy policy, before work starts.

### 5.8 User interface

1. Every page that Relay shows (opportunity, regression, monitoring) links to its timeline: changes, results, regressions and snapshots in date order.
2. Project → **Track record** (phase 2): results per change class.

## 6. Security

1. Timeline values are short snapshots, never full pages.
2. Overrides of the no-repeat rule require the manage permission and write an audit event.

## 7. Cost

No provider calls. Reads from stored records only.

## 8. Alternatives considered

1. **Use the free-text research log.** Rejected. Rules need structured records.
2. **A model that predicts results.** Rejected. Counts are honest and explainable. Predictions would look like forecasts.

## 9. Ready-for-other-users checklist

### Phase 1

- [ ] `page_changes` in D1 and Postgres, with the three writers (tests).
- [x] Weekly selection already excludes recent/measuring pages and negative results (`workCycle.ts`); this does not complete the full history contract.
- [ ] Reuse those filters as shared rules, enforce them at proposal preparation, and add inconclusive-twice, accepted customer-change, and recorded override behavior (one behavior test each).
- [ ] Exclusion reasons recorded per item (test).
- [ ] Draft context and the earlier-value check (tests).
- [ ] Next-step recommendations for each label.
- [ ] Page timeline view.
- [ ] `content/docs/history.mdx`.

### Phase 2

- [ ] Track record counts, the display on Next items, and the confidence adjustment with its explanation (tests).

### Phase 3

- [ ] Legal and privacy review approved before work starts.
- [ ] Opt-in, counts only, and the 20-project minimum (tests).

## 10. Real-site acceptance test

**Site:** S1, after the RFC-0005 phase 1b and RFC-0006 tests.

**Steps:**

1. Open the timeline of the page changed in the RFC-0005 test.
2. Change the title of another S1 page directly in the repository, outside Relay. Deploy it, and accept it as known-good.
3. Try to prepare a change for both pages in the same week.
4. Seed a negative result for a test page on staging, then try the same change class again.
5. Draft a new description for a page with earlier changes.

**Pass when:**

- The timeline shows the Relay change, its verification and its result.
- The change outside Relay appears as `customer_detected`.
- Both new changes are excluded by the cool-down, with the reason shown.
- The repeat is blocked, and an owner override records its reason.
- The draft avoids earlier values, and the check rejects an exact repeat.

**Value check:** the owner sees what was tried and what happened, and Relay does not try the same failed change twice.

## 11. Completion criteria

- 100% of verified Relay changes and accepted outside changes appear in the timeline.
- 0 proposals that break the cool-down or no-repeat rules without a recorded override.
- 0 drafts equal to an earlier value of the same field on the page.
- Every final result has a next-step recommendation.
