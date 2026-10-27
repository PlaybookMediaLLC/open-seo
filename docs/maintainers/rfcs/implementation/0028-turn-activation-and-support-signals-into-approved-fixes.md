# IRFC-0028: Turn activation and support signals into approved fixes

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Demand-gated expansion; if no validated buyer demand, record a skip and continue  
**Prerequisites:** IRFC-0019  
**Canonical technical specification:** [RFC-0045](../0045-activation-support-and-experience-signals.md)  
**Implementation order:** 0028 of 0033

## Implement this slice

Implement limited RFC-0045 signal adapters for onboarding setup failures and support topics after customer authorization. Reuse current GitHub Issues topic grouping; keep support content minimized/redacted and map recurring problems to fact-backed docs or product actions.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

One repeated onboarding/support problem produces a traceable, customer-approved correction with verified result; deleting a source removes its restricted data.

## Explicit boundary

No session replay surveillance or autonomous changes inside a customer's production application.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- Where actual customer/provider acceptance is necessary, state what was tested with fixtures versus a live authorized site. Never treat a test fixture or an unmerged PR as a paid customer outcome.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**; if its commercial gate fails, mark **skipped/deferred** with the evidence. Do not block later unrelated work.

**Next:** [IRFC-0029](0029-keep-sales-integration-and-partner-assets-accurate.md)
