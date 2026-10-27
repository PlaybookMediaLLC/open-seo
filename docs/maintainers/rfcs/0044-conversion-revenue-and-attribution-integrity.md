# RFC-0044: Conversion journey, revenue instrumentation, and attribution integrity

- **Status:** Proposed expansion, not a claim of validated revenue attribution
- **Date:** 2026-10-27
- **Implementation position:** Demand-gated: conversion instrumentation and revenue integrity
- **Dependencies:** RFC-0043 (bounded Protect journeys), RFC-0038 (verification); existing RFC-0012 (conversion), RFC-0016 (revenue attribution) and GSC/GA4 integrations. No inferred causal revenue attribution.

## 1. Problem and specific opportunity

A SaaS website can load correctly while lead forms, pricing destinations and conversion analytics stop reflecting actual user behavior. An operator may continue paying for acquisition campaigns without realizing conversions are misrecorded. Relay already has GA4 reporting, conversion detection and first-touch Stripe attribution code, but the complete cross-system integrity check is not established. Do not conflate accurate measurement with better performance or claim causality from a before/after chart.

Build **read-only integrity reconciliation** across configured important journeys, events and source systems. Use actual missing or inconsistent evidence to open narrowly scoped findings and, where supported, approved technical changes.

## 2. Canonical event and funnel contract

`reality_conversion_definitions`: project, name, approved event name, source (GA4, backend, CRM, billing), expected identity/join policy, environment, consent basis, expected latency and owner. `reality_conversion_observations`: aggregate counts by day/source/segment and coverage metadata; avoid storing identifiable visitor-level event trails. `reality_conversion_integrity_runs`: source health, time window, observed expected signals, comparator, sampled-check status and reason.

Explicitly separate:

1. **Functional check:** can a test user reach and submit the intended non-production conversion endpoint?
2. **Instrumentation check:** is an authorized test event seen by the configured collector, without contaminating production metrics?
3. **Reconciliation:** do aggregate backend and analytics counts agree within a documented lag/tolerance for comparable populations?
4. **Attribution:** what first-touch information is actually collected under consent and identity rules? Observed attribution is often incomplete.
5. **Causal performance:** did Relay's change improve conversion relative to an appropriate counterfactual? Usually unknown unless a designed experiment exists.

## 3. Safe checks

For lead/demo forms, first verify the destination, form controls and configured test webhook endpoint. Testing a production submit requires customer-owned safe sink, synthetic identification, cleanup and explicit approval. Never create unsolicited sales leads, book calendar slots or email a person as part of monitoring.

For checkout, verify plan identity, public amount and currency against accepted scoped fact (RFC-0034), and use provider test mode for transaction completion. Don't attempt live purchases or refund loops. Pricing display and actual billing state can legitimately differ for legacy customers: use audience-appropriate check contexts.

For pixels/tags, detect expected script/configuration in the page and test transport where the analytics provider has an explicitly safe debug mode. Report `script_present`, `test_event_observed` and `production_event_health` separately.

## 4. Reconciliation algorithm

Define comparable populations first: consent basis, timezone, reporting cutoff, inclusion criteria, dedup window, acquisition channel and conversion event version. A 20% count difference across incomparable cohorts is not a confirmed bug.

For each monitored event and complete time bucket:

- Pull bounded aggregate counts and provider health with exact dimensions.
- Reject partial pagination/truncated results and recent incomplete windows from deterministic mismatch decisions.
- Align time zones explicitly and label property/site mismatch.
- Compute `difference`, `relative_difference`, and observed coverage. Use customer-defined tolerance as a trigger, not proof of data loss.
- Recheck over a later mature window to distinguish expected reporting delay from persistent disagreement.
- Produce a diagnosis listing possible instrumentation changes or provider limits, never assert causation without direct evidence.

## 5. Product experience and repair

On Protect show “Signup works, but analytics check unknown” rather than a single green status. For an observed broken CTA or missing tag, link exact failing checkpoint, last-known-good state, suspected commit and supported proposed PR. Use RFC-0027/0037 for source edits and RFC-0028/0038 for destination verification. For analytics-only discrepancies that lack source proof, open a diagnostic ticket instead of inserting a guessed script.

The report may include organic leads, qualified leads, paid subscriptions and revenue as distinct observable metrics. Existing Stripe attribution must remain subject to connection privileges, consent, coverage gaps and its own incomplete live acceptance. A Stripe payment reference may establish a transaction, not the true acquisition source.

## 6. Risk, privacy, and scope

- No raw PII joins across CRM, analytics and Stripe without specific consent/security review. Use pseudonymous, short-lived linkage only if truly necessary and permitted; default to aggregate comparisons.
- Do not put user emails, credit card numbers, tokens or analytics client identifiers into R2 traces, screenshots or model prompts.
- Separate sandbox and production environments, and prevent test events from polluting customer reporting.
- Treat misleading tracking events as a customer-facing data quality issue, not a reason for aggressive surveillance.
- Bound data API request costs, project quotas, event volumes and retention periods.

## 7. Phases and acceptance

**A — Journey integrity:** tie up to three protected journeys to event definitions and safe synthetic checks; establish current health/unknown states.

**B — GA4 vs backend aggregate comparison:** only where customers authorize both sources and event definitions align; compute mature complete-window differences and show assumptions.

**C — Pricing/checkout assertion:** compare public plan labels and safe test-mode checkout to accepted fact versions.

**D — Commercial measurement:** link to existing experiments and Stripe attribution if eligible, while retaining causal caution.

Tests include form still visible but destination unavailable, tag present but event unobserved, GA4 delayed collection, timezone mismatch, consent suppressing events, test checkout, grandfathered price, duplicate conversion event, analytics quota error and revoked access. No synthetic live purchases or nonconsensual tracking.
