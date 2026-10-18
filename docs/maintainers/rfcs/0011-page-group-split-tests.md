# RFC-0011: Page-group split tests

- **Status:** In progress. Part A (the five tables and the statistics module, checked against a reference script and by simulation) part B (eligibility, assignment, the Split tests section and the assignment view) part C (the pull request, its diff check and the deployment confirmation) part D (live verification, the daily refresh, analysis runs and the harm notice) and part E (the end actions, the chart, the CSV export and the docs) built.
- **Date:** 2026-10-15
- **Brief section:** 7 (Feature E), extended from before-and-after comparison to controlled tests
- **Depends on:** RFC-0005 (publishing, deployment signals), RFC-0006 (measurement), RFC-0008 (scheduled refresh). Phase 2 drafting depends on RFC-0004.

## 1. Summary

RFC-0006 compares one page before and after a change. That shows what happened, but not what the change caused, because seasonality, algorithm updates and demand move at the same time. Controlled SEO tests solve this by changing a random half of similar pages and comparing them with the other half. Today this costs enterprise money (SearchPilot, SplitSignal).

Relay already writes changes as code. This RFC uses that to run page-group split tests at a self-serve price: Relay assigns similar pages to two balanced groups, opens a pull request that applies a change to one group only, checks the live site, and estimates the effect with an exact randomization test on Search Console data.

## 2. What exists today

| Part                  | Location                                               | Use in this RFC                                                                     |
| --------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Measurement           | `MeasurementService`, `measurement_days`               | Pacific calendar, final data, missing dates stay missing.                           |
| Windows and labels    | `docs/maintainers/specs/search-outcome-measurement.md` | Exclusion of 7 indexing days. Descriptive labels and caveats.                       |
| Publishing            | RFC-0005                                               | Exact-change approval, pull requests, deployment signals, metadata helper analysis. |
| Live checks           | RFC-0005 live content signal, `readPages`              | Fetch and compare the live title and description.                                   |
| Scheduling            | RFC-0008                                               | Daily refresh tasks.                                                                |
| Search Console client | `GscService`                                           | Page-level daily data with a page filter.                                           |

## 3. Goals

1. Estimate the causal effect of one template change on clicks, with an interval and a p-value.
2. Refuse tests that are too small to detect a useful effect, and say why.
3. Keep assignment random, balanced, reproducible and stored.
4. Prove on the live site that only the variant pages changed.
5. Stop a harmful test early, and never claim a win early.
6. Apply the winner, or remove the test, through a reviewed pull request.

## 4. Non-goals

1. No user-level split testing. Search engines must see one version per page.
2. No tests on fewer than 30 pages.
3. No multi-variant tests. One variant against one control.
4. No automatic rollout.

## 5. Design

### 5.1 Phases

| Phase | Delivers                                                                                                                                                           |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | Eligibility and power check, balanced assignment, split files by pull request (a developer writes the variant expression), live verification, analysis and labels. |
| 2     | Relay drafts the variant expression for simple title and description patterns, with an AST check.                                                                  |
| 3     | Secondary metrics from GA4, and a backtest library that reports the test's past false-positive rate on the customer's own data.                                    |

### 5.2 Eligibility

A test needs a group of pages that share one template.

1. The owner gives a page pattern, for example `^/integrations/[^/]+$`.
2. Relay lists matching pages from Search Console (one request: dimensions `page`, regex filter, 56 days).
3. Relay confirms the shared template. Every page must map to the same route file (a dynamic segment) or the same metadata helper (RFC-0005 phase 1a). Otherwise it refuses with the list of templates found.
4. Requirements:
   - At least 30 pages with at least 1 click in the 56-day baseline. At most 200 pages.
   - At least 1,000 clicks in total over the 56-day baseline.
   - A minimum detectable effect (MDE) of 15% or less, at 80% power and a two-sided 90% interval (see 5.5).
5. Show the result in plain words. Example: "This group can detect a change of 11% or more. Smaller effects will show as inconclusive." When the group fails, show which requirement failed and by how much.

**As built (part B).** The one Search Console request uses the dimensions `page` and `date`, so the same rows give the 56-day totals and the two 28-day halves of the pre-period check. Relay's client filters with `contains`, so the request asks for the literal start of the pattern, such as `/integrations/`, and Relay applies the full pattern to each path. An ineligible group creates nothing and returns each failed requirement, as the S1 acceptance step expects; the `ineligible` status stays unused. The template check reads the repository tree once and maps each path to the most specific App Router or Pages Router page file. The metadata-helper case (separate static files that share one helper) is not built yet. The original title and description of each page are captured when the test is created, 8 pages at a time. Seeds stay below 2^31 so both databases store them as an integer.

### 5.3 Assignment

1. Sort the pages by baseline clicks.
2. Pair neighbours: pages 1 and 2, 3 and 4, and so on. Drop the last page when the count is odd.
3. In each pair, assign one page to `variant` and one to `control` with a seeded random draw. Store the seed.
4. Check balance: the baseline click totals of the two groups differ by less than 5%, and the pre-period test in 5.5 has p > 0.2. If not, draw again with a new seed, at most 20 times.
5. Store every page with its pair index and group. Assignment never changes after the pull request opens.
6. Capture each page's live title and description at this time, as the "original" values for verification.

### 5.4 Change by pull request

Relay opens one pull request with two generated files under the app root:

1. `relay-split/{testId}.json`: the test id and the sorted list of variant paths.
2. `relay-split/index.ts`:

   ```ts
   import variants from "./{testId}.json";
   const paths = new Set<string>(variants.paths);
   export function inSplitVariant(path: string): boolean {
     return paths.has(path);
   }
   ```

   It reads a static file. It uses no cookies, headers, network or randomness at request time, so a search engine always sees the same version of a page.

The pull request description tells the developer the one edit to make in the template, for example:

```ts
title: inSplitVariant(`/integrations/${params.slug}`)
  ? `${integration.name} integration for Conduitt`
  : integration.title,
```

**Phase 1:** the developer writes this edit in the same pull request. Relay checks the final diff before approval:

- Only the generated files and the one template file changed.
- The template file imports `inSplitVariant` and calls it only inside the metadata object.

**Phase 2:** Relay drafts the variant expression for simple patterns (a fixed suffix, a prefix, or a field swap), with the RFC-0004 checks, and edits only the targeted property in the AST.

The same exact-change approval and execution rules from RFC-0005 apply.

**As built (part C).** "Review pull request" shows the exact files and the description; "Approve and open" sends their hash, and Relay refuses to write when the files changed since the review. Relay creates the branch `relay/split-test-{id}`, adds both files, opens the pull request and records `split_test.pr_opened` with the hash. The description names the template, the import path from its folder and the page path built from its dynamic segments. "Check pull request" reads the pull request's files and its head: only the two files and the template may change, the variant list must equal the stored assignment, and every use of `inSplitVariant` must sit inside the `metadata` export or `generateMetadata`. The check covers App Router templates. The result is kept with the head SHA. "Confirm deployment" needs a merged pull request whose merged head passed the last check, then takes GitHub's successful production deployment of the merge commit, or the owner's attestation when GitHub reports none. It records `split_test.deployment_confirmed` and sets the windows: the deployment day and the next 6 days are excluded, and the observation covers the next 28 days.

### 5.5 Analysis

**Data.** One Search Console request per refresh: dimensions `date` and `page`, the page regex filter, final data, the Pacific calendar. Store daily clicks, impressions and position per page.

**Windows.**

- Baseline: the 56 days before deployment.
- Excluded: the deployment day and the next 6 days.
- Observation: the next 28 days. The owner can extend it to 56 days before it starts.

**Estimate.**

1. For each page, compute `g = ln(1 + observation clicks per day) − ln(1 + baseline clicks per day)`.
2. For each pair, compute `d = g(variant) − g(control)`.
3. The effect estimate is the mean of `d` over pairs. Report it as a percentage: `exp(mean d) − 1`.

**Uncertainty.** Use an exact randomization test that matches the design:

1. Under no effect, the sign of each `d` is equally likely to be positive or negative.
2. Draw 10,000 random sign patterns with a fixed seed. Compute the mean of `d` for each.
3. The two-sided p-value is the share of draws whose absolute mean is at least the observed absolute mean.
4. Find the 90% interval by inverting the test: the range of effects `δ` (on the log scale) for which the test of `d − δ` has p > 0.10. Convert both ends to percentages with `exp(δ) − 1`.

**Pre-period check.** Run the same test on the baseline only, comparing its first 28 days with its last 28 days. A p-value at or below 0.2 shows an imbalance. Mark the result "imbalanced", and do not label it positive or negative.

**Minimum detectable effect.** From the baseline, estimate the standard deviation `s` of `d` with the pre-period split. Then `MDE ≈ exp((1.645 + 0.842) × s / √pairs) − 1`.

**Labels.**

| Label        | Rule                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| Positive     | The observation window is complete, the pre-period check passed, and the whole 90% interval is above 0. |
| Negative     | The whole 90% interval is below 0.                                                                      |
| Inconclusive | Anything else.                                                                                          |

**Early stop for harm only.** After 14 observation days, if the estimate is −10% or worse and the one-sided p-value for harm is below 0.05, notify the owner and offer a removal pull request. A positive label is never given before the window ends.

**As built (part A).** `splitStats.ts` holds the pure functions, and `scripts/split-test-reference.py` reproduces them with the same seeded generator (mulberry32). Each generator output gives 32 signs, bit by bit, so 10,000 draws stay fast. The p-value at any δ reuses the same draws, because each draw's mean of `d − δ` is `a − δ·b`. The balance check measures the click gap against the mean of the two group totals. Two changes to the MDE keep "can detect" true for 15 to 100 pairs, because the plain formula gave 73% to 79% power in simulation: t quantiles replace 1.645 and 0.842, and the spread is its 80% upper confidence bound. With them, an effect equal to the reported MDE is labeled positive in 82% to 87% of simulated runs. The four child tables also carry `project_id`, so every query stays scoped to its project.

**Wording.** Results say "estimated effect", show the interval, and list the limits: Search Console data only, internal links and cannibalization between groups, and other changes to only one group.

### 5.6 Live verification

1. After the deployment is confirmed (RFC-0005 signals or attestation), fetch every test page on production.
2. A variant page passes when its changed field differs from its original value. A control page passes when its value equals the original.
3. Store each check. The test starts only when at least 95% of pages pass. Otherwise show the failing pages and stop.
4. Check again on days 7 and 21 of the observation window. A drift above 5% marks the result "contaminated".

**As built (part D).** Split tests refresh in the daily RFC-0008 `measurement_refresh` job, and an owner can run the same step with "Verify now" or "Refresh now". A test in `verifying` fetches every page 8 at a time and starts when at least 95% pass; otherwise it lists the failing pages and stays in `verifying`. A running test checks again on observation days 7 and 21, once each, and a failure rate above 5% sets `contaminated`. A field of type `other` cannot be read, so its verification is skipped and the results page says so. Each refresh stores the final days after the last stored one (one Search Console request), then stores an analysis row with its label and notes (`interim`, `imbalanced`, `contaminated`). Days without a row count as zero clicks. An interval end that the pairs cannot bound is stored empty. A harmful interim estimate notifies the project once; a finished window concludes the test and notifies its label.

### 5.7 Ending a test

1. **Positive:** "Apply to all pages" opens a pull request that removes `inSplitVariant` and keeps the variant expression.
2. **Negative or stopped:** "Remove test" opens a pull request that removes the split files and the variant branch.
3. **Inconclusive:** offer both, and say that no effect larger than the MDE was found.
4. Every option uses the exact-change approval.

**As built (part E).** Each end action reads the template at the head of the base branch and rewrites it from its syntax tree: every `inSplitVariant(...) ? variant : current` keeps the variant ("Apply to all pages") or the current value ("Remove test"), and the import goes. Any other use of the helper is refused with a request to finish the change by hand. The pull request also deletes both split files, so no split code is left after the merge. The owner approves the hash of the exact change; Relay records `split_test.ended`. "Apply to all pages" is offered only after the window ends without a negative label; "Remove test" at any time after the deployment, which also covers the early harm stop. Removing a running test sets it to `stopped`.

### 5.8 Data model

| Table                      | Columns                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `split_tests`              | `id`, `project_id` (FK cascade), `opportunity_id` (nullable), `name`, `hypothesis`, `field` (`title`, `description`, `other`), `page_pattern`, `status` (`draft`, `ineligible`, `eligible`, `awaiting_deploy`, `verifying`, `running`, `stopped`, `concluded`), `seed`, `pairs`, `mde_pct`, `baseline_start`, `baseline_end`, `deployed_at`, `deployment_basis`, `observation_start`, `observation_end`, `proposal_id` (nullable FK), `created_by`, `created_at` |
| `split_test_pages`         | `id`, `test_id` (FK cascade), `path`, `pair_index`, `bucket` (`variant`, `control`), `baseline_clicks`, `baseline_impressions`, `original_title`, `original_description`                                                                                                                                                                                                                                                                                         |
| `split_test_days`          | `id`, `test_id` (FK cascade), `path`, `date`, `clicks`, `impressions`, `position`                                                                                                                                                                                                                                                                                                                                                                                |
| `split_test_verifications` | `id`, `test_id` (FK cascade), `path`, `checked_at`, `expected` (`changed`, `unchanged`), `observed_value`, `passed`                                                                                                                                                                                                                                                                                                                                              |
| `split_test_analyses`      | `id`, `test_id` (FK cascade), `run_at`, `observation_days`, `estimate_pct`, `ci_low_pct`, `ci_high_pct`, `p_value`, `pre_period_p_value`, `label`, `notes`                                                                                                                                                                                                                                                                                                       |

Unique on `split_test_pages` (`test_id`, `path`) and `split_test_days` (`test_id`, `path`, `date`). A 200-page test with 91 days stores at most 18,200 day rows.

### 5.9 User interface

1. Experiments & Results gets a **Split tests** tab.
2. "New split test": pattern, field and hypothesis, then the eligibility result with the MDE in plain words.
3. Assignment view: both groups with their baseline totals and the balance result.
4. Test page: status, verification results, a chart of the variant and control groups (indexed to 100 at the baseline), the current estimate with its interval (marked "interim" before the window ends), and the limits.
5. End actions from 5.7.

**As built (parts B to E).** The Split tests section sits at the top of Experiments & Results rather than in a separate tab. The test page shows the results first, then the end actions, the pull request and the groups. The chart shows each group's daily clicks as a 7-day average, indexed to the group's baseline mean. "Download CSV" gives one row per pair (`variant`, `control`, `d`, `pre_d`, `seed`), which `scripts/split-test-reference.py` reads.

## 6. Security and integrity

1. The split helper has no request-time input except the path, so it cannot cloak content.
2. Generated files contain paths only.
3. Assignment and seeds are stored and shown, so anyone can reproduce the analysis.
4. All repository writes use the RFC-0005 exact-change approval.

## 7. Cost

Free providers only. One Search Console request per daily refresh. Live verification fetches each test page 3 times over the test.

## 8. Alternatives considered

1. **Before-and-after on many pages.** It cannot separate the change from seasonality or updates.
2. **Causal-impact time-series models with no control group.** They depend on model assumptions that are hard to check for one site.
3. **Bootstrap intervals.** Rejected for small pair counts. The paired randomization test is exact for this design.
4. **Assignment by hash at request time.** Rejected. A stored list is reviewable and cannot change between deployments.

## 9. Ready-for-other-users checklist

### Phase 1

- [x] Five tables with D1 and Postgres migrations and the parity test.
- [x] Eligibility: pattern listing, shared-template check, the three thresholds and the MDE (tests with fixtures at each boundary). The shared-template check covers one route file; the metadata-helper case is open.
- [x] Assignment: pairing, seeded draw, balance check and re-draw limit (tests prove reproducibility from the seed).
- [x] Generated files and the pull request description with the template instruction.
- [x] Diff check: only the allowed files changed, and `inSplitVariant` is called only inside the metadata object (tests).
- [x] Live verification at start, day 7 and day 21, with the 95% start rule and the 5% drift rule (tests).
- [x] Analysis: estimate, randomization p-value, inverted interval, pre-period check and labels. Test against a reference implementation in a notebook on fixed data, with matching results. The reference is `scripts/split-test-reference.py`; 5 fixed datasets match to 2 decimal places.
- [x] Simulation test: on synthetic data with no effect, the 90% interval excludes 0 in 8% to 12% of 1,000 runs.
- [x] Simulation test: a true +15% effect on an eligible design is labeled positive in at least 80% of runs.
- [x] Early harm stop with notification and the removal pull request.
- [x] End actions with exact-change approval.
- [x] Daily refresh through an RFC-0008 task. It runs in `measurement_refresh`, which needs the RFC-0008 Trigger.dev account; "Refresh now" runs the same step by hand.
- [x] Split tests tab, chart and result wording with limits. Built as a section of Experiments & Results.
- [x] `content/docs/split-tests.mdx` explains eligibility, MDE, labels and limits in plain words.

### Phase 2

- [ ] Drafted variant expressions for suffix, prefix and field swap patterns.
- [ ] AST check that only the targeted property changed (tests).

### Phase 3

- [ ] GA4 sessions and key events as secondary metrics, without changing the label rule.
- [ ] Backtest report: the test's false-positive rate on the customer's own historical data.

## 10. Real-site acceptance test

### Phase 1a: refusal and statistics on real data (no site change)

**Sites:** S1 for refusal. The own site with the largest template group for the backtest (check S4's `[industry]` and `[product]` pages, and S2).

**Steps:**

1. Create a split test on S1 for `^/[a-z-]+$`.
2. On the largest own template group, run 200 A/A backtests on real historical data: random assignments with no change, with the analysis run on past dates.
3. On the same group, run 200 backtests with a synthetic +15% lift added to the variant pages' observation clicks.

**Pass when:**

- S1 is refused, with the reason (9 pages, fewer than 30) and no test created.
- The A/A backtests show a false-positive rate (interval excludes 0) of at most 12%.
- When the group is eligible, the synthetic lift is labeled positive in at least 80% of backtests. When it is not eligible, Relay refuses it with the MDE.

**Value check:** the owner can trust that a "positive" label is not noise, measured on their own data.

### Phase 1b: a live test

**Site:** an own or partner site with an eligible template group. Get the site owner's written approval.

**Steps:**

1. Choose a title pattern change for the group. Create the test. Review the assignment.
2. Approve the pull request. Merge and deploy it.
3. Wait for verification. Let the test run its 28-day window.
4. Recompute the estimate, the p-value and the interval from the CSV export with the reference notebook.
5. Apply the winner, or remove the test, through the offered pull request.

**Pass when:**

- Verification passes on at least 95% of pages at start, day 7 and day 21.
- The recomputed numbers match Relay's to 2 decimal places.
- The result page shows the label, the interval, the MDE and the limits.
- The ending pull request leaves no split code in the repository.

**Value check:** the owner knows whether a template change caused more clicks, with an interval, at a self-serve price.

## 11. Completion criteria

**Statistics**

- The randomization test, interval and MDE match a reference implementation to 2 decimal places on 5 fixed datasets.
- False-positive rate between 8% and 12% in 1,000 simulated A/A runs, and at most 12% in 200 backtests on real data.
- Power of at least 80% for an effect equal to the reported MDE in simulation.
- A positive label never appears before the observation window ends (test).

**Integrity**

- The same seed always gives the same assignment.
- No page changes group after the pull request opens (test).
- The split helper code contains no request-time input other than the path (code check in review).
- Live verification catches a page that was changed outside the variant group (seeded staging test).

**Honesty**

- Every ineligible group gets the failed requirement and the gap in numbers.
- Every result shows its interval, its MDE and its limits. A search of the UI finds no causal wording outside "estimated effect".

**Usability**

- The owner sets up a test from pattern to approved pull request in under 15 minutes.
- A developer makes the template edit from the pull request instructions alone, with no question.

**Value**

- At least one live test concludes on a real site, and the owner applies or removes the change based on the result.
