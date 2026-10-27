# RFC-0040: Relay Sync — product truth and customer-facing content integrity

- **Status:** Proposed; first expansion experiment after Protect validation
- **Date:** 2026-10-27
- **Implementation position:** First new paid product: limited Relay Sync pilot
- **Dependencies:** RFC-0033–0039 (source changes through reviewer UI), plus RFC-0030–0032 base controls; reuse RFC-0017 docs, existing RFC-0005 publisher and RFC-0021 phase 0 only if it ships. The initial read-only Sync pilot needs RFC-0033–0036, not broad connector coverage.
- **Initial ICP:** B2B SaaS with GitHub-managed docs/pricing pages, recurring changes to plans/integrations/features

## 1. Product problem and promise

Software companies change pricing, feature names, integration availability and onboarding steps while public pages, docs, sales material and support guidance retain old statements. The resulting contradictions can cause lost conversions, unnecessary tickets and customer mistrust. Relay Sync monitors declared sources of product truth and customer-facing content, identifies demonstrably stale claims, prepares narrow corrections, and verifies publication.

**First promise:** “When a plan price, plan availability or integration status changes, Relay finds the affected pages we cover and supplies an evidence-backed correction for approval.” Broader screenshot, onboarding, private-support and CRM material are later adapters, not implied by the first promise.

## 2. Five supported facts and first surfaces

Begin with bounded predicates:

1. `plan.price` (currency, interval, tier, region, effective date).
2. `plan.feature_inclusion` (flag + scope).
3. `integration.availability` (enabled, beta, deprecated, disabled + cohort).
4. `api.deprecation_date` (only when authoritative OpenAPI/changelog/owner attestation exists).
5. `navigation.route` (old/new URL and verified redirect/state).

Surfaces: public pricing and feature pages, Git-backed Markdown/MDX docs, known FAQ files, supported static pages. Later: connected knowledge base, marketplace listings, product tours, sales enablement, approved screenshots. Reuse existing docs indexing and supported Markdown patch code; avoid a parallel Markdown implementation.

## 3. Workflow and state

1. Owner connects eligible source(s), marks which predicates are authoritative, and declares audience/regions/plan scopes. Initial manual fact entry is allowed with dated owner attestation.
2. GitHub change/release observation creates a **candidate product change**, not automatically verified truth.
3. RFC-0034 accepts or conflicts scoped fact versions. Sync retrieves relevant RFC-0035 claim occurrences.
4. RFC-0036 evaluates exact typed contradictions first; unresolved audience and stale provider data become review-required findings, not auto-fix targets.
5. Reviewer sees **previous assertion**, **current accepted fact**, **affected claim**, **matching scope**, **source SHA / effective date** and the safest proposed correction.
6. Relay prepares a repo-specific patch using RFC-0017 Markdown supported edits or existing bounded Next.js edit adapters. Exact source spans must still match. A separate approval creates a PR; customer merges/deploys.
7. RFC-0038 verifies actual destination text and required scope, then records `resolved_by_relay`, `resolved_externally`, `not_verified` or `superseded`. Sync report lists still-unknown and dismissed inconsistencies as well.

`reality_sync_policies`: project, authorized source family, asset set, predicate allowlist, coverage cadence, reviewer and cap. `reality_sync_findings`: project, change/fact version, claim occurrence, overlap reason, priority, decision, generation, verified resolution ID. `reality_sync_reviews`: human action/reason/expiration/overridden scope. A finding is never only a free-text LLM output.

## 4. Exact examples and scope rules

**Price:** Stripe/product configuration says Business is $49/month in the US from Nov 1; public US monthly pricing says $39. Before Nov 1 this may be future pricing, not drift. After the effective date, the US monthly claim may be contradictory. A Canadian CAD annual pricing page cannot be compared numerically without matching currency, tax, term and audience.

**Feature:** CRM integration enabled for Business beta cohort. Docs say “Available to all customers.” With a global-facing scope, mark potential contradiction; with ambiguous docs audience, request clarification. Do not publish “Business only” if a legacy cohort also receives it.

**Navigation:** UI route `/settings/billing` changes to `/settings/organization/billing`; the docs contain the old link. Verify whether the old route redirects or is still valid. If valid, this may be improvement, not broken instruction.

**API:** OpenAPI deprecates `GET /v1/contacts` after a specified date. Docs mentioning v1 aren't necessarily wrong; they may be explicitly archived/versioned. Check docs version labels before reporting drift.

## 5. Draft quality and safeguards

All generated sentences must carry exact citations to accepted fact versions or explicit `[Owner confirmation required]` placeholders. Existing RFC-0017 draft logic refuses publication while placeholders remain; preserve that rule. The model may adjust grammar and wording but cannot add unverifiable pricing, certification, guarantee or integration claims. Show a before/after diff, scope, and proposed reviewer.

Editing must preserve MDX JSX/ESM integrity, links, code samples and locale-specific conditions unless explicitly supported. After patch, parse/build and run customer preview checks when available. A stale fact, missing source mapping or changed blob SHA blocks execution rather than silently rebase a textual patch.

## 6. Product interface

- **Truth sources:** view configured authority per predicate, last successful observations, unresolved fact conflicts and effective dates.
- **Coverage:** monitored site/docs asset count and exclusions; never show “all content up to date” when only a subset is indexed.
- **Drift queue:** confirmed, needs review, missing proof, intentionally exempt, verified corrected; group by change and business consequence, not repeated sentences.
- **Fact and claim detail:** timeline, quotes, source-specific confidence, audience overlap calculation, proposed exact diff and owner.
- **Weekly report:** verified corrections, externally resolved issues, active conflicts, stale sources and estimated manual time only when grounded.

## 7. Packaging and measurement

Hypothesis to test after Protect's acceptance: a separate Sync pilot, potentially $299–$999/month depending on tracked assets and review volume. Do not set checkout entitlements before customers sign agreements; measure per-project crawl/LLM/provider costs, false confirmed drift, reviewer time, accepted corrections, weeks with real changes and actual renewal.

Useful leading metrics: `accepted_verified_fact_rate`, `monitored_claim_coverage`, `confirmed_drift_precision`, `approved_patch_rate`, `median_time_to_correct`, `facts_stale_coverage_hours`, `customer_weekly_review_hours`. Don't score success by number of AI-written pages.

## 8. Phased delivery and tests

**A — Manual + GitHub facts:** read-only plan/integration drift on 5–20 selected assets, manual review of fact authority. Acceptance: one valid contradiction and one valid difference distinguished from each other.

**B — Reviewed patch:** exact MDX/static edit tied to accepted fact version, PR preview and destination verification. Acceptance: changing the fact/source before PR creation invalidates approval.

**C — Source connectors:** optional read-only billing/flag adapter after demand and provider-specific security review; customer controls authoritative-scope configuration.

**D — Recurring drift and coverage:** daily/after-change rechecks and weekly digest, with stale source report and false-positive telemetry; no automated content publishing.

Test effective windows, currencies, grandfathered plans, preview/prod mismatch, locale variants, ambiguous prose, duplicate claims, unsupported MDX, revoked connection and intentional exception expiry. Live acceptance on authorized sites requires customer confirmation of true affected claims and actual resolution; do not count synthetic fixtures as commercial value.

## 9. Non-goals and alternatives

No hosted help-center replacement, open-ended AI documentation generation, private help-desk transcript ingestion by default, unverified screenshot scraping, or automated changes to billing prices and entitlements. Ferndesk-style documentation change awareness is useful inspiration, but Relay's differentiation hypothesis is **cross-system evidence and verified correction**, not merely article writing.
