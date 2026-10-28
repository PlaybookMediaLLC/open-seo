# RFC-0019: Production monitoring and confirmed release regressions

- **Status:** Draft; durable monitoring and regression records are not implemented as of the October 23 audit.
- **Date:** 2026-10-15
- **Updated:** 2026-10-23
- **Delivery:** Stage 1 for observation/detection; stage 2 for reviewed repair integration.
- **Depends on:** Phase 1a uses RFC-0005 repository/deployment reads, RFC-0008 jobs, RFC-0009 controls, RFC-0010/0015 rules, and the protected-site scope from RFC-0026 phase A. Phase 1b adds confirmed incidents. Phase 1c uses RFC-0027, RFC-0025 phase 1a, and RFC-0028. The RFC-0018 report consumes results; standing approvals are not a prerequisite.

## 1. Summary

Monitor the production pages a customer has agreed to protect, retain their known-good state, and confirm consequential regressions before alerting. Explain the before/after evidence, affected pages, suspected source, and next action. Detection and actionable tickets are the first useful increment. Source-proven, human-reviewed repairs and production verification follow through separate RFCs.

This is the initial release-assurance product in [company.md](../../../company.md). Ongoing campaigns and autonomous execution come after the reviewed repair loop works, not before.

## 2. What exists today

| Foundation               | Evidence                                                                                    | Boundary                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| CI checks and page facts | `src/server/features/seo-checks/pageSnapshot.ts`, `seoRules.ts`, `seoCheckRun.ts`           | Compare production/preview during a check; no durable known-good production history.                                                         |
| Deployment reads         | `src/server/features/publishing/githubSignals.ts`, `experiments/DeploymentSignalService.ts` | Existing checks cover registered experiments. Monitoring must discover all relevant production deployments, including changes outside Relay. |
| Jobs and notifications   | `src/server/features/growth/growthJobs.ts`, `cronScheduler.ts`                              | Worker cron dispatches at quarter-hour ticks; there is no release-monitor job. Trigger.dev is an optional existing path, not a prerequisite. |
| Publishing               | RFC-0005, `MetadataExecutionService`                                                        | Exact-change approval exists; incident evidence and restoration from a snapshot require RFC-0027.                                            |
| Work report              | RFC-0018                                                                                    | Existing weekly/report surfaces can consume incidents and verified resolutions.                                                              |

The proposed `monitored_pages`, `page_snapshots`, `site_snapshots`, and `site_regressions` below are new work. Standing-approval policies are also future work, owned by RFC-0018.

## 3. Phases and independently useful exits

| Phase | Delivers                                                                                                                          | Exit                                                                                                  |
| ----- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1a    | Enrolled scope, durable observations, known-good baseline, schedule and health view                                               | Customer can see which pages are protected and when checks succeeded; no alert or repair promise yet. |
| 1b    | Deployment/daily checks, shared comparison rules, confirmations, deduplicated incidents, cause evidence, notification and tickets | A confirmed regression is actionable even without an automatic repair.                                |
| 1c    | RFC-0027 reviewed metadata repairs, RFC-0025 customer previews, RFC-0028 verification                                             | Approved repair reaches production and the original failure is verified resolved.                     |
| 2     | Verified adapters for canonical/robots literals and static `robots.txt`; webhook improvements where needed                        | Each new repair class passes its own source, preview, and verification acceptance.                    |
| 3     | Rendered production checks and response-time signals                                                                              | Affordable runtime and explicit unknown states.                                                       |

No full-site crawl, CMS writes, whole-commit rollback, autonomous merge, or Relay-controlled production deployment. The site audit and customer's release process retain those roles.

## 4. Protected set and baseline

Use explicit owner-selected key pages first, normally 5–20 per site, bounded by the site's agreed scope (RFC-0026). Suggest top organic landing pages from existing Search Console data when available; missing history does not prevent protection. Include relevant `robots.txt` and sitemap checks, accounted for in capacity. Show excluded or unsupported pages and why. Changes to the protected set are visible and auditable.

`monitored_pages` stores project, normalized URL path, selection reason, scope version, added/removed times, and a nullable known-good snapshot reference. Enforce one active row per project/path. Record site resources separately where appropriate. Keep all relations normalized and compatible with SQLite and Postgres.

Known-good is a guarded baseline, not simply the latest fetched page:

1. The first candidate must be readable, have the expected status, and pass applicable absolute checks. Review existing defects and intentional exclusions with the owner; a successful HTTP request alone cannot certify a healthy page.
2. For initial activation, require a matching confirmation and explicit acceptance of the baseline/scope. Preserve who accepted it and its provenance.
3. Later candidates can promote only after at least 24 hours with a matching confirmation, no unresolved material finding, and applicable rule checks passing. An intentional change can instead be explicitly accepted by an authorized manager.
4. A verified repair can promote only through RFC-0028's conditional verification path. Old jobs cannot overwrite a newer baseline or incident.
5. Material warnings about changed values remain available for review; do not silently overwrite the prior baseline while those findings are unresolved.

A production deployment SHA is nullable. It is verified source provenance only when evidence establishes that association; observing an event near a fetch is not sufficient. RFC-0027 owns the source mapping needed for repair.

## 5. Observations, runs, and retention

`monitor_runs` records project/scope version, trigger (`schedule`, `deployment`, `confirmation`, `manual`, `verification`), scheduled/start/finish times, status, required/checked/unknown page counts, and a bounded error. A missing or overdue run is visible coverage loss.

`page_snapshots` records the monitored-page/run references, fetch time, URL/final path, HTTP status when received, title/description/canonical/robots/header/H1 facts, JSON-LD validity/types, content/hreflang hashes, link and word counts, response time, and fetch/render completeness. Use normalized child rows for repeated structured facts; keep scalar values bounded, never full pages. Timeouts are `unknown`, not invented status codes. Preserve enough evidence for the comparison and repair decision; truncation of a required value must make that rule uncheckable rather than silently change it.

`site_snapshots` records robot-policy and sitemap observations, their completeness, counts/hashes, and bounded rule evidence. A discovery failure or truncated sitemap cannot be treated as a real disappearance.

Retain the most recent 30 observations per page within 90 days plus all active baselines and observations referenced by open incidents, repair proposals, or retained verification records. Cleanup must not break evidence foreign keys. Define longer closed-incident retention and project deletion through RFC-0026's service terms and existing deletion flows.

## 6. Triggers, capacity, and service health

- Poll successful deployments for the configured production environment, with a durable cursor and deduplication. Include deployments unrelated to Relay proposals. Add an authenticated webhook path when polling latency is not enough.
- Run a daily scheduled check for changes with no available Git event, plus bounded manual checks (initially four per day).
- Use the existing job/lease/notification infrastructure. Monitoring and confirmations require due-time scheduling suited to their promised cadence; do not assume the existing quarter-hour dispatcher can satisfy a shorter target.
- For the initial polling release, target an initial check within 30 minutes of a successful deployment and confirmed findings within 60 minutes, measured from the deployment timestamp. Schedule ordinary confirmations 5–10 minutes after the initial check; HTTP-status regressions need two confirmations ten minutes apart. A faster 15-minute confirmed-alert objective requires separately proven webhook/scheduling behavior.
- Show last successful check, next due check, queued/failed/skipped work, coverage completeness, and reason. Persistent monitor failure sends a deduplicated operational notification, not “no regressions”.

Use at most two concurrent requests per origin, a ten-second request timeout, two MB maximum HTML, and the shared URL policy on every hop. Bounded page/deployment/confirmation budgets follow RFC-0026. Deployment bursts may coalesce pending checks to the newest release, but must record skipped release coverage and must not mix confirmation evidence from different site versions.

Paid research is not required for basic HTTP checks. Optional rendering/enrichment has explicit admission and spend limits. Worker, storage, notifications, and support still have costs.

## 7. Shared rules and confirmation

Reuse and extend `comparePage`/`compareSite` from RFC-0010 rather than introduce a second drifting rule catalog. Make production-versus-preview policy explicit: production monitoring always checks `X-Robots-Tag`; preview platform exemptions do not apply to production.

First rules cover new noindex/robots restrictions, changed canonical, regressed HTTP status/redirects, missing title/description, invalid JSON-LD, and meaningful sitemap loss. Warnings cover changed title/description/H1, dropped internal links, and content shrinkage. Separate pre-existing problems from newly introduced regressions.

1. A blocking candidate schedules a fresh confirmation 5–10 minutes later; open an incident only if the same finding persists.
2. An HTTP-status regression requires two failed HTTP confirmations ten minutes apart. A timeout, bot challenge, or unavailable renderer is an unknown check, not proof of a content regression.
3. A transient candidate records its disposition and opens no incident. A warning can enter review without an urgent alert; changed text is not automatically harmful.
4. Define a stable fingerprint from project, page/resource, rule, and relevant baseline/evidence version. One active incident per page/resource and rule; new observations update its evidence without repeated alerts.
5. Intentional non-indexable pages and authorized ignores are scoped, explained, auditable, and expire where appropriate.

## 8. Incident and cause model

`site_regressions` links project, monitored page/resource, rule/version, last-good and first-bad snapshots, confirmations, severity, detection time, evidence version, optional suspect commits, and nullable analytics exposure. Keep missing click data distinct from zero.

States: `open`, `repairing`, `resolved`, `accepted`, `dismissed`. A resolution records `restored_by_relay`, `fixed_by_customer`, `observed_resolution`, `accepted_change`, or `false_positive`, the evidence, actor when known, and time. RFC-0028 defines verified closure. Keep recurrence as a new incident linked to the previous one.

Notify for confirmed blocking incidents on the agreed important pages even when no click count is available. Include evidence, affected scope, priority rationale, and one next action. Analytics informs priority; it does not gate technical truth.

When verified before/after source SHAs exist, compare commits and show mapped page files, layouts/helpers, middleware, robots, and routing configuration as possible causes. Label the attribution as suspected until proven. When no matching deployment is available, say **“No matching deployment was observed; the cause is unconfirmed.”** Do not claim a change happened outside Git merely because a deployment event is missing.

## 9. Review, repair, and reporting

The incident page shows baseline/current/confirmation evidence, coverage freshness, source confidence, and actions: prepare a supported repair, create/copy a ticket, accept an intentional change as baseline, or dismiss with a reason. Existing ticket creation still requires explicit authorization.

RFC-0027 supplies the exact source restore and human write approval; RFC-0025 phase 1a supplies customer CI/preview evidence; RFC-0028 verifies the production rule and attributes the resolution. A merge, title substring, or customer attestation alone does not close the incident as a verified Relay repair.

RFC-0018 later integrates open incidents, pending repairs, verified resolutions, and quiet-week coverage into its existing view/report. Monitoring can ship with its own page before that integration. Future standing approvals require a separate validated policy rollout and do not change this initial authority model.

## 10. Ready-for-other-users checklist

### Phases 1a–1b

- [ ] Protected scope, runs, snapshots, baselines, incident evidence, and conditional version updates exist in both dialects with tenant isolation.
- [ ] Known-good promotion refuses unhealthy, partial, stale, or unresolved candidates.
- [ ] Deployment discovery works independently of experiments; daily/manual checks and deduplication work.
- [ ] Confirmation, transient, unknown, intentional-change, recurrence, and duplicate-event cases behave as specified.
- [ ] Shared rules distinguish production from preview and pre-existing problems from regressions.
- [ ] Monitoring/incident views expose coverage and lost coverage; alerts and tickets contain reproducible evidence.
- [ ] Polling/confirmation latency and request/storage budgets are measured under deployment bursts.
- [ ] Source causes are qualified; unknown GSC data is not zero and does not suppress important incidents.
- [ ] User documentation explains protected scope, cadence, supported rules, limits, and permission requirements.

### Phase 1c and later

- [ ] RFC-0027 source-proven title/description repairs pass.
- [ ] RFC-0025 phase 1a and RFC-0028 acceptance pass before claiming the reviewed repair loop.
- [ ] Additional canonical/robots/static-file repairs pass adapter-specific acceptance before enablement.
- [ ] Rendered checks expose unsupported and budget-blocked states and pass their own economics test.

## 11. Acceptance and completion

Use S1 staging or another owner-authorized Next.js staging site for seeded failures; use authorized production sites for passive observation only. Do not introduce noindex headers or other harmful changes on customer production to prove detection.

Observe the agreed pages for 14 days and review every confirmed finding, recording the sample and false positives. On staging, seed removed metadata, a templated title change, a robots header, canonical/status changes, a transient HTTP failure, an unavailable fetch, and an intentional accepted change. Include a low-traffic/no-analytics page. Confirm the actual polling and confirmation timing rather than asserting a faster SLA.

Pass when every seeded blocking regression is found within the agreed target, transient/unknown cases do not falsely assert a content regression, repeated events produce one incident, accepted changes stay quiet, and lost monitoring coverage is visible. The initial alert-quality target is zero confirmed false blocking findings over the 14-day sample; report counts and exposure, not a generalized guarantee.

For phase 1c, a reviewer authorizes a source-proven metadata repair, the customer's checks pass, the customer merges/deploys, and RFC-0028 verifies resolution. Demonstrate a customer fix arriving first and an unsupported source becoming a useful ticket.

## 12. Alternatives

Full audits after every release are too broad for bounded protection. Alert-and-ticket delivery is accepted as an initial useful release, while reviewed repair is the next step. Whole-commit rollback and guesses at rendered-to-source mapping are rejected. Building standing approvals first would add risk and dependencies before the reviewed repair loop is proven.
