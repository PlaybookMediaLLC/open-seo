# Relay implementation RFCs — one sequential execution path

**Updated:** 2026-10-28  
**Target repository:** `PlaybookMediaLLC/relay` → `develop`  
**Authority:** This index sets the work sequence. Linked historical RFCs hold the full engineering designs and safety contracts.

## Start here

**Work through IRFC-0001, IRFC-0002, and so on.** These numbers are the implementation order, not historical RFC IDs. RFC-0001–0017 in the parent folder already have mostly closed implementation scopes and remain as reusable foundations; they are not seventeen projects to rebuild. The old source RFC identifiers stay unchanged because code comments, prior PRs, specifications, and handoffs already depend on them.

At each item: inspect current `develop`, implement only the specified slice, run its acceptance checks, and record either **verified existing**, **completed**, **blocked**, or **skipped for failed demand gate**. Optional or demand-gated items do not prevent unrelated later features from advancing. Progress is measured by verified workflows and payments, not documentation count. Commercial evidence (payments, renewals, prices, buyers, reviewers, support and compute costs) stays in the private sales record; public notes and PRs say only whether a commercial gate was met or not met, with no names, prices, payment references or costs.

## Numbered implementation queue

| IRFC                                                                            | Work to complete                                                | Full source RFC                                                                                                | Gate        |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------- |
| [0001](0001-qualify-and-enroll-paying-protect-pilots.md)                        | Qualify and enroll paying Protect pilots                        | [0026](../0026-protected-site-pilots-and-service.md)                                                           | required    |
| [0002](0002-establish-protected-pages-and-known-good-production-baselines.md)   | Establish protected pages and known-good production baselines   | [0019](../0019-release-monitoring-and-regression-repair.md)                                                    | required    |
| [0003](0003-confirm-deduplicate-and-explain-production-regressions.md)          | Confirm, deduplicate, and explain production regressions        | [0019](../0019-release-monitoring-and-regression-repair.md)                                                    | required    |
| [0004](0004-prepare-source-mapped-repair-proposals-from-confirmed-incidents.md) | Prepare source-mapped repair proposals from confirmed incidents | [0027](../0027-source-mapped-regression-repairs.md)                                                            | required    |
| [0005](0005-authorize-exact-pr-writes-and-check-customer-owned-previews.md)     | Authorize exact PR writes and check customer-owned previews     | [0027](../0027-source-mapped-regression-repairs.md), [0025](../0025-preview-sandboxes-on-cloudflare.md)        | required    |
| [0006](0006-verify-repaired-behavior-in-production.md)                          | Verify repaired behavior in production                          | [0028](../0028-production-repair-verification.md), [0019](../0019-release-monitoring-and-regression-repair.md) | required    |
| [0007](0007-productize-protect-work-reports-and-recurring-service.md)           | Productize Protect work reports and recurring service           | [0018](../0018-weekly-execution-queue.md), [0026](../0026-protected-site-pilots-and-service.md)                | required    |
| [0008](0008-apply-commercial-stop-go-gates-to-sync-and-launch.md)               | Apply commercial stop/go gates to Sync and Launch               | [0029](../0029-commercial-pilots-rollout-and-go-no-go.md)                                                      | commercial  |
| [0009](0009-establish-the-minimal-product-reality-engine-kernel.md)             | Establish the minimal Product Reality Engine kernel             | [0030](../0030-product-reality-engine-architecture.md)                                                         | required    |
| [0010](0010-enforce-tenant-privacy-authorization-and-spend-invariants.md)       | Enforce tenant, privacy, authorization, and spend invariants    | [0031](../0031-platform-governance-privacy-metering-and-service-quality.md)                                    | required    |
| [0011](0011-introduce-bounded-connector-contracts-and-health.md)                | Introduce bounded connector contracts and health                | [0032](../0032-connector-runtime-permissions-and-health.md)                                                    | required    |
| [0012](0012-ingest-and-replay-product-change-observations.md)                   | Ingest and replay product-change observations                   | [0033](../0033-change-observation-and-provenance.md)                                                           | required    |
| [0013](0013-model-typed-scoped-versioned-product-facts.md)                      | Model typed, scoped, versioned product facts                    | [0034](../0034-versioned-product-facts-and-authority.md)                                                       | required    |
| [0014](0014-index-customer-facing-assets-and-attributable-claims.md)            | Index customer-facing assets and attributable claims            | [0035](../0035-customer-facing-assets-and-claims.md)                                                           | required    |
| [0015](0015-resolve-deterministic-change-to-asset-impact.md)                    | Resolve deterministic change-to-asset impact                    | [0036](../0036-impact-analysis-and-dependency-graph.md)                                                        | required    |
| [0016](0016-create-reviewed-cross-system-work-plans.md)                         | Create reviewed cross-system work plans                         | [0037](../0037-work-plans-authorization-and-execution.md)                                                      | required    |
| [0017](0017-record-delivery-receipts-and-independent-outcome-verification.md)   | Record delivery receipts and independent outcome verification   | [0038](../0038-verification-outcomes-and-learning.md)                                                          | required    |
| [0018](0018-deliver-the-reviewer-workbench-incrementally.md)                    | Deliver the reviewer Workbench incrementally                    | [0039](../0039-product-workbench-ux-and-human-review.md)                                                       | required    |
| [0019](0019-validate-and-ship-paid-relay-sync.md)                               | Validate and ship paid Relay Sync                               | [0040](../0040-relay-sync-product-truth-and-content-integrity.md)                                              | commercial  |
| [0020](0020-check-existing-customer-created-launch-pages.md)                    | Check existing customer-created launch pages                    | [0023](../0023-launch-workflows.md)                                                                            | conditional |
| [0021](0021-deliver-approved-relay-launch-release-packets.md)                   | Deliver approved Relay Launch release packets                   | [0042](../0042-relay-launch-change-to-commercial-release.md)                                                   | commercial  |
| [0022](0022-expose-read-only-api-and-mcp-workflows-when-needed.md)              | Expose read-only API and MCP workflows when needed              | [0041](../0041-versioned-api-mcp-and-event-subscriptions.md)                                                   | conditional |
| [0023](0023-persist-page-history-and-prevent-repeated-ineffective-work.md)      | Persist page history and prevent repeated ineffective work      | [0024](../0024-change-history-and-learning.md)                                                                 | conditional |
| [0024](0024-expand-protected-revenue-critical-customer-journeys.md)             | Expand protected revenue-critical customer journeys             | [0043](../0043-relay-protect-journey-and-release-assurance.md)                                                 | conditional |
| [0025](0025-verify-conversion-and-revenue-instrumentation-integrity.md)         | Verify conversion and revenue instrumentation integrity         | [0044](../0044-conversion-revenue-and-attribution-integrity.md)                                                | conditional |
| [0026](0026-operate-bounded-growth-and-content-decay-campaigns.md)              | Operate bounded growth and content-decay campaigns              | [0020](../0020-growth-campaigns-and-decay-recovery.md)                                                         | conditional |
| [0027](0027-create-individually-reviewed-pages-from-verified-facts.md)          | Create individually reviewed pages from verified facts          | [0021](../0021-new-pages-from-verified-facts.md)                                                               | conditional |
| [0028](0028-turn-activation-and-support-signals-into-approved-fixes.md)         | Turn activation and support signals into approved fixes         | [0045](../0045-activation-support-and-experience-signals.md)                                                   | conditional |
| [0029](0029-keep-sales-integration-and-partner-assets-accurate.md)              | Keep sales, integration and partner assets accurate             | [0046](../0046-enablement-integrations-and-partner-assets.md)                                                  | conditional |
| [0030](0030-respond-to-verified-competitor-changes.md)                          | Respond to verified competitor changes                          | [0022](../0022-competitor-change-response.md)                                                                  | optional    |
| [0031](0031-evaluate-isolated-relay-owned-preview-builds.md)                    | Evaluate isolated Relay-owned preview builds                    | [0025](../0025-preview-sandboxes-on-cloudflare.md)                                                             | optional    |
| [0032](0032-evaluate-narrowly-delegated-execution-policies.md)                  | Evaluate narrowly delegated execution policies                  | [0018](../0018-weekly-execution-queue.md)                                                                      | optional    |

IRFC-0033 (multi-website and portfolio operations) was removed once its code shipped; [RFC-0007 section 6](../0007-portfolio-operations.md#6-design-sketch-and-what-was-built) records what was built, and its status line tracks the pending live acceptance.

## Milestones

- **IRFC-0001–0007 — Relay Protect:** paid scope, production baselines, incidents, approved PRs, preview checks, verified repairs and recurring work reports.
- **IRFC-0008–0019 — Product Reality Engine and Relay Sync:** commercial decision, minimally sufficient architecture, secure ingestion, scoped facts, claim matching, impact analysis, approved work, verification and first paying Sync implementation.
- **IRFC-0020–0022 — Relay Launch and agent access:** existing-page launch checks, coordinated launch packets, and read-only API/MCP when required. IRFC-0022 is optional for the first Launch customer.
- **IRFC-0023–0030 — Customer-validated extensions:** page memory, customer journeys, conversion integrity, campaigns, sourced pages, support, enablement and competitor responses. Sequence is advisory after commercial gates; stop or skip low-value extensions.
- **IRFC-0031–0032 — Optional capital-intensive extensions:** isolated builds and delegated execution. Do not treat these as prerequisites for the company's core goal.

## Pre-existing foundation

Historical [RFC-0001–0017](../README.md#complete-inventory-and-audited-status) preserve implementation/acceptance records for authentication, research, publishing, scheduled jobs, metering, GitHub quality checks, experiments, revenue attribution, documentation and support. Reuse them; verify their specific live readiness where used. The original [RFC delivery plan](../README.md) and [Product Reality index](../PRODUCT-REALITY-RFC-INDEX.md) are retained for design history, not the new linear queue.

## How coding agents should execute

```text
Read docs/maintainers/rfcs/implementation/README.md.
Start with the lowest incomplete IRFC number.
Inspect its canonical source RFC and the current implementation.
Implement only the linked phase and its stated acceptance gate.
Run applicable verification and document actual evidence.
If already satisfied, mark verified existing; if demand-gated and not validated,
mark skipped/deferred, then advance to the next IRFC.
Never bypass project isolation, exact-change approval, production verification,
or required PR security checks.
```

## Number preservation

The historical RFC IDs are immutable source identifiers. Renaming the originals would silently change the meaning of many code references and older PR discussions. The `IRFC-xxxx` filenames and headings are the new _unambiguous, sequential implementation numbers_, so there is no competing `RFC-0001` inside the original folder. No product feature is considered implemented merely because it appears in this plan.
