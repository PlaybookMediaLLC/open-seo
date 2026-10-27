# IRFC-0023: Persist page history and prevent repeated ineffective work

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Demand-gated expansion; if no validated buyer demand, record a skip and continue  
**Prerequisites:** IRFC-0007  
**Canonical technical specification:** [RFC-0024](../0024-change-history-and-learning.md)  
**Implementation order:** 0023 of 0033

## Implement this slice

Implement RFC-0024 **phases 1a–1b** only when recurring work needs it. Extend completed RFC-0018 selection filters into shared proposal-time rules, versioned external page changes, accepted manual overrides, cooldowns and outcome-aware draft context.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

An identical low-value edit is rejected during its cooldown, while a genuine regression restore is allowed and audited; inconclusive tests don't silently become wins.

## Explicit boundary

Cross-customer learning and anonymous aggregate models remain later.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- Where actual customer/provider acceptance is necessary, state what was tested with fixtures versus a live authorized site. Never treat a test fixture or an unmerged PR as a paid customer outcome.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**; if its commercial gate fails, mark **skipped/deferred** with the evidence. Do not block later unrelated work.

**Next:** [IRFC-0024](0024-expand-protected-revenue-critical-customer-journeys.md)
