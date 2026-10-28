# IRFC-0006: Verify repaired behavior in production

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Required to reach the next core milestone  
**Prerequisites:** IRFC-0005  
**Canonical technical specifications:** [RFC-0028](../0028-production-repair-verification.md), [RFC-0019](../0019-release-monitoring-and-regression-repair.md)  
**Implementation order:** 0006 of 0032

## Implement this slice

Complete RFC-0028 and RFC-0019 **phase 1c**: distinguish PR merged, deployment observed, verified provenance, original postcondition restored, and later growth measurement. Require fresh production checks of the original failing rule and retain independent receipt history.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

Demonstrate the full approved PR → customer deployment → repeated production verification path; record unknown or customer-fixed states without crediting Relay with the repair.

## Explicit boundary

Never mark resolved solely because CI passed or a PR merged.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- Where actual customer/provider acceptance is necessary, state what was tested with fixtures versus a live authorized site. Never treat a test fixture or an unmerged PR as a paid customer outcome.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**; if its commercial gate fails, mark **skipped/deferred** with the evidence. Do not block later unrelated work.

**Next:** [IRFC-0007](0007-productize-protect-work-reports-and-recurring-service.md)
