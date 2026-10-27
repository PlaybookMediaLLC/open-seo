# IRFC-0016: Create reviewed cross-system work plans

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Required to reach the next core milestone  
**Prerequisites:** IRFC-0015  
**Canonical technical specification:** [RFC-0037](../0037-work-plans-authorization-and-execution.md)  
**Implementation order:** 0016 of 0033

## Implement this slice

Extend existing proposal/approval mechanisms with typed work items, exact target revision, source-evidence version, role-scoped authorization, dry-run diff, and idempotent execution checkpoints. Initial writers are the supported GitHub/Markdown adapters only; failures and compensation are explicit.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

User can approve and execute precisely the proposed edit once; revocation, source drift and permission changes block execution without dropping history.

## Explicit boundary

No blanket standing authority or bulk publication.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- Where actual customer/provider acceptance is necessary, state what was tested with fixtures versus a live authorized site. Never treat a test fixture or an unmerged PR as a paid customer outcome.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**; if its commercial gate fails, mark **skipped/deferred** with the evidence. Do not block later unrelated work.

**Next:** [IRFC-0017](0017-record-delivery-receipts-and-independent-outcome-verification.md)
