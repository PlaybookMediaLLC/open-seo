# RFC-0003: Opportunities queue, remaining gaps

- **Status:** Done on 2026-10-16 for every item that Relay's code can close (PRs #69 and #70). The items in section 11 need a second team member and opportunities from real search data. The owner decided on 2026-10-16 that they do not block closing this RFC.
- **Date:** 2026-10-15
- **Brief section:** 4 (Feature B)
- **Depends on:** RFC-0001.

## 1. Summary

The Opportunities queue is mostly complete. It has the full lifecycle, filters, pagination, evidence history, review decisions and a run log. This RFC closes six gaps: owner assignment, hidden deferred items, a fixed defer period, stale items, text search and per-status counts. It also defines the fallback action for opportunity types that have no automated change.

## 2. What exists today

| Part           | Location                                                                               | Behavior                                                                                                                             |
| -------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| List route     | `src/routes/_app/p/$projectId/opportunities/index.tsx`                                 | Filters in URL search params: status, type, minimum priority, sort (`priority`, `newest`), offset. Page size with previous and next. |
| Filter bar     | `src/client/features/opportunities/OpportunityFilterBar.tsx`                           | Status, type, priority and sort controls.                                                                                            |
| Detail route   | `src/routes/_app/p/$projectId/opportunities/$opportunityId.tsx`                        | Evidence, decisions, publishing panel.                                                                                               |
| Review         | `src/client/features/opportunities/OpportunityReview.tsx`, `OpportunityService.review` | Decisions `reviewed`, `approved`, `rejected`, `deferred`, with a note and an expected version.                                       |
| Run log        | `src/client/features/opportunities/OpportunityRunLog.tsx`                              | Past runs with counts and errors.                                                                                                    |
| Owner          | `opportunities.owner_user_id`                                                          | Column exists. No code sets it.                                                                                                      |
| Defer          | `OpportunityService.review`                                                            | Always 7 days.                                                                                                                       |
| Deferred items | `listOpportunitiesInputSchema.includeDeferred`                                         | The server supports it. The UI never sends it, so deferred items are hidden until they expire.                                       |

## 3. Goals

1. A team can assign each opportunity to one member.
2. A user can see deferred items and choose how long to defer.
3. A user can see which items the latest analysis no longer found.
4. A user can find an item by URL or query text.
5. A user sees how many items are in each status.
6. Every opportunity type offers at least one next action.

## 4. Non-goals

1. Bulk actions. Add them only after users ask.
2. Cross-project lists. RFC-0007 covers portfolio views.
3. Notifications. RFC-0008 covers them.

## 5. Design

### 5.1 Owner assignment

1. Add `assignOpportunityInputSchema` in `src/types/schemas/opportunities.ts`: `projectId`, `opportunityId`, `expectedVersion`, `ownerUserId` (string or null).
2. Add `OpportunityService.assign`. It requires the `integration: ["manage"]` permission, as review does.
3. The service checks that the new owner is a member of the project's organization. Use the existing member lookup in `src/server/auth/repositories/AuthRepository.ts`.
4. Add `OpportunityRepository.assign`. It updates `owner_user_id` and increments `version` with a conditional update on the expected version.
5. Record the change as a decision row. Add `assigned` to the `decision` enum of `opportunity_decisions`. `from_status` and `to_status` stay equal. Put the new owner's display name in `note`.
6. Add `assignOpportunity` server function with `requireProjectContext`.
7. Add an owner select to the detail view. List organization members. Include "Unassigned".
8. Add an `owner` filter to the list: `me`, `unassigned`, or a user id. Add it to the URL search schema.
9. Show the owner's avatar in a new list column.

### 5.2 Deferred items and defer length

1. Add a "Show deferred" toggle to the filter bar. It sets `includeDeferred` in the URL.
2. Show a "Deferred until {date}" badge on deferred rows.
3. Add `deferDays` to `reviewOpportunityInputSchema`: one of 7, 30 or 90, default 7. The service rejects it for other decisions.
4. Replace the fixed 7-day value in `OpportunityService.review` with `deferDays`.
5. In the review form, show the three choices when the user picks "Defer".

### 5.3 Items not found by the latest analysis

1. Do not add a status. The brief lifecycle has no such state, and human decisions must stay intact.
2. Derive the flag on read. An item is "not in latest analysis" when its `last_detected_at` is older than the latest completed run's `started_at` for the same site and the same run kind (RFC-0002 content-gap runs are a separate kind).
3. Return the flag as `stale: boolean` from `OpportunityRepository.list` and `getDetail`.
4. Add a `freshness` filter: `all`, `current`, `stale`. Default `all`.
5. Show a muted "Not in latest analysis" badge. Explain it in a tooltip: "The latest analysis did not find this opportunity. The issue may be fixed, or the data may have changed."
6. Approval already requires evidence 14 days old or newer. Keep that rule.

### 5.4 Text search

1. Add `q` to the list input: trimmed, 1 to 200 characters, optional.
2. Match `url` or `query` with a case-insensitive `LIKE '%q%'`. Escape `%`, `_` and `\` in the input.
3. Use the same expression in D1 and Postgres. Use `lower(column) LIKE lower(?)` so both dialects behave the same.
4. Add a search input to the filter bar. Debounce it by 300 ms. Keep it in the URL.

### 5.5 Status counts

1. Add `OpportunityRepository.countByStatus(projectId)`. It returns one count per status with one grouped query.
2. Return the counts from `OpportunityService.list`.
3. Show the counts in the status select, for example "Discovered (12)". The counts use every other filter, so a status count equals the list total when that status is picked.

### 5.6 Next action for every type

| Type                | Automated change today                   | Fallback action                                            |
| ------------------- | ---------------------------------------- | ---------------------------------------------------------- |
| `striking_distance` | Meta description (RFC-0004 drafts it)    | Issue ticket                                               |
| `low_ctr`           | Meta description, later title (RFC-0005) | Issue ticket                                               |
| `declining_page`    | None                                     | Investigation summary (RFC-0004), then issue ticket        |
| `cannibalization`   | None                                     | Issue ticket                                               |
| `technical_blocker` | Later: canonical and robots (RFC-0005)   | Issue ticket                                               |
| `internal_link`     | None                                     | Issue ticket with the source, target and anchor suggestion |
| `content_gap`       | None                                     | Content brief (RFC-0004)                                   |

An issue ticket in this RFC is text only. The user copies it. It has a title, the affected URLs, the evidence summary, the proposed change, the risk and the verification plan. RFC-0005 adds an approved GitHub issue later.

1. Add a "Create ticket" button for approved opportunities of every type (approved, in progress, implemented or failed). The RFC-0005 GitHub issue uses the same text.
2. Build the text on the server from stored fields only. No model call.
3. Show it in a sheet with a "Copy" button.

## 6. Security and tenancy

1. Assignment checks organization membership on the server. The client list is not trusted.
2. Text search is parameterized. No raw SQL from input.
3. Ticket text is built from stored, escaped fields. It never includes tokens or provider bodies.

## 7. Alternatives considered

1. **A `stale` status.** Rejected. It would overwrite a human decision with machine state.
2. **Full-text search tables.** Rejected for now. The list is per project and bounded, so `LIKE` is enough.
3. **Model-written tickets.** Rejected for this RFC. Stored fields give a correct ticket without cost.

## 8. Ready-for-other-users checklist

- [x] `assigned` added to the decision enum.
- [x] `assignOpportunity` server function, service and conditional repository update.
- [x] Test: a non-member cannot become the owner.
- [x] Test: a member without manage permission cannot assign.
- [x] Test: a stale `expectedVersion` returns a conflict.
- [x] Owner select in the detail view, owner column and owner filter in the list.
- [x] "Show deferred" toggle and deferred badge.
- [x] `deferDays` input with 7, 30 and 90, and a test that other values fail.
- [x] Derived `stale` flag with a repository test on D1 and Postgres.
- [x] `freshness` filter and the badge with its tooltip.
- [x] `q` search with escaping, and a test that `%` and `_` match literally.
- [x] Status counts in one grouped query, shown in the status select.
- [x] "Create ticket" for every approved type, with a test that the text has no secrets.
- [x] All new filters stay in the URL and survive a reload. Checked live: a URL with search, owner and deferred filters restores every control.
- [x] Keyboard and screen-reader check of the new controls. Every filter control has a name and a logical Tab order. The live check found that focus fell to the page body after each filter change; PR #70 keeps the list mounted while it loads, and a second live check confirmed focus stays in the control.
- [x] Layout check at 390 px and 1440 px. No page-level horizontal scroll at either width; tables scroll inside their cards. PR #70 also stacks the Search and Minimum priority labels.
- [x] `content/docs/opportunities.mdx` explains owners, defer, stale items and tickets.

## 9. Real-site acceptance test

**Site:** the project with the most opportunities after RFC-0002 phase 1 (S2, or S3 when S2 has no data). Use two real team accounts.

**Steps:**

1. Assign 5 opportunities, 3 to one member and 2 to the other.
2. Defer one for 30 days. Reject one with a note.
3. Search by part of a URL, then by part of a query.
4. Fix one issue on the live site, or wait for new data. Run detection again.
5. Create a ticket for 3 opportunities of different types. Give each ticket to an engineer.
6. Run a 15-minute triage of the queue with the second member.

**Pass when:**

- The "assigned to me" filter shows exactly the assigned items for each member.
- The deferred item appears only with "Show deferred", with its date.
- Both searches find the expected items.
- Items not found again show "Not in latest analysis".
- The status counts equal the filtered list totals.
- Each engineer can act on the ticket without asking a question.
- The triage ends with every discovered item reviewed, deferred, rejected or assigned.

**Value check:** a two-person team runs a weekly 15-minute review, and every item leaves with an owner or a decision.

## 10. Completion criteria

**Workflow**

- The second weekly triage of up to 50 items takes 15 minutes or less.
- Every item leaves triage with an owner or a decision.
- Six filter combinations (owner, type, status, search, freshness, deferred) each return the same rows as a direct database query.
- A copied list URL shows the same list to another member.

**Correctness**

- Status counts equal a direct database count for each status.
- An item that the next run does not detect shows "Not in latest analysis". An item detected again loses the flag.
- Defer lengths of 7, 30 and 90 days hide the item until the exact date.

**Concurrency**

- When two members change the same item, the second sees a conflict message, and no change is lost (test and manual check).

**Tickets**

- Three engineers rate tickets for three types at 4 of 5 or higher for clarity.
- Every ticket contains the URL, the evidence numbers, the proposed change, the risk and the verification plan.
- No ticket contains a token, a secret or a provider body (test).

**Usability and performance**

- A person can triage with the keyboard alone.
- The list with filters answers in under 500 ms at the 95th percentile with 1,000 items.

## 11. Follow-ups that do not block closing

Each follow-up names its trigger. Check it here when it passes.

- [ ] Acceptance steps 1 to 6 (section 9) with two real team members. Trigger: the second account (`yoanyombapro@gmail.com`) accepts its invitation, and the project has opportunities from real search data (see RFC-0002 section 13).
- [ ] Three engineers rate tickets for three types at 4 of 5 or higher. Trigger: the same.
- [ ] The second weekly triage of up to 50 items takes 15 minutes or less. Trigger: the same, one week later.

Evidence for the completion criteria that code can show:

- **Performance:** with 1,000 items and 20 runs, the list answers in under 6 ms at the 95th percentile on SQLite and under 8 ms on Postgres (database time, four filter combinations, 40 calls each, 2026-10-16). D1 network time comes on top.
- **Correctness:** real-SQL tests on SQLite and Postgres prove the stale flag (also across run kinds), the status counts against the list totals, literal `%` and `_` in search, the owner filter, and that an assignment keeps a deferral.
- **Concurrency:** a stale `expectedVersion` returns a conflict in the service and at the atomic write (tests).
- **Tickets:** a test proves that a ticket holds the URL, the evidence numbers, the change, the risk and the check, and never a note or an older run.
