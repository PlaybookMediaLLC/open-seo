# Opportunities

Opportunities turns your project's saved Search Console analysis into a review queue. It helps you decide which existing pages deserve investigation before preparing a website change.

**Approving an opportunity only records approval to prepare a proposal. It does not authorize a website change.** With an authorized GitHub connection, you can then prepare one supported static Next.js description change and separately approve its pull request. See [GitHub metadata proposals](GITHUB_PUBLISHING.md). After the pull request is merged and deployed, you can track Search Console results in [Experiments and results](EXPERIMENTS.md).

## Get started

1. Select the project for your website.
2. Connect its verified Google Search Console property in **Integrations**. Self-hosted users can follow [Google Search Console setup](SELF_HOSTING_GOOGLE_SEARCH_CONSOLE.md).
3. Open **Opportunities** and choose **Run detection**.
4. Open a result to inspect the affected URL, original metrics, score and uncertainty.
5. Mark the current evidence reviewed, then approve proposal preparation, reject it or defer it for seven days.

No GA4 connection, DataForSEO credit, AI model or GitHub credential is required for this workflow. Organization members can read and run analysis. Owners and administrators can record review decisions.

## What the analysis looks for

- **Striking-distance queries:** the best observed page for a query has an average position from 5 through 20 and at least 100 impressions in the current window. This is a reason to investigate relevance, the search results and the page, not an automatic recommendation to rewrite its title.
- **Declining pages:** the exact same URL appears in both windows, had at least 30 clicks previously, and lost at least 20 clicks and 30% of its clicks. A URL missing from either report is unknown, not zero.

Each run compares equal 28-day windows, ending three calendar days before the current date in Google's Pacific reporting time zone. It requests finalized web-search data. The run reads at most 1,000 rows from each of three reports and saves at most 50 opportunities.

The reports are bounded samples, not a complete site export. Search Console can omit anonymized queries and other rows. Reaching the row limit flags limited coverage and reduces the heuristic confidence. Search intent, branded-query status, seasonality and the current search-results layout are not verified. The analysis does not establish why a decline happened.

If no qualifying opportunities exist in the returned data, the result says so. It will not invent opportunities to fill the queue.

## Understand priority

The score is a review-order heuristic, not a traffic, conversion or revenue forecast:

```text
priority = round(100 × confidence × (
  0.30 × commercial relevance
  + 0.25 × observed demand
  + 0.20 × visibility opportunity
  + 0.15 × (1 - difficulty proxy)
  + 0.10 × inverse estimated effort
))
```

The detail view shows every value used. Commercial relevance comes from the page roles you saved in project context. An unknown page receives a conservative default, not an invented business classification. Demand uses observed impressions, not total keyword search volume. Average position is a difficulty proxy. Estimated effort is two hours for striking-distance investigation and four hours for decline investigation. Confidence is a fixed heuristic reflecting the available evidence, not a calibrated probability of success.

Scores are comparable within this queue. They are not the same score as the existing combined Search Console and Google Analytics opportunity report.

## Review and history

Filter by opportunity type, status or minimum priority. Sort by priority or newest discovery. Use the project selector to move between sites without combining their data.

A repeated detection updates the existing opportunity instead of duplicating it. Historical evidence and decisions remain available. Each decision records its actor, note and evidence revision. If new evidence arrives, review that evidence before approving proposal preparation. Evidence older than 14 days, or belonging to a disconnected or changed property, cannot receive a new approval.

A deferred opportunity is hidden from the default queue for seven days. Enable **Include deferred** to see it sooner. Approval records the approving user as the owner. GitHub execution records In progress or Failed from actual attempts. Creating a pull request does not mark a change Implemented, and results cannot be manually marked complete here.

## Usage and failures

A successful analysis is reused for 24 hours. Refreshing or filtering the queue reads saved results and does not run research. Each fresh analysis reserves at most three Search Console report requests, with a 90-second query deadline. The request count in run history is the reserved allowance, not a claim that every request succeeded.

Concurrent runs are blocked by a project-specific lease. If a request is interrupted, retry after the lease expires. Failed runs have a five-minute retry cooldown. Existing opportunities remain available when Google is unavailable. Partial provider failures do not publish an incomplete set of new opportunities.

The workflow makes no paid DataForSEO or AI calls. It does not add a general budget system for other OpenSEO features. Their existing usage accounting still applies.

## Self-hosting an update

Apply the database migrations for your configured backend before starting the updated application. Local D1 development uses `pnpm db:migrate:local`. Postgres uses `pnpm db:migrate:pg` with the deployment's existing database configuration. Use your established production migration and backup procedure for a deployed instance.

Detection needs no new provider secret or background orchestration service. Optional GitHub publishing requires a narrowly scoped fine-grained token and a configured application encryption secret, as described in its setup guide. Keep the existing Google OAuth configuration. Never expose `AUTH_MODE=local_noauth` to an untrusted network.
