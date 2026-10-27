# IRFC-0020: Check existing customer-created launch pages

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Demand-gated expansion; if no validated buyer demand, record a skip and continue  
**Prerequisites:** IRFC-0019  
**Canonical technical specification:** [RFC-0023](../0023-launch-workflows.md)  
**Implementation order:** 0020 of 0033

## Implement this slice

Implement RFC-0023 **phase 1 read-only checks** on an actual customer-created launch page: existence, indexability, metadata, sitemap, linked documentation, tracking state, and post-release measurement. Emit tickets for missing internal links until RFC-0020 approved link-writing is delivered later.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

A manually declared launch produces an evidence-backed checklist and rechecks after deployment; unsupported fixes remain tasks without claiming publication.

## Explicit boundary

Do not require automatic page generation or rollout messaging.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- Where actual customer/provider acceptance is necessary, state what was tested with fixtures versus a live authorized site. Never treat a test fixture or an unmerged PR as a paid customer outcome.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**; if its commercial gate fails, mark **skipped/deferred** with the evidence. Do not block later unrelated work.

**Next:** [IRFC-0021](0021-deliver-approved-relay-launch-release-packets.md)
