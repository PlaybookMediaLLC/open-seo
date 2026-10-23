# RFC-0006: Outcome measurement with GA4 and scheduled refresh

- **Status:** Done on 2026-10-17 for every item that Relay's code can close (PRs #79, #80 and #81). The daily automatic refresh and the result notification ship with RFC-0008's scheduler. The live checks need a GA4 connection and real Search Console data. The owner decided on 2026-10-17 that these do not block closing this RFC.
- **Date:** 2026-10-15
- **Brief section:** 7 (Feature E)
- **Depends on:** RFC-0001. Scheduled refresh depends on RFC-0008. Notifications depend on RFC-0008.

## Current delivery role — October 23, 2026

Implemented measurement foundation. Attach eligible observations after technical verification; positive growth is not required to prove a repair resolved its original rule.

The historical status and acceptance notes below are retained. The [delivery plan](README.md) and [current audit](../relay-release-assurance-audit.md) distinguish implementation, live acceptance, and commercial evidence.

## 1. Summary

Experiments & Results measures Search Console clicks, impressions, CTR and position for one page, before and after a confirmed deployment. It labels results as encouraging, inconclusive or negative with documented rules. It does not use GA4, and it measures only when a person clicks refresh. This RFC adds GA4 sessions, key events and revenue as supporting metrics, automatic daily refresh, a results summary, CSV export, and an optional long-term check.

## 2. What exists today

| Part              | Location                                                                             | Behavior                                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design record     | `docs/maintainers/specs/search-outcome-measurement.md`                               | Windows, data rules and labels.                                                                                                                                                   |
| Experiment record | `src/db/experiments.schema.ts`, `growth_experiments`                                 | Links opportunity, proposal and execution. Stores pull request state, merge, deployment attestation, declared other changes and seasonal risk, and the windows.                   |
| Runs and days     | `measurement_runs`, `measurement_days`                                               | One row per run. Daily Search Console rows per period.                                                                                                                            |
| Windows           | `MeasurementService.refresh`                                                         | Baseline: 28 days before deployment. Excluded: deployment day plus 6. Observation: next 28 days. End date at most 3 Pacific days before today.                                    |
| Allowance         | same                                                                                 | 24-hour cache for success. 5-minute retry after failure. At most 5 measurement requests per project per rolling 24 hours.                                                         |
| Labels            | `measurementAnalysis.ts`                                                             | Directional only with full windows, ≥ 100 baseline clicks, ≥ 1,000 impressions per period, no declared risk and no overlapping tracked change. Then ≥ 20 clicks and ≥ 20% change. |
| Status            | `confirmDeployment.ts`, `completeMeasurement.ts`                                     | Opportunity becomes `implemented`, then `measuring`, then `completed`.                                                                                                            |
| GA4 connection    | `src/db/ga4.schema.ts`, `ga4_connections`                                            | One property per project, with its time zone and currency.                                                                                                                        |
| GA4 reports       | `src/server/features/ga4/services/Ga4ReportingService.ts`, `Ga4ReportDefinitions.ts` | Organic landing pages, key events, ecommerce reports.                                                                                                                             |

## 3. Goals

1. Show organic sessions, engaged sessions, key events and revenue for the changed page when GA4 is connected.
2. Keep the result label based on Search Console clicks. Show GA4 as supporting evidence with its own sample-size rules.
3. Refresh measurements automatically once a day until the final result exists.
4. Summarize results across a project's experiments.
5. Let users export the daily data.
6. Offer one optional long-term check at 90 days.

## 4. Non-goals

1. No causal claims or statistical significance tests.
2. No multi-touch attribution. GA4 numbers use GA4's own session attribution.
3. No automatic revert. RFC-0005 adds a human-approved revert proposal.

## 5. Design

### 5.1 GA4 data

**Registration.**

1. When the project has a GA4 connection, store `ga4_property_id` on the experiment at registration. Add the column: text, nullable.
2. Let the user choose up to 5 key events to report separately. Store them in `experiment_key_events`: `id`, `project_id`, `experiment_id` (FK cascade), `event_name`. Unique on (`experiment_id`, `event_name`).
3. Without a choice, report the total of all key events only.

**Requests per measurement run.** Add at most 2 GA4 Data API requests to the existing run:

1. Daily totals: dimensions `date`; metrics `sessions`, `engagedSessions`, `keyEvents`, `totalRevenue`; filter `sessionDefaultChannelGroup = "Organic Search"` and `landingPage` = the target path, exact match.
2. Selected key events, only when the user chose some: dimensions `date`, `eventName`; metric `keyEvents`; the same filter plus `eventName` in the chosen list.

Reuse the GA4 client and token refresh in `Ga4ReportingService`. Add a fork-owned function for these two report shapes. Do not change the existing report definitions.

**Dates.** GA4 reports in the property time zone. Search Console uses Pacific dates. Use the same calendar dates for both. Say on the results page: "GA4 dates use the property time zone ({tz})." End the GA4 range at least 3 days before today in the property time zone, because GA4 can change recent data.

**Storage.**

`measurement_ga4_days`:

| Column             | Type                                      |
| ------------------ | ----------------------------------------- |
| `id`               | text primary key                          |
| `project_id`       | text, FK cascade                          |
| `run_id`           | text, FK `measurement_runs.id`, cascade   |
| `experiment_id`    | text, FK `growth_experiments.id`, cascade |
| `date`             | text                                      |
| `period`           | text enum `baseline`, `observation`       |
| `sessions`         | real                                      |
| `engaged_sessions` | real                                      |
| `key_events`       | real                                      |
| `revenue`          | real, nullable                            |
| `currency`         | text, nullable                            |

Unique on (`run_id`, `date`).

`measurement_ga4_event_totals`: `id`, `project_id`, `run_id` (FK cascade), `period`, `event_name`, `key_events`. Unique on (`run_id`, `period`, `event_name`).

Missing dates stay missing. Never store a zero for a date GA4 did not return.

**Failure isolation.** When GA4 fails, or the property changed since registration, save the Search Console part as today. Save the GA4 error on the run in a new nullable `ga4_error` column. Show "GA4 data unavailable: {reason}."

**Request accounting.** GA4 requests count in the run's `request_count`. They do not change the 5-per-day measurement allowance, because one run still counts as one measurement request.

**As built (phase 1a).**

1. Registration stays one click. A manager chooses key events afterwards, on the experiment page (**Key events**), from the key events that the property counted in the last 28 days. The choice applies from the next measurement on.
2. Each run stores the GA4 rows for the whole window it measured (baseline and observation), so the newest completed run alone describes both periods.
3. `auto_refresh` exists and defaults to true, but the page does not show the switch yet. A switch without the scheduler would promise something that does not happen; RFC-0008 adds both.

### 5.2 Supporting statements

The label rule does not change. Below the label, show GA4 statements only when the data supports them:

| Statement                              | Shown when                                         |
| -------------------------------------- | -------------------------------------------------- |
| Organic sessions changed by X%         | Both periods have all 28 dates and ≥ 100 sessions. |
| Key events changed by X%               | Both periods have ≥ 20 key events.                 |
| Key event rate changed from A% to B%   | Both of the above hold.                            |
| Revenue changed from A to B {currency} | Both periods have revenue, and ≥ 20 key events.    |

Otherwise show: "Too few sessions or events to compare."

Always show this caveat: "GA4 counts sessions that started on this page from organic search. Other pages, campaigns, tracking changes and seasonality also change these numbers."

### 5.3 Scheduled refresh

Use the RFC-0008 Trigger.dev task `measurement-refresh` (job kind `measurement_refresh`).

1. When the user starts tracking, show "Refresh measurements automatically", checked by default. Store `auto_refresh` on the experiment: boolean, default true.
2. The job is due for an experiment when all of these hold:
   - Deployment is confirmed.
   - `auto_refresh` is true.
   - The last successful run is older than 24 hours, or no run exists.
   - The final observation date plus 3 days has not passed, or the final result is not stored yet.
3. The job calls `MeasurementService.refresh` with a system actor `system:schedule`. It uses the same claim, cache and 5-per-day allowance.
4. As built: the `auto_refresh` column exists (default true). The due rule, its tests and the switch ship with the RFC-0008 job, because a rule that nothing calls would be dead code until then.
5. After the final result is stored, the job stops for that experiment.
6. A failed scheduled run follows the RFC-0008 retry rules. It never bypasses the 5-minute retry delay.

### 5.4 Long-term check (optional, phase 2)

1. On a completed experiment, offer "Check again at 90 days".
2. It measures a second observation window: days 63 to 90 after deployment, compared with the same baseline.
3. It uses the same label rules, and it shows the label as "long-term".
4. It never replaces the first result.
5. Store it as a run with `window` = `long_term`. Add the column to `measurement_runs`: text enum `primary`, `long_term`, default `primary`.
6. As built: the column is `measurement_window`, because `window` is an SQL keyword. A long-term run reads only its own window from Search Console, uses the pinned baseline, and has its own 24-hour cache. It never changes the opportunity's status. Every primary read (the detail, the list and the summary) filters to primary runs.

### 5.5 Results summary and export

1. On the Experiments list, add a summary strip: counts of encouraging, inconclusive, negative and still measuring.
2. Add a label filter to the list.
3. Add "Download CSV" on the detail page. It contains the daily Search Console rows and, when present, the daily GA4 rows, with the period of each date.
4. Build the CSV on the server from stored rows. Escape every cell.

As built (phase 1b): a result is final only when its observation window is complete; until then the experiment counts as "still measuring". The strip counts the whole project, and its counts are the label filter. The CSV has one row per date, with the Search Console and GA4 columns side by side. Text cells are quoted, and text that starts with `=`, `+`, `-`, `@`, a tab or a carriage return gets a leading apostrophe. A page path always starts with `/`, so GA4 text is the real risk. Numbers stay plain, so a negative revenue stays a number.

### 5.6 Notifications

When a final label is stored, create an RFC-0008 notification for the project's managers: "Result ready: {label} for {path}." A negative label adds "Review the page. You can prepare a revert."

## 6. Security and tenancy

1. GA4 reads use the stored, encrypted Google token through the existing service.
2. All new tables carry `project_id`. Reads check the organization in the service.
3. CSV export escapes formulas (cells that start with `=`, `+`, `-` or `@`).

## 7. Cost

GA4 and Search Console requests are free. Google quotas apply. A daily refresh uses at most 1 Search Console request and 2 GA4 requests per experiment.

## 8. Alternatives considered

1. **Label results by GA4 conversions.** Rejected. Conversion counts per page are often small, and attribution is less direct than search clicks.
2. **A synthetic control or significance test.** Deferred. One page before and after cannot support it. A future RFC can add control groups of similar pages.
3. **Merge GA4 and Search Console dates into one time zone.** Rejected. Both APIs report in fixed zones. Showing the difference is more honest.

## 9. Ready-for-other-users checklist

### Phase 1

- [x] `ga4_property_id`, `auto_refresh` on experiments, and `ga4_error` on runs, in D1 and Postgres.
- [x] `experiment_key_events`, `measurement_ga4_days` and `measurement_ga4_event_totals`, with the parity test.
- [x] Key event picker at registration, limited to 5.
- [x] Two GA4 report requests with the organic and exact landing-page filters (request-body test).
- [x] Test: missing GA4 dates stay missing.
- [x] Test: a GA4 failure keeps the Search Console result and stores `ga4_error`.
- [x] Test: a changed GA4 property fails closed for GA4 only.
- [x] Supporting statements follow the thresholds (one test per row of the table).
- [x] Label results do not change when GA4 data is added (regression test).
- [x] Results page shows GA4 numbers, the time-zone note and the caveat.
- [x] Scheduled `measurement_refresh` job through RFC-0008, with tests for each due condition. Built in RFC-0008 (`measurementRefresh.ts`, `measurementSchedule.test.ts`); it runs on the Worker cron since 2026-10-18.
- [x] Test: the job stops after the final result. `measurementSchedule.test.ts`.
- [x] Summary strip and label filter on the list.
- [x] CSV export with formula escaping (test).
- [x] Result notification through RFC-0008. Built in RFC-0008 (`result_ready`).
- [ ] Live check: one experiment on a GA4-connected project refreshes daily for 3 days without a click.
- [ ] Live check: the CSV opens in a spreadsheet with correct periods.
- [x] `content/docs/experiments.mdx` explains GA4 metrics, thresholds, time zones and automatic refresh.

### Phase 2

- [x] `measurement_runs.window` column and the long-term window.
- [x] Test: a long-term result never replaces the primary result.
- [x] Docs explain the long-term check.

## 10. Open questions

1. Should managers choose the observation length (28 or 56 days) per experiment?
2. Should revenue use `purchaseRevenue` instead of `totalRevenue` for ecommerce sites?

## 11. Real-site acceptance test

**Site:** S1, on the experiment from the RFC-0005 phase 1b test. Connect GA4 for `playbookmedia.io` first. Repeat on S2 when it has a deployed change.

**Steps:**

1. Turn on "Refresh measurements automatically". Choose one key event, for example the contact form submission.
2. Wait 3 days. Do not click refresh.
3. For one baseline week, compare Relay's daily Search Console rows with the Search Console UI (same page, same dates).
4. Compare Relay's daily GA4 sessions with a GA4 Exploration (organic search, same landing page, same dates).
5. Download the CSV and open it in a spreadsheet.
6. After the observation window ends, read the final result.

**Pass when:**

- Three scheduled refresh runs exist, one per day, with no click.
- Search Console numbers match within 1%. GA4 sessions match within 2%.
- Statements below their thresholds show "Too few sessions or events to compare". No percentage appears for thin data.
- The CSV opens with correct periods and no formula warnings.
- The final result shows the label, the caveats and the GA4 supporting numbers. A notification arrives.

**Value check:** the owner answers "Did this change help?" on one page, with numbers, limits and a next step, and without exporting data to a spreadsheet.

## 12. Completion criteria

**Accuracy**

- For 14 days, daily Search Console rows match the Search Console UI within 1%.
- For 14 days, daily GA4 sessions match a GA4 Exploration within 2%.
- Totals, CTR and impression-weighted position recomputed from the CSV in a spreadsheet match Relay's summary exactly.
- The label recomputed by hand from the CSV with the documented rules matches Relay's label.

**Honesty**

- A window with missing GA4 dates shows them as missing, never as zero.
- A thin-data experiment shows "Too few sessions or events to compare" for each statement below its threshold.
- The caveats are visible on every result. A text search of the results UI finds no causal words such as "caused" or "because of this change".
- The GA4 time zone appears next to the GA4 numbers, and the dates line up with the GA4 UI.

**Automation**

- Seven daily refreshes run in a row with no click.
- Refreshes stop after the final result.
- The result notification arrives within 1 hour of the final measurement.

**Export**

- The CSV opens correctly in Google Sheets and Excel.
- A page path that starts with `=` on staging is escaped in the CSV.

**Performance**

- The results page loads in under 1 second.

**Value**

- From the results page alone, the owner answers four questions: what changed, when it went live, what happened, and how confident the result is.

## 13. Follow-ups that do not block closing

Each follow-up names its trigger. Check it here when it passes.

- [x] Daily automatic refresh (section 5.3): the due rule with a test for each condition, the stop after the final result, and the **Refresh measurements automatically** switch. The `auto_refresh` column already exists and defaults to true. Trigger: RFC-0008 adds the scheduled job. Done: RFC-0008 built the job and the switch; the Worker cron runs it since 2026-10-18.
- [x] Result notification (section 5.6). Trigger: RFC-0008 adds notifications. Done in RFC-0008.
- [ ] Live check: one experiment on a GA4-connected project refreshes daily for 3 days without a click. Trigger: the daily refresh exists, and a project has GA4 connected and a deployed experiment. The daily refresh runs on the Worker cron since 2026-10-18 (RFC-0008), so only the GA4 connection and the experiment remain.
- [ ] Live check: the CSV opens in Google Sheets and Excel with correct periods and no formula warnings. Trigger: an experiment with at least one completed measurement.
- [ ] Accuracy checks (section 12): 14 days of Search Console and GA4 rows against their own UIs. Trigger: the same, for 14 days.

Evidence for the completion criteria that code can show:

- **Honesty:** tests prove that missing GA4 dates stay missing, and that each statement appears only above its threshold, otherwise "Too few sessions or events to compare". The caveat and the GA4 time zone show beside the GA4 numbers.
- **Isolation:** tests prove that a GA4 failure and a changed GA4 property keep the Search Console result and record the reason, and that GA4 data never changes the label.
- **Requests:** a test proves the two GA4 request bodies: organic search, exact landing page, and the chosen key events.
- **Export:** tests prove that the CSV merges Search Console and GA4 rows by date, leaves missing GA4 days empty, and escapes formula text.
- **Long-term check:** a real-SQL test on SQLite and Postgres proves that a long-term run keeps the primary result, the summary and the opportunity status.
- **Summary:** a real-SQL test on SQLite and Postgres proves the labels, the label filter and the project counts.
