# IRFC-0019: Ship Relay Sync for pricing and integration drift

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Required to reach the next core milestone  
**Prerequisites:** IRFC-0018  
**Canonical technical specification:** [RFC-0040](../0040-relay-sync-product-truth-and-content-integrity.md)  
**Implementation order:** 0019 of 0032

## Implement this slice

Productize the fact-to-claim-to-correction loop for narrow pricing-plan and integration-availability drift in Git-backed public content. Establish supported scope, onboarding, service limits, and the customer-owned approval flow.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

On an authorized site, a pricing-plan or integration-availability change is detected in Git-backed content, corrected through the customer's approval, and verified in production.

## Explicit boundary

Don't introduce an unrestricted AI article writer or a hosted help center.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- State what was tested with fixtures and what was tested on a live authorized site. Never treat a test fixture or an unmerged PR as a production result.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**. Do not block later unrelated work.

**Next:** [IRFC-0020](0020-check-existing-customer-created-launch-pages.md)
