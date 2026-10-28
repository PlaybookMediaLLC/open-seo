# RFC-0026: Protected-site enrollment and recurring service

- **Status:** Phase A implemented, live acceptance pending ([IRFC-0001](implementation/0001-record-protected-site-scope-and-activation.md#completion-note)); phase B not implemented.
- **Date:** 2026-10-23
- **Updated:** 2026-10-28
- **Delivery:** Phase A is [IRFC-0001](implementation/0001-record-protected-site-scope-and-activation.md); phase B is [IRFC-0007](implementation/0007-productize-protect-work-reports-and-recurring-service.md).
- **Depends on:** Phase A has no prerequisite. Activation reuses RFC-0001, RFC-0007 isolation, RFC-0009 controls, and RFC-0019 phase 1a for the baseline and scheduled checks. Phase B requires RFC-0019 phase 1c, RFC-0027, RFC-0025 phase 1a, RFC-0028, and RFC-0018 reporting integration.

## 1. Problem and outcome

The repository has many feature flows but no protected-site record, activation state, or service health. A connected account is not necessarily a protected website. This RFC makes protection explicit and measurable before automation grows.

An owner connects an authorized website and repository, sees exactly what is protected and what is blocked, and receives a report grounded in actual checks and completed work.

## 2. Existing foundation

Reuse `projects`, `project_key_pages`, the GSC/GA4 connections, publishing connections, growth schedules, notifications, audit events, and spend controls. Research credits (`autumn.config.ts`) do not cover protected-site monitoring, and basic monitoring must not depend on them. The weekly view and work report exist under `src/server/features/work/`.

## 3. Phase A: protected-site scope and activation

1. Start with one production origin and an explicitly selected small page set, normally 5–20 pages. Record exclusions, cadence, response expectations, and support contact. A staging site is an acceptance-test target, not a substitute for agreed production coverage.
2. Detection and tickets (RFC-0019 phases 1a–1b) can run before automated repair exists. Do not claim unattended monitoring before the scheduled checks and health reporting are active.
3. Initial permissions are read-only where possible. Approval to prepare code, write the exact branch/PR, and merge is explicit. A customer's project connection alone never grants those actions.

Phase A creates the project-owned `protection_enrollments` record that phase B extends. The product stores only the scope and settings needed to run protection; it is not a CRM.

### Activation checklist

A site is active only when the relevant checks pass:

- Verified production origin and owner authorization; correct repository, root directory, base branch, and production environment when GitHub is used.
- An agreed monitored set and known-good baseline, including how existing defects and intentional non-indexable pages are handled.
- A named customer reviewer and a reachable incident/report channel, tested with their consent.
- A successful scheduled run, last/next-check visibility, failure notification, and a tested pause/disconnect path.
- The supported repair subset and customer preview/CI path documented before a repair is offered. Unsupported pages still receive monitoring/tickets if in scope.
- Search Console property and GA4 property/conversion event checked if supplied. Missing consent, access, history, or sufficient data is explicit; basic technical protection does not wait for a search-volume threshold.
- Applicable RFC-0001/0007/0009 configuration and isolation follow-ups resolved for this deployment. Record unresolved items as blocked capabilities; do not reuse historical acceptance as proof.

## 4. Phase B: productize the service

### Scope and persistence

Add a normalized project-owned `protection_entitlements` table beside `protection_enrollments`, with organization-scoped authorization. The enrollment records the production origin, agreed scope version, lifecycle (`setup`, `active`, `paused`, `ended`; `degraded` is derived from coverage, never stored), service start/end, customer reviewer, and operational readiness timestamps. The entitlement records included page count, cadence, and bounded check capacity. RFC-0019 owns monitored pages and check runs; do not duplicate those records in JSON.

An active enrollment is not a boolean shortcut for healthy coverage. Derive coverage from the required URLs and successful, fresh check runs. Keep service state and evidence of coverage separate. Add matching SQLite/Postgres schemas and migrations.

### Capacity and degraded states

1. Basic HTTP monitoring within the site's included capacity must not depend on unused research credits. Paid enrichment or rendering still follows RFC-0009 admission.
2. Define limits for page checks, confirmation retries, deployment bursts, manual checks, retention, and support. "Restores do not consume a growth-change allowance" does not mean unlimited compute or provider calls.
3. Revoked permissions, exhausted operational capacity, a paused or ended service, and unavailable providers produce visible degraded/paused coverage with an effective date and recovery action. Do not keep a green protected badge when work stopped.
4. Measure API, model, browser, compute, storage, and notification usage per site-month, so capacity limits come from real numbers.

### Reports and metrics

Extend RFC-0018's existing report with coverage and freshness, confirmed regressions, customer-reviewed dispositions, proposed/approved repairs, production-verified repairs, remaining failures, and optional later measurements. Include quiet weeks and interrupted monitoring. Report medians and distributions for alert/review/repair delays with unresolved incidents visible, not silently excluded.

Define **weekly active protected websites** as distinct enrollments with successful checks for the agreed monitored set within cadence and a current coverage/work report. Partial or overdue coverage is a separate count; a generated report alone is insufficient. Dedupe by enrollment/site and retain the scope version.

Supporting metrics: actionable-alert precision (customer-confirmed actionable findings / reviewed confirmed findings, with the unreviewed count shown), seeded regression recall, and time to verified resolution. "Clicks on affected pages" is exposure, never revenue saved.

## 5. Ready-for-other-users checklist

- [ ] Protected scope, authorization, reviewer, and support contact recorded on the enrollment.
- [ ] Activation and degraded/paused states correctly reflect missing or revoked connections and overdue checks.
- [ ] A low-traffic site can receive technical protection while analytics remains explicitly unavailable.
- [ ] Entitlements are organization/project scoped, dual-dialect, and idempotent across duplicate updates.
- [ ] Research-credit exhaustion does not disable included basic monitoring; capacity and operational stops are visible.
- [ ] Coverage/report counts reconcile to monitoring and verification records.
- [ ] Usage per site measured over four weeks on active sites.
- [ ] User documentation explains scope, permissions, limits, pausing and ending, and observed versus causal outcomes.

## 6. Acceptance and alternatives

On an authorized site, complete onboarding, a successful scheduled check, a controlled failure of the monitor, recovery, a customer-reviewed incident, and a weekly report. Separately test another organization's access, duplicate entitlement updates, ending the service, and reconnection on staging. Pass only if failed or stale coverage is visible and every reported completion links to its evidence.

Reusing research credits as the protected-site allowance is rejected: monitoring capacity and research spend are different budgets. Universal monitoring and unlimited repairs are out of scope.
