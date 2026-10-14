# Experiments and results

Experiments & Results tracks one approved GitHub pull request after it is created: whether it was merged, when you confirm it reached production, and what Google Search Console reported for the changed page before and after. It is a before/after observation. It does not prove that your change caused a difference in traffic.

Nothing here runs automatically. Every GitHub check, deployment confirmation and Search Console request is an explicit action by a project owner or administrator. Loading a page makes no provider request.

## Start tracking

Open an opportunity whose [metadata proposal](GITHUB_PUBLISHING.md) created a pull request. In its execution history, choose **Track results** on the successful attempt. Registration pins that exact pull request, commit and target page and makes no external request. Choosing it again opens the existing experiment.

Tracking requires the opportunity's original Search Console property to still be connected to the project.

## Confirm the merge

Choose **Refresh GitHub status**. This is read-only. It checks the original repository, pull request number, approved head commit and branches. When GitHub reports the pull request as merged, it also reads the changed file at the merge commit and requires it to match the approved change exactly. A different repository, commit or merged file is rejected rather than recorded.

A verified merge is not proof of a deployment. Status results are reused for five minutes.

## Confirm production deployment

After a verified merge, an administrator records when this exact change reached production. Enter the actual deployment time, describe how you confirmed it, and say whether other changes or seasonal demand might affect the page. The time must be at or after the merge, not in the future, and within the last 90 days.

This is a **human attestation**. The platform does not independently verify deployments, and it does not fetch any URL you include in the note. Once saved, the deployment time and measurement windows cannot be edited. Unchecked risk boxes mean you did not identify those risks, not that none exist.

## Measurement windows

Dates use the Search Console Pacific calendar. With deployment date D:

- **Baseline:** the 28 days from D-28 through D-1.
- **Excluded:** D through D+6, a fixed seven-day allowance for search engines to process the change.
- **Observation:** the 28 days from D+7 through D+34.

Only finalized data at least three days old is requested. The observation window therefore finishes about 38 days after deployment.

## Refresh measurements

Choose **Refresh Search Console measurements**. Each refresh makes at most one Search Analytics request for the exact page, broken down by day, plus an OAuth token refresh if Google requires one. The first successful refresh saves the baseline. Later refreshes keep that baseline and add observations. Measurement keeps working after you disconnect GitHub.

Limits:

- Successful results are reused for 24 hours.
- A failed attempt can be retried after five minutes.
- A project can make at most five measurement attempts in a rolling 24 hours, including failures.
- Windows older than Search Console's 16-month history cannot be measured.

A day Search Console does not report is shown as **Unknown**, not zero. Clicks and impressions are summed. CTR is total clicks divided by total impressions, and position is weighted by impressions.

## Reading the result

Each completed refresh shows one of three descriptive labels:

- **Encouraging:** observed clicks rose by at least 20 clicks and 20%.
- **Negative:** observed clicks fell by at least 20 clicks and 20%.
- **Inconclusive:** anything else.

A directional label also requires all 28 days reported in both windows, at least 100 baseline clicks, at least 1,000 impressions in each window, and no reported other changes, seasonal risk, or another tracked deployment on the same page during the windows.

These are product thresholds, not statistical significance tests. Search demand, ranking updates and unrelated site changes can move results. A negative result recommends investigation. Revert manually through your normal process only if your review supports it. Nothing is reverted automatically.

## Permissions and limits

Members can view experiments. Only owners and administrators can register tracking, refresh GitHub status, confirm deployment or request measurements. Measurements cover Search Console clicks, impressions, CTR and position only. Conversions, revenue, scheduled measurement and automated deployment verification are not included.

Apply the paired database migrations with your normal SQLite/D1 or Postgres update procedure before using this feature.
