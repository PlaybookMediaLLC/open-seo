# Deployment-confirmed search outcome measurement

## Purpose

Follow an approved, recorded GitHub change through merge, human-confirmed production deployment, and observed Search Console performance. A pull request is not a deployment, and a before-and-after difference is not evidence of causation.

## Workflow

An administrator starts result tracking from a successful recorded pull request. Registration is idempotent per execution. Members can read project results, while the existing integration-management permission controls status refresh, deployment confirmation, and measurement requests.

A read-only GitHub refresh verifies repository identity, pull request number, original approved head commit, branch, and merge status. When merged, the file at the merge commit must still match the approved resulting blob. A merge remains distinct from a deployment. An administrator explicitly attests that the change reached production, records the actual deployment time and a note, and declares known simultaneous changes or seasonal risk. This is labeled a human attestation, not an independently verified deployment signal. No deployment, merge, rollback, or repository write occurs in this workflow.

Deployment confirmation and its actor are immutable. The existing proposal, exact approval, execution, and opportunity remain linked rather than copied into unrelated JSON records. Reconnecting credentials to the same repository and base branch permits read-only status checks without rewriting the original publishing history.

## Measurement windows and data

All reporting dates use the Search Console Pacific calendar. The baseline is the 28 complete days before the deployment date. The deployment date and the following six dates are excluded as a seven-day indexing allowance. The observation window is the subsequent 28 dates. This is a fixed operational convention, not a promise that search engines will have processed a change within seven days.

Measurement uses the existing Search Console service with an exact, case-sensitive page filter, daily grouping, web search, and finalized data. The requested end is no later than three Pacific dates before today. One request covers the combined range, which contains at most 63 dates, with a 100-row limit. The returned property, requested dates, and row bounds must match the saved experiment. No alternative canonical URLs are silently combined.

The first successful refresh captures an immutable historical baseline. Its collection time is recorded separately from the dates it describes. It is not represented as a snapshot collected before deployment. Later refreshes retain the saved baseline and append observation snapshots and run history. Missing dates remain unreported, not zero. A short or empty response is visible and cannot become a positive outcome by invention.

Totals sum clicks and impressions. CTR is total clicks divided by total impressions. Average position is weighted by impressions. Daily values and source windows remain available alongside summary metrics.

## Interpretation rules

Results have three descriptive labels: encouraging, inconclusive, or negative. They are not randomized experiment results or statistical significance claims.

A directional label requires a finished observation window, all 28 reported dates in each period, at least 100 baseline clicks, and at least 1,000 impressions in each period. Known simultaneous changes, declared seasonal risk, or another tracked deployment to the same URL in the comparison interval force an inconclusive label. Otherwise, an absolute click change of at least 20 and a relative change of at least 20 percent qualifies as encouraging or negative according to its direction. Everything else is inconclusive.

A negative observation recommends reviewing the page, demand, tracking, and other changes before considering an authorized revert. Nothing reverts automatically. Undeclared seasonality, market demand, algorithm changes, competitor activity, attribution ambiguity, and changes outside this platform remain explicit limitations even when a directional label is shown. GA4 conversions and revenue are not included in this first measurement implementation.

## Execution model

Use the existing project-scoped refresh claim rather than a new orchestration system. A measurement request reserves its allowance before provider work, has a bounded deadline, persists success or sanitized failure, and cannot commit after losing its claim or source property. Repeated successful reads use a 24-hour cache. Failed attempts have a five-minute retry delay. A project may reserve at most five measurement requests in a rolling 24-hour interval, including failed attempts. OAuth refresh requests may additionally occur in the existing connector.

The initial trigger is an explicit refresh. The durable records and idempotency rules can later support an existing scheduled worker without changing the measurement model. Automatic recurring measurement is not claimed in this version.

## Alternatives

Treating merge as deployment was rejected because many repositories do not deploy immediately, and preview environments are not production. Inferring deployment from arbitrary URL fetching was rejected because a returned page alone does not establish which commit is running. A future deployment adapter can supply stronger evidence without changing the saved measurement windows.

GA4 and revenue attribution are deferred rather than made mandatory for Search Console outcomes. A broad causal model is deferred because a single before-and-after page comparison cannot identify the effect of one SEO change. Separate experimental assignment or appropriate control groups would be needed for stronger attribution.
