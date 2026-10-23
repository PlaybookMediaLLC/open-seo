# RFC-0026: Protected-site pilots and recurring service

- **Status:** Proposed; no pilot, pricing, or renewal outcome is claimed.
- **Date:** 2026-10-23
- **Delivery:** Stage 0 (phase A), stage 3 (phase B) in the [delivery plan](README.md).
- **Depends on:** Phase A discovery has no engineering prerequisite. Activation reuses RFC-0001, RFC-0007 isolation, RFC-0009 controls, and the completed slice of RFC-0019 being sold. Phase B requires RFC-0019 phase 1c, RFC-0027, RFC-0025 phase 1a, RFC-0028, and RFC-0018 reporting integration.

## 1. Problem and outcome

The repository has research billing and many feature flows, but no protected-site service contract, activation record, or evidence of repeat paid demand. A connected account is not necessarily a protected website. This RFC makes the initial offer explicit and measurable before scaling automation.

A qualified customer agrees to a bounded pilot, connects an authorized website and repository, sees exactly what is protected and what is blocked, and receives a report grounded in actual checks and completed work. Payment, renewal, and delivery economics are measured separately from engineering acceptance.

## 2. Existing foundation

Reuse `projects`, `project_key_pages`, the GSC/GA4 connections, publishing connections, growth schedules, notifications, audit events, and spend controls. `autumn.config.ts` defines free and $10/month research plans plus credits; it does not define protected-site subscriptions. The weekly view and work report exist under `src/server/features/work/`.

## 3. Phase A: discovery and an assisted pilot

1. Interview 15–20 qualified B2B SaaS buyers/operators about actual release incidents, response ownership, existing spend, buying authority, and permission objections.
2. Seek three paid pilots. Record the agreed price, scope, duration, payment reference, success criteria, and permitted operations. $79–$149/site/month is a test range, not a default checkout price.
3. Start with one production origin and an explicitly selected small page set, normally 5–20 pages. Record exclusions, cadence, response expectations, and support contact. A staging site is an acceptance-test target, not a substitute for agreed production coverage.
4. A detection-and-ticket pilot may use RFC-0019 phases 1a–1b before automated repair exists. Disclose assisted work. Do not claim unattended monitoring before the scheduled checks and health reporting are active.
5. Initial permissions are read-only where possible. Approval to prepare code, write the exact branch/PR, and merge is explicit. A customer's project connection alone never grants those actions.

Commercial records may initially live in the team's existing private sales system. The product only needs the activation scope and entitlement required to enforce the pilot. Do not build a CRM or store interview transcripts in public repository docs.

### Activation checklist

A site is active only when the relevant checks pass:

- Verified production origin and owner authorization; correct repository, root directory, base branch, and production environment when GitHub is used.
- An agreed monitored set and known-good baseline, including how existing defects and intentional non-indexable pages are handled.
- A named customer reviewer and a reachable incident/report channel, tested with their consent.
- A successful scheduled run, last/next-check visibility, failure notification, and a tested pause/disconnect path.
- The supported repair subset and customer preview/CI path documented before a repair is offered. Unsupported pages still receive monitoring/tickets if in scope.
- Search Console property and GA4 property/conversion event checked if supplied. Missing consent, access, history, or sufficient data is explicit; basic technical protection does not wait for a search-volume threshold.
- Applicable RFC-0001/0007/0009 configuration and isolation follow-ups resolved for this deployment. Record unresolved items as blocked capabilities; do not reuse historical acceptance as proof.

## 4. Phase B: productize the service after evidence

### Scope and persistence

Add normalized project-owned `protection_enrollments` and `protection_entitlements` with organization-scoped authorization. The enrollment records the production origin, agreed scope version, lifecycle (`setup`, `active`, `degraded`, `paused`, `ended`), service start/end, customer reviewer, and operational readiness timestamps. The entitlement records included page count, cadence, bounded check capacity, and the billing reference. RFC-0019 owns monitored pages and check runs; do not duplicate those records in JSON.

An active enrollment is not a boolean shortcut for healthy coverage. Derive coverage from the required URLs and successful, fresh check runs. Keep billing state, service state, and evidence of coverage separate. Add matching SQLite/Postgres schemas and migrations.

### Packaging and costs

1. Confirm a pilot price through purchasing behavior before creating new Autumn products. Reuse existing billing-account and webhook flows; process entitlement changes idempotently.
2. Show scope, included checks, repair policy, additional research/rendering costs, and renewal/cancellation terms before activation. One-time onboarding cleanup is optional and requires separate validation.
3. Basic HTTP monitoring within the active plan's included capacity must not depend on unused research credits. Paid enrichment or rendering still follows RFC-0009 admission.
4. Define limits for page checks, confirmation retries, deployment bursts, manual checks, retention, and support. “Restores do not consume a growth-change allowance” does not mean unlimited compute or provider calls.
5. Payment failure, cancellation, revoked permissions, exhausted operational capacity, and unavailable providers produce visible degraded/paused coverage with an effective date and recovery action. Do not keep a green protected badge when work stopped.
6. Measure API, model, browser, compute, storage, notification, and support costs per site-month. Report gross margin with a stated treatment of support labor. Do not infer profitability from provider markup alone.

### Reports and metrics

Extend RFC-0018's existing report with coverage and freshness, confirmed regressions, customer-reviewed dispositions, proposed/approved repairs, production-verified repairs, remaining failures, and optional later measurements. Include quiet weeks and interrupted monitoring. Report medians and distributions for alert/review/repair delays with unresolved incidents visible, not silently excluded.

Define **weekly active protected paying websites** as distinct paid enrollments with successful checks for the agreed monitored set within cadence and a current coverage/work report. Partial or overdue coverage is a separate count; a generated report alone is insufficient. Dedupe by enrollment/site, retain the scope version, and distinguish an actual paid invoice from a promise to pay.

Supporting metrics: activation-to-payment, actionable-alert precision (customer-confirmed actionable findings / reviewed confirmed findings, with the unreviewed count shown), seeded regression recall, time to verified resolution, renewal among invoices actually due, revenue per site, acquisition cost, support effort, and gross margin. “Clicks on affected pages” is exposure, never revenue saved.

## 5. Exit gates and decisions

| Gate                     | Evidence                                                                                                                                          | Decision                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Days 1–14 of the program | 15–20 interviews and three paid restricted pilots, or recorded failure to recruit them                                                            | Continue the narrow service or revise the offer.                                                    |
| Days 15–30               | Agreed pages protected, reproducible findings, operational health visible, customer response owner                                                | Admit supported sites to active protection.                                                         |
| Days 31–60               | Two approved repairs across separate customer organizations, deployed and verified under RFC-0028; reviewed false alerts, costs, and support time | Decide whether repair delivery is repeatable. Own-site seeded tests alone do not satisfy this gate. |
| Days 61–90               | Target 8–10 paying sites; actual renewals where due and stated intent separately; service economics                                               | Decide whether to expand. These are hypotheses, not accomplished milestones.                        |

Calendar targets do not waive engineering acceptance. If customers will not pay or authorize the necessary workflow, stop increasing autonomy and revisit the thesis. A small sample with zero false alerts is not proof of a population-wide zero false-positive rate.

## 6. Ready-for-other-users checklist

- [ ] Pilot scope, authorization, payment evidence, reviewer, and success criteria recorded privately.
- [ ] Activation and degraded/paused states correctly reflect missing or revoked connections and overdue checks.
- [ ] A low-traffic site can receive technical protection while analytics remains explicitly unavailable.
- [ ] Entitlements are organization/project scoped, dual-dialect, and idempotent across duplicate billing events.
- [ ] Research-credit exhaustion does not disable included basic monitoring; plan and operational stops are visible.
- [ ] Coverage/report counts reconcile to monitoring and verification records; payment/renewal denominators are explicit.
- [ ] Costs and support effort measured over four weeks on active pilots.
- [ ] User documentation explains scope, permissions, limits, cancellation, and observed versus causal outcomes.

## 7. Acceptance and alternatives

On an authorized pilot, complete onboarding, a successful scheduled check, a controlled failure of the monitor, recovery, a customer-reviewed incident, and a weekly report. Separately test another organization's access, duplicate entitlement events, cancellation, and reconnection on staging. Pass only if failed or stale coverage is visible and every reported completion links to its evidence.

A concierge pilot is preferred to building a self-serve billing funnel before demand is known. Reusing research plans as proof of release-assurance demand is rejected: the promise, price, costs, and renewal decision are different. Universal monitoring and unlimited repairs are out of scope.
