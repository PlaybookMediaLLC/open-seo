# IRFC-0024: Expand protected revenue-critical customer journeys

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Demand-gated expansion; if no validated buyer demand, record a skip and continue  
**Prerequisites:** IRFC-0007, IRFC-0017  
**Canonical technical specification:** [RFC-0043](../0043-relay-protect-journey-and-release-assurance.md)  
**Implementation order:** 0024 of 0033

## Implement this slice

After Protect validation, implement a constrained browser-journey DSL for navigation, non-mutating signup/demo/pricing checks and safe test-mode interactions. Isolate browser execution, constrain permitted hosts and requests, and prevent test activity from polluting customer sales data.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

A seeded checkout redirect or lead-form regression is reproducibly detected and reported without creating live customers, bookings, payments or unwanted CRM leads.

## Explicit boundary

No arbitrary browser script execution or broad session replay platform.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- Where actual customer/provider acceptance is necessary, state what was tested with fixtures versus a live authorized site. Never treat a test fixture or an unmerged PR as a paid customer outcome.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**; if its commercial gate fails, mark **skipped/deferred** with the evidence. Do not block later unrelated work.

**Next:** [IRFC-0025](0025-verify-conversion-and-revenue-instrumentation-integrity.md)
