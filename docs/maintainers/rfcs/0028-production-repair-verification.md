# RFC-0028: Production repair verification and outcome handoff

- **Status:** Proposed; existing deployment signals are partial foundations.
- **Date:** 2026-10-23
- **Delivery:** Stage 2, after reviewed repair and customer-preview integration.
- **Depends on:** RFC-0019 phases 1a–1b, RFC-0027, RFC-0025 phase 1a, RFC-0005 deployment signals, RFC-0008 jobs, and RFC-0009 audit controls. Reuses RFC-0006 measurement when eligible. RFC-0018 consumes these results; its integration is not a prerequisite.

## 1. Problem and outcome

`DeploymentSignalService` records a successful GitHub deployment of a merged experiment's commit and a live title/description match. Other change kinds require attestation or feature-specific checks; the generic live check does not rerun canonical, robots, HTTP status, or other original rules. The scheduled deployment job refreshes signals and asks a person to confirm measurement.

Release assurance needs a durable distinction between “PR merged”, “deployment observed”, “original failure no longer present”, and “later business outcome measured”. This RFC closes a confirmed incident only with fresh production evidence, without requiring traffic or inventing attribution.

## 2. Verification contract

For each supported repair, record the exact rule/version, target production URL or site resource, original baseline and failing snapshots, source mapping, approved proposal fingerprint, PR head/merge evidence, and expected postcondition. Reuse the shared rule implementation from RFC-0019/0010. Store normalized references in `repair_verifications` and append attempts in `repair_verification_runs`, with project scoping and matching SQLite/Postgres schemas.

A run stores observed time, trigger, production environment, deployment evidence if available, tested commit provenance, snapshot reference, result (`pass`, `fail`, `unknown`), and a bounded reason. Unknown provenance, unavailable pages, timeouts, bot challenges, incomplete rendering, and skipped checks are not passes.

### Independent state dimensions

| Dimension              | States                                                                  | Meaning                                                            |
| ---------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Repository             | awaiting approval, PR open, merged, closed without merge                | Exact-change execution status; no production claim.                |
| Deployment             | pending, observed, verified provenance, human-attested, unknown         | Whether and how the approved code is known to be running.          |
| Technical verification | pending, verifying, passed, failed, blocked, superseded                 | Result of the original rule on fresh production observations.      |
| Growth measurement     | not eligible, waiting for data/window, measuring, complete/inconclusive | Optional search/conversion observations after the technical event. |

Do not collapse these into a single “done” flag. A human attestation is useful operational evidence but is not independently verified provenance.

## 3. Deployment and production checks

1. Verify the recorded PR is merged and still contains the approved change. Preserve exact commit/blob checks from RFC-0005; a changed PR head invalidates old preview evidence.
2. Match the production environment and commit to a successful deployment. Exact merge SHA is the first supported path. A later deployed commit can qualify only if ancestry and relevant file/blob equivalence are proven; otherwise show unknown provenance and request a fresh check or explicit attestation.
3. Fetch the actual production origin with the shared URL policy on every request/redirect. A preview URL cannot satisfy production verification. Treat caching and propagation as reasons to wait within a bounded retry window.
4. Rerun the original rule and its absolute postcondition: the expected rendered description/title, intended canonical, indexability, response status, or relevant site-level rule. Merely returning HTTP 200 or finding a title substring is insufficient.
5. Require two matching fresh observations separated by the configured confirmation interval (initially 5–10 minutes), with no newer conflicting release/evidence. Persist both; retries must not reuse one observation twice. If the runner cannot meet that cadence, expose its actual cadence and defer the claimed target.
6. Mark `restored_by_relay` only when verified deployment provenance and the original postcondition both pass for the approved repair. Promote the verified snapshot to known-good through RFC-0019's guarded promotion path, then emit one resolution event.

Each adapter declares what it can verify. Unsupported verification stays blocked/manual with a clear next action; it does not borrow the title/description verifier. Reuse feature-specific checks where they meet this contract rather than rebuilding them.

## 4. Customer fixes, newer releases, and failures

A customer may fix the problem before the Relay PR ships. If repeated production checks pass without proof of the approved repair's deployment, record an observed resolution with actor/provenance unknown (or `fixed_by_customer` when supported by evidence). Do not credit Relay with the repair. Close or supersede its proposal after confirming the state, and preserve the history.

A newer deployment, changed source mapping, accepted intentional change, or reopened incident supersedes stale verification attempts. An old delayed job cannot overwrite the newer incident state or promote an old snapshot. Use incident/evidence versions and conditional updates, not last-write-wins.

Set a bounded retry schedule and verification deadline per enrolled site's cadence; default to checking after deployment and over the next 24 hours. On expiry, show unresolved/blocked status, last observation, failure reason, and who can act. Do not auto-rollback or treat expiry as resolution. On recurrence after a verified resolution, open a new linked incident rather than rewriting the prior outcome.

If the customer's pipeline rolled back or the intended repair made the situation worse, keep the incident open, offer an evidence-backed revert/ticket, and leave deployment authority with the customer.

## 5. Handoff to measurement and reporting

Technical verification is useful with zero GSC clicks. Only create or attach growth measurement when its property, consent, metric, baseline, and window requirements are satisfied. Reuse RFC-0006/0012/0016 rules and label insufficient data, overlapping changes, seasonality, and revenue coverage explicitly. Do not weaken existing experiment eligibility to make repairs look measured.

The report in RFC-0018 distinguishes verified Relay repairs, observed/customer resolutions, accepted intentional changes, unresolved incidents, attested deployments, and measurements still pending. A PR opening or merging does not increment the verified-repair count. A repair may qualify as technically resolved while its growth result remains inconclusive indefinitely.

Persist and expose detection time, first confirmation, approval, merge, deployment, verification attempts, and resolution so review and repair delays can be measured. “Organic clicks on affected pages” describes exposure; it is not “traffic saved”.

## 6. Operations, safety, and costs

Reuse growth-job leases, retries, deduplication, permission checks, and notification controls. Revalidate enrollment and source permissions when an attempt runs. Count verification and confirmation requests against the declared protection budget; isolate optional paid browser checks behind admission. Preserve included basic checks independently of research-credit balance as defined in RFC-0026.

Store bounded observations and references, not full sensitive pages. Deleting/revoking an organization/project must follow existing retention and deletion behavior. Audit resolution, supersession, manual attestation, baseline promotion, and failed/stopped checks. Surface monitor health so absence of attempts cannot look like a successful repair.

## 7. Ready-for-other-users checklist

- [ ] Merged-but-not-deployed, preview-only, stale signal, wrong environment, and unknown provenance never count as verified repairs.
- [ ] Title templates, description, and every enabled later rule verify their own postcondition; unsupported kinds stay explicit.
- [ ] Two distinct fresh observations are required; duplicate job delivery cannot manufacture confirmation.
- [ ] A newer deployment or incident version prevents stale closure and baseline promotion.
- [ ] External fixes, attestation, transient fetch errors, bot challenges, and unresolved failures are correctly labeled.
- [ ] The same resolution is counted/notified once; recurrence creates a linked new incident.
- [ ] Technical verification works without GSC/GA4; optional measurement retains existing sufficiency rules.
- [ ] The weekly report reconciles to verification records and shows unresolved/blocked work and quiet coverage.
- [ ] Both database dialects, tenant isolation, revoke/pause behavior, and bounded retry exhaustion pass.

## 8. Acceptance

On authorized staging, introduce a metadata regression, approve its exact repair, and run the customer preview checks. Merge without deploying: the incident must remain unresolved. Deploy to the wrong environment: it must remain unresolved. Deploy the approved repair to production-equivalent staging and verify the original rule twice: it resolves once with linked evidence.

Repeat with an unrelated later deployment, delayed/stale jobs, a failed fetch, a dynamic title the verifier cannot prove, and a customer fix before merge. No case may incorrectly credit a Relay repair. A no-analytics site must still verify the technical result.

For commercial validation, observe two customer-approved, deployed repairs across separate organizations under RFC-0026, without seeding harmful failures on customer production. Record the actual evidence and remaining limitations. The staged acceptance proves mechanics; customer repairs test value.

## 9. Alternatives

Merge status is inadequate because deployments can fail or never occur. Deployment events alone cannot show the original issue was fixed. Human attestation alone should remain labeled as such. Requiring positive search growth before closing a technical incident would conflate separate questions and delay useful resolution. The contract therefore keeps deployment, technical verification, and later outcomes distinct.
