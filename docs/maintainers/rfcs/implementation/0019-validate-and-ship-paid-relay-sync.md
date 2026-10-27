# IRFC-0019: Validate and ship paid Relay Sync

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Commercial decision gate; proceed only with buyer evidence  
**Prerequisites:** IRFC-0018  
**Canonical technical specification:** [RFC-0040](../0040-relay-sync-product-truth-and-content-integrity.md)  
**Implementation order:** 0019 of 0033

## Implement this slice

Productize the fact-to-claim-to-correction loop for narrow pricing-plan and integration-availability drift in Git-backed public content. Establish supported scope, onboarding, service limits, renewal reporting, and buyer-owned approval flow.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

A paying design partner receives an accurately detected and production-verified correction, and the buyer confirms the recurring value independently of setup enthusiasm.

## Explicit boundary

Don't introduce an unrestricted AI article writer or a hosted help center.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- Where actual customer/provider acceptance is necessary, state what was tested with fixtures versus a live authorized site. Never treat a test fixture or an unmerged PR as a paid customer outcome.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**; if its commercial gate fails, mark **skipped/deferred** with the evidence. Do not block later unrelated work.

**Next:** [IRFC-0020](0020-check-existing-customer-created-launch-pages.md)
