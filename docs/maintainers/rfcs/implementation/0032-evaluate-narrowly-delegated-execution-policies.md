# IRFC-0032: Evaluate narrowly delegated execution policies

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Optional engineering investment  
**Prerequisites:** IRFC-0017, IRFC-0023  
**Canonical technical specification:** [RFC-0018](../0018-weekly-execution-queue.md)  
**Implementation order:** 0032 of 0032

## Implement this slice

Once incident repairs are proven safe (IRFC-0006), implement RFC-0018 **phases 2–3**: explicit revocable per-class standing approvals, exact proposal hashing, rate/weekly limits, branch protections, pause-on-verification-failure and audit identity.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

Expired, revoked, exceeded-budget and altered-head policies refuse execution; a failed postcondition pauses policy and provides a safe manual recovery.

## Explicit boundary

No blanket permission for AI to merge, deploy or send customer messages.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- State what was tested with fixtures and what was tested on a live authorized site. Never treat a test fixture or an unmerged PR as a production result.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**. Do not block later unrelated work.

**Next:** End of current implementation series.
