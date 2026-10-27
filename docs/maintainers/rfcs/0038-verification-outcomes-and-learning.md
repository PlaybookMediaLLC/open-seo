# RFC-0038: Verification receipts, independent outcome clocks, and durable learning

- **Status:** Proposed
- **Date:** 2026-10-27
- **Implementation position:** Slice 4: independent post-publication verification
- **Dependencies:** RFC-0030–0037 (evidence, work and permissions); existing RFC-0006 measurement, RFC-0028 production repair verification, RFC-0024 history and RFC-0018 weekly report. Keep technical resolution distinct from business measurement.

## 1. Problem

Organizations regularly call work “done” when a PR is merged, a CMS API returns 200, a deployment succeeds, or an announcement is queued. None of those events proves that customers saw the correct information or that a commercial outcome improved. Relay needs a common verification contract across products without flattening important differences between technical fixes, content correctness, communication delivery, user behavior, and business results.

**Decision:** use a typed `VerificationSpec` per action with immutable attempts and explicit `pass | fail | unknown | inconclusive | blocked` outcomes. Preserve separate clocks for destination state and later business observation. RFC-0028 remains authoritative for Protect regressions and their exact original rule; this RFC generalizes the references, not the acceptance semantics.

## 2. Independent dimensions

| Dimension | Evidence | Interpretation |
|---|---|---|
| Proposal | fingerprint, reviewer, permission | authorized intent only |
| Execution | external write/PR receipt | external system accepted a mutation request |
| Delivery / publication | current Git SHA, deployment ID, CMS live revision, published URL | changed content appears in target environment |
| Functional verification | rerun failed technical rule, scripted safe journey | exact expected postcondition holds |
| Content verification | source-backed statement at target URL, scope, fact version | material claim is now accurate for applicable audience |
| Communication verification | provider accepted, sent, bounced, permission states | message delivery status, **not** readership/comprehension |
| Customer outcome | consented conversion/activation/support metrics | observed result, generally not causal attribution |
| Commercial outcome | payment, renewal, improved cost/effort | actual customer business behavior, with provenance |

A failed content check must not hide behind a successful deploy. If Relay cannot independently confirm release provenance, label it `observed` or `attested`, not `verified_by_relay`.

## 3. Typed spec and persistence

```ts
type VerificationSpec = {
  projectId: string;
  workItemId: string;
  expectedEvidenceVersion: string;
  target: { kind: 'public_url'|'git_ref'|'repo_file'|'connector_object'; key: string };
  rule: { kind: 'page_rule'|'typed_claim'|'link_target'|'journey_check'|
    'provider_receipt'; version: string; expected: unknown };
  environment: 'production'|'preview'|'external_destination';
  maxAgeSeconds: number;
  requiredConfirmations: number;
  separationSeconds: number;
};
```

Persist `reality_verification_specs(id,project_id,work_item_id,spec_version,evidence_generation,...)`, `reality_verification_runs(id,project_id,spec_id,started_at,observed_at,status,reason_code,snapshot_id?,provider_receipt_id?,source_sha?,cost_units,...)`, `reality_resolution_events(id,project_id,work_item_id,kind,verified_by,run_id,...)`, `reality_outcome_windows` for time-window metrics and `reality_learning_notes` for reviewer-confirmed findings. Use typed foreign keys and reference children for expected values; avoid unbounded JSON as a storage shortcut. The spec itself is immutable after approval.

## 4. Verification adapters

**GitHub/Next.js:** use RFC-0028 production rule checking and RFC-0025 customer preview of the exact head SHA. Static site metadata repair requires checking rendered output and provenance; source diff alone is insufficient.

**Documentation:** confirm approved file version in repo, deployment event when available, then fetch the published article URL and compare the exact claim or heading in its intended locale/plan scope. Render caching can delay verification; use bounded backoff and only mark `passed` after fresh observations.

**Plan/price claim:** compare rendered price/plan text to the specific accepted scoped fact version. Do not “verify” price by changing live Stripe plans or creating a charge. Claims to actual entitlements remain unverified unless there is authorized non-mutating evidence.

**Customer journey:** run a safe scripted synthetic journey (RFC-0043), with monitored account/test mode as needed; don't create orders/messages/leads in production without explicit destination-safe controls.

**Outbound message:** track approval → accepted by provider → delivered/bounced where the provider supports it; do not label a send receipt as successful communication or attribute subsequent revenue to it.

## 5. Retries, unknowns and causality

- Verification must be re-run after the observed deployment or destination publication, never only against the preview.
- For consequential web repairs, require two fresh checks separated by configured interval, as in RFC-0028. Don't claim a 5-minute SLA if scheduler cadence cannot meet it.
- If the target is blocked by robots/WAF, responds intermittently, or is from a different region/currency scope, return `unknown` and the exact reason.
- A later unrelated customer fix may resolve the observed problem. Record `resolved_externally` rather than credit Relay with the repair.
- Before/after GA4 and GSC values are descriptive. Causal lift requires an experimental design/control and enough data, not simply temporally adjacent chart movement.
- A quiet week counts as protected only when scheduled checks succeeded within the customer's contracted cadence; use existing RFC-0026 operational metric rather than generating faux activity.

## 6. Work report and timeline

Show four independently sourced sections: **Protected / healthy**, **Completed and verified**, **Awaiting action**, **Measuring / inconclusive**. Each item links to specific source evidence and verification runs. Include negative results and failed attempts, not just successes. A correction may resolve a technical incident while its organic ranking remains inconclusive; both are true.

RFC-0024 should consume verified resolution events as immutable entries. This may inform future safety rules and avoid repeat interventions, but must not claim that a statistically noisy change “always works.”

## 7. Delivery slices and acceptance

**A:** shared verification types and adapter contract; bridge existing RFC-0028 without duplicating its domain tables.

**B:** public docs / typed claim adapter; case in which repo PR is merged but URL stays stale must remain pending/failed.

**C:** provider receipt / journey adapter; connect to launch and Protect once respective RFCs have acceptance.

**D:** outcome windows and experience timeline; show genuine `insufficient_data` and `unknown` labels.

Test wrong locale, cached page, stale fact, concurrent deploy, PR squash merge, unknown commit, race with owner fix, partial API success, transient 429, failed renderer, and missing analytics consent. All checks must be project-scoped and reproducible in deterministic fixtures. Do not require real purchases or public announcements for acceptance.

## 8. Alternatives

Reject one boolean `done`, assuming a HTTP 200 response is correctness, using LLM judgment as the only verifier, and combining a technical pass with a marketing KPI into a single confidence number.
